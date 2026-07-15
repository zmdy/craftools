import { I18n } from "../../settings/Translations.js";
import { BaseTool } from "../BaseTool.js";
import { PanelUI } from "../../utils/PanelUI.js";
import { PaperPatterns } from "./PaperPatterns.js";
import { CommonProperties } from "../../utils/CommonProperties.js";
import "./PaperTool_Translations.js";

export const PaperThemes = {
    default: { bg: '#ffffff', line: '#a1a1aa' },
    night: { bg: '#1e1e2f', line: '#4a4a6a' },
    sepia: { bg: '#faf0d8', line: '#cca785' },
    vintage: { bg: '#fbf6e3', line: '#cca633' },
    pastel: { bg: '#faf5ff', line: '#d8b4fe' },
    classic: { bg: '#fefcf0', line: '#d2c7b5' },
    minimalist: { bg: '#fafafa', line: '#eaeaea' },
    ocean: { bg: '#f0f9ff', line: '#bae6fd' },
    forest: { bg: '#f0fdf4', line: '#bbf7d0' },
    sunset: { bg: '#fff7ed', line: '#fed7aa' },
    tech: { bg: '#09090b', line: '#14b8a6' },
    elegant: { bg: '#fafaf9', line: '#e7e5e4' },
    creative: { bg: '#fff7fe', line: '#f0abfc' }
};

export const PaperPresets = {
    a4: { name: "A4 (210 × 297 mm)", w: 210, h: 297, unit: "mm" },
    a5: { name: "A5 (148 × 210 mm)", w: 148, h: 210, unit: "mm" },
    a3: { name: "A3 (297 × 420 mm)", w: 297, h: 420, unit: "mm" },
    b4: { name: "B4 (250 × 353 mm)", w: 250, h: 353, unit: "mm" },
    b5: { name: "B5 (176 × 250 mm)", w: 176, h: 250, unit: "mm" },
    letter: { name: "Letter (216 × 279 mm)", w: 216, h: 279, unit: "mm" },
    legal: { name: "Legal (216 × 356 mm)", w: 216, h: 356, unit: "mm" },
    tabloid: { name: "Tabloid (279 × 432 mm)", w: 279, h: 432, unit: "mm" },
    executive: { name: "Executive (184 × 267 mm)", w: 184, h: 267, unit: "mm" },
    custom: { name: "Custom Size", w: 210, h: 297, unit: "mm" }
};

export class PaperTool extends BaseTool {
    
    static getCtxOptions() {
        return [];
    }

    static getDefaultMeta() {
        return {
            paperType: 'lined',
            paperSize: 'a4',
            theme: 'default',
            lineColor: '#a1a1aa',
            lineStyle: 'solid',
            lineSpacing: 8,
            lineWidth: 0.5,
            margins: {
                top: 25,
                right: 20,
                bottom: 25,
                left: 20
            },
            sidebar: {
                enabled: false
            },
            bgColor: '#ffffff',
            bgPattern: 'none',
            watermark: {
                enabled: false
            },
            logo: {
                enabled: false
            },
            pageSettings: {
                pageCount: 1,
                showPageNumber: false
            }
        };
    }

    static createElement(type, editorApp) {
        const el = document.createElement('craftools-element');
        el.setAttribute('data-craftool', 'papeis');
        // O papel de fundo fica travado por padrão -- diferente de todas as outras
        // ferramentas (que nascem destravadas) -- para não ser movido/redimensionado
        // sem querer por cima da página. Ver CommonProperties.js (toggle "Bloquear")
        // e Element.js (_syncLockUI) para o mecanismo genérico de bloqueio.
        el.setAttribute('data-locked', 'true');

        // Configurações padrão de papel
        const meta = this.getDefaultMeta();
        el._craftoolsMeta = meta;

        // Se houver uma página ativa no editor, ajustamos o papel ao tamanho total dela
        const activePage = editorApp.activePage || editorApp.querySelector('.craftools-page');
        let width = 210;
        let height = 297;
        let unit = 'mm';

        if (activePage) {
            const pageW = activePage.style.width || '210mm';
            const pageH = activePage.style.minHeight || '297mm';
            unit = pageW.replace(/[0-9.-]/g, '') || 'mm';
            width = parseFloat(pageW) || 210;
            height = parseFloat(pageH) || 297;
        }

        el.setAttribute('x', `0${unit}`);
        el.setAttribute('y', `0${unit}`);
        el.setAttribute('w', `${width}${unit}`);
        el.setAttribute('h', `${height}${unit}`);

        // O papel fica no fundo de tudo (z-index baixo)
        el.style.zIndex = '1';

        // Cria a div interna de conteúdo
        const innerDiv = document.createElement('div');
        innerDiv.className = 'paper-content-area';
        innerDiv.style.cssText = 'width:100%; height:100%; position:relative; overflow:hidden;';
        
        // Gera o SVG do papel
        innerDiv.innerHTML = PaperPatterns.generateSVG(meta, width, height);
        el.appendChild(innerDiv);

        return el;
    }

    static updatePaperSVG(element) {
        const meta = element._craftoolsMeta;
        if (!meta) return;

        const container = element.querySelector('.paper-content-area') || element.firstElementChild;
        if (container) {
            const w = element.pw || parseFloat(element.getAttribute('w')) || 210;
            const h = element.ph || parseFloat(element.getAttribute('h')) || 297;
            container.innerHTML = PaperPatterns.generateSVG(meta, w, h);
        }

        element.dispatchEvent(new CustomEvent('craftools-element-change', { bubbles: true, detail: { element } }));
    }
    // Legacy renderPropertiesPanel deleted.
    // Panel rendering is now schema-driven in PaperTool.ts via PropertyRenderer.
}
