import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { PDFDocument, rgb, PDFName, PDFString } from 'pdf-lib';
import { AgendaSvgExport } from './AgendaSvgExport.js';
import { PdfExport, type PageSize } from './PdfExport.js';
import { CropMarks } from './CropMarks.js';
import { Notify } from './Notify.js';
import { I18n } from '../settings/Translations.js';

export interface PdfVectorOptions {
  filename?: string;
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

    const cmykIntent = options.cmykOutputIntent ?? true;
    // Length/offset here are CropMarks.ts's own GAP/LEN constants converted
    // px(~96dpi) -> pt(72dpi), so a page that ALSO gets crop marks drawn by
    // the HTML/SVG-based export pipelines (PdfExport.ts, ImageExport.ts,
    // AgendaSvgExport.ts) looks the same physical size here.
    const cropMarkLengthPt = CropMarks.LEN * (72 / 96);
    const cropMarkOffsetPt = CropMarks.GAP * (72 / 96);

    const masterPdf = await PDFDocument.create();

    // Loop through each page in the document -- crop-marks/bleed config is
    // read per page off `pageEl.dataset` (CropMarks.ts, set via the "Marcas
    // de Corte" tab in Page Settings), NOT a single document-wide toggle,
    // so different pages in the same export can have different bleed/marks.
    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i];
      const pageSize: PageSize = PdfExport._parsePageSize(pageEl);
      const config = CropMarks.readConfig(pageEl);
      const cropMarks = config.enabled;
      const bleedMm = config.bleedMm;

      const trimW = PdfVectorExport._parseDimensionPt(pageSize.width, 595.28);
      const trimH = PdfVectorExport._parseDimensionPt(pageSize.height, 841.89);
      const bleedPt = (bleedMm / 25.4) * 72;

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

      // Step 6: Draw professional vector Crop Marks if requested -- style
      // (standard/cross/circle) and count (4/6) come from this page's own
      // CropMarks config, same geometry generator every other export
      // pipeline uses (CropMarks.buildGeometry()), just re-projected into
      // pdf-lib's bottom-up pt coordinate space.
      if (cropMarks) {
        CropMarks.drawPdfLibMarks(newPage, trimLeft, trimBottom, trimRight, trimTop, config, rgb(0, 0, 0));
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
