import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { PDFDocument, rgb, PDFName, PDFString } from 'pdf-lib';
import { AgendaSvgExport } from './AgendaSvgExport.js';
import { PdfExport, type PageSize } from './PdfExport.js';
import { Notify } from './Notify.js';
import { I18n } from '../settings/Translations.js';

export interface PdfVectorOptions {
  filename?: string;
  bleedMm?: number;
  cropMarks?: boolean;
  cmykOutputIntent?: boolean;
}

export class PdfVectorExport {
  private static _parseDimensionPt(val: string, fallbackPt: number): number {
    if (!val) return fallbackPt;
    const v = val.trim();
    if (v.endsWith('mm')) return parseFloat(v) * (72 / 25.4);
    if (v.endsWith('cm')) return parseFloat(v) * (72 / 2.54);
    if (v.endsWith('in')) return parseFloat(v) * 72;
    if (v.endsWith('px')) return parseFloat(v) * 0.75;
    if (v.endsWith('pt')) return parseFloat(v);
    const parsed = parseFloat(v);
    return Number.isNaN(parsed) ? fallbackPt : parsed;
  }

  /**
   * Export editor pages as high-quality Print-Ready Vector PDF (CMYK OutputIntent, Crop Marks, Bleed Box)
   */
  static async export(editor: HTMLElement, options: PdfVectorOptions = {}): Promise<Uint8Array> {
    const pages = [...editor.querySelectorAll<HTMLElement>('.craftools-page')];
    if (!pages.length) {
      throw new Error('Nenhuma página encontrada para exportação');
    }

    const bleedMm = options.bleedMm ?? 0;
    const cropMarks = options.cropMarks ?? false;
    const cmykIntent = options.cmykOutputIntent ?? true;
    const bleedPt = (bleedMm / 25.4) * 72;
    const cropMarkLengthPt = 14; // Length of crop mark lines
    const cropMarkOffsetPt = 4;  // Distance between crop mark and trim box

    const masterPdf = await PDFDocument.create();

    // Loop through each page in the document
    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i];
      const pageSize: PageSize = PdfExport._parsePageSize(pageEl);

      const trimW = PdfVectorExport._parseDimensionPt(pageSize.width, 595.28);
      const trimH = PdfVectorExport._parseDimensionPt(pageSize.height, 841.89);

      // Calculate total page bounds including bleed and crop mark margins if enabled
      const marginPt = cropMarks ? (bleedPt + cropMarkLengthPt + cropMarkOffsetPt) : bleedPt;
      const totalW = trimW + (marginPt * 2);
      const totalH = trimH + (marginPt * 2);

      // Step 1: Preprocess page DOM & convert to vector SVG element
      const svgEl = await AgendaSvgExport.pageToSvg(pageEl);

      // Step 2: Create a temporary jsPDF document matching the total bounds
      const jsPdfDoc = new jsPDF({
        orientation: totalW > totalH ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [totalW, totalH],
        compress: true,
      });

      // Step 3: Render vector SVG directly onto jsPDF canvas using svg2pdf.js
      await svg2pdf(svgEl, jsPdfDoc, {
        x: marginPt,
        y: marginPt,
        width: trimW,
        height: trimH,
      });

      // Step 4: Import the rendered page into pdf-lib master document
      const singlePdfBytes = jsPdfDoc.output('arraybuffer');
      const tempPdfDoc = await PDFDocument.load(singlePdfBytes);
      const [copiedPage] = await masterPdf.copyPages(tempPdfDoc, [0]);
      const newPage = masterPdf.addPage(copiedPage);

      // Step 5: Define MediaBox, TrimBox, and BleedBox
      newPage.setMediaBox(0, 0, totalW, totalH);

      const trimLeft = marginPt;
      const trimBottom = marginPt;
      const trimRight = marginPt + trimW;
      const trimTop = marginPt + trimH;

      newPage.setTrimBox(trimLeft, trimBottom, trimRight, trimTop);

      if (bleedMm > 0) {
        newPage.setBleedBox(
          trimLeft - bleedPt,
          trimBottom - bleedPt,
          trimRight + bleedPt,
          trimTop + bleedPt
        );
      }

      // Step 6: Draw professional vector Crop Marks if requested
      if (cropMarks) {
        const drawCropLine = (x1: number, y1: number, x2: number, y2: number) => {
          newPage.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            thickness: 0.5,
            color: rgb(0, 0, 0),
          });
        };

        const o = cropMarkOffsetPt;
        const l = cropMarkLengthPt;

        // Bottom-Left corner
        drawCropLine(trimLeft - o - l, trimBottom, trimLeft - o, trimBottom);
        drawCropLine(trimLeft, trimBottom - o - l, trimLeft, trimBottom - o);

        // Top-Left corner
        drawCropLine(trimLeft - o - l, trimTop, trimLeft - o, trimTop);
        drawCropLine(trimLeft, trimTop + o, trimLeft, trimTop + o + l);

        // Bottom-Right corner
        drawCropLine(trimRight + o, trimBottom, trimRight + o + l, trimBottom);
        drawCropLine(trimRight, trimBottom - o - l, trimRight, trimBottom - o);

        // Top-Right corner
        drawCropLine(trimRight + o, trimTop, trimRight + o + l, trimTop);
        drawCropLine(trimRight, trimTop + o, trimRight, trimTop + o + l);
      }
    }

    // Step 7: Embed CMYK OutputIntent (PDF/X-4 / Commercial Print Profile)
    if (cmykIntent) {
      try {
        const outputIntentDict = masterPdf.context.obj({
          Type: 'OutputIntent',
          S: 'GTS_PDFX',
          OutputConditionIdentifier: PDFString.of('Coated FOGRA39'),
          RegistryName: PDFString.of('http://www.color.org'),
          Info: PDFString.of('Coated FOGRA39 (ISO 12647-2:2004)'),
        });
        const outputIntentsArray = masterPdf.context.obj([outputIntentDict]);
        masterPdf.catalog.set(PDFName.of('OutputIntents'), outputIntentsArray);
      } catch (err) {
        console.warn('[PdfVectorExport] Could not attach CMYK OutputIntent:', err);
      }
    }

    return await masterPdf.save();
  }

  /**
   * Helper method to generate and trigger download of the Print-Ready Vector PDF
   */
  static async exportAndDownload(editor: HTMLElement, options: PdfVectorOptions = {}): Promise<void> {
    const filename = options.filename ?? 'Craftools_PrintReady_Vector.pdf';
    const dismissToast = Notify.toast(I18n.t('editor.generating') || 'Gerando PDF Vetorial...', 'info', 60_000);

    try {
      const pdfBytes = await PdfVectorExport.export(editor, options);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Notify.toast(I18n.t('editor.exportSuccess') || 'PDF Vetorial exportado com sucesso!', 'success');
    } catch (err) {
      console.error('[PdfVectorExport] Failed to generate vector PDF:', err);
      Notify.toast(I18n.t('editor.exportError') || 'Erro ao gerar PDF Vetorial', 'error');
    } finally {
      dismissToast();
    }
  }
}
