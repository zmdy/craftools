/**
 * CrafTools PdfExport Utility
 * Responsável por serializar todas as páginas do editor em um HTML autocontido,
 * aplicar as diretivas CSS @page corretas por tamanho de página, e disparar
 * window.print() via blob URL em uma nova janela.
 */
export class PdfExport {

    // ── Entry point ────────────────────────────────────────────────────────────
    static print(editor) {
        const pages = [...editor.querySelectorAll('.craftools-page')];
        if (!pages.length) {
            alert('Nenhuma página encontrada para exportar.');
            return;
        }

        // Coleta os tamanhos reais de cada página
        const pageSizes = pages.map(p => this._parsePageSize(p));

        // Gera o CSS global (fontes, reset, @page rules por tamanho único)
        const css = this._buildCSS(pageSizes);

        // Serializa cada página em HTML limpo (sem elementos de UI do editor)
        const pagesHtml = pages.map((page, i) =>
            this._serializePage(page, pageSizes[i])
        ).join('\n');

        const fullHtml = this._wrapDocument(css, pagesHtml);

        this._openPrintWindow(fullHtml);
    }

    // ── Detecta o tamanho real da página ──────────────────────────────────────
    static _parsePageSize(pageEl) {
        const w = pageEl.style.width   || '210mm';
        const h = pageEl.style.minHeight || '297mm';
        const bg = pageEl.style.background || pageEl.style.backgroundColor || '#ffffff';
        return { width: w, height: h, background: bg };
    }

    // ── CSS de impressão ───────────────────────────────────────────────────────
    static _buildCSS(pageSizes) {
        // Indexa tamanhos únicos para criar @page nomeados
        const sizeIndex = new Map(); // "WxH" -> { name, width, height }
        pageSizes.forEach(size => {
            const key = `${size.width}|${size.height}`;
            if (!sizeIndex.has(key)) {
                sizeIndex.set(key, {
                    name: `ct${sizeIndex.size}`,
                    width: size.width,
                    height: size.height
                });
            }
        });

        // @page rules nomeados para cada tamanho único
        let pageRules = '';
        sizeIndex.forEach(({ name, width, height }) => {
            pageRules += `
@page ${name} {
    size: ${width} ${height};
    margin: 0;
}
.print-page-${name} {
    page: ${name};
    width: ${width} !important;
    min-height: ${height} !important;
}`;
        });

        // Fallback global (garante que página única imprima certo)
        if (sizeIndex.size === 1) {
            const first = [...sizeIndex.values()][0];
            pageRules += `\n@page { size: ${first.width} ${first.height}; margin: 0; }`;
        } else {
            pageRules += `\n@page { margin: 0; }`;
        }

        return `
/* ─── Reset ─────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }
html, body {
    margin: 0;
    padding: 0;
    background: #ccc;
    font-family: 'DM Sans', 'Helvetica Neue', Arial, sans-serif;
}

/* ─── Página ─────────────────────────────────────────────────────────── */
.print-page {
    position: relative;
    overflow: hidden;
    background: white;
    break-after: page;
    page-break-after: always;
    /* Centraliza no preview */
    margin: 0 auto;
}
.print-page:last-child {
    break-after: avoid;
    page-break-after: avoid;
}

/* ─── Elemento (equivale ao craftools-element flattened) ────────────── */
.ct-el {
    position: absolute;
    top: 0;
    left: 0;
    overflow: hidden;
}
.ct-el-inner {
    position: absolute;
    inset: 0;
    overflow: hidden;
}

/* ─── Album Grid ─────────────────────────────────────────────────────── */
.craftools-grid-container {
    position: absolute;
    display: grid;
}
.craftools-grid-cell {
    position: relative;
    overflow: hidden;
}
.craftools-element-blur-bg {
    position: absolute;
    inset: -20px;
    background-size: cover;
    background-position: center;
    opacity: 0.6;
    pointer-events: none;
    z-index: -1;
}

/* ─── Imagem interna (zoom/pan via transform) ────────────────────────── */
img {
    display: block;
    max-width: none;
    pointer-events: none;
    user-select: none;
}

/* ─── Texto ──────────────────────────────────────────────────────────── */
[contenteditable] {
    outline: none;
    white-space: pre-wrap;
    word-break: break-word;
}

/* ─── @page nomeados ─────────────────────────────────────────────────── */
${pageRules}

/* ─── Garante que a tela de preview mostre as páginas separadas ──────── */
@media screen {
    body { padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
    .print-page { box-shadow: 0 4px 32px rgba(0,0,0,0.18); }
}
@media print {
    body { background: white !important; padding: 0; }
    .print-page { margin: 0; box-shadow: none; }
}
        `;
    }

    // ── Serializa 1 página ────────────────────────────────────────────────────
    static _serializePage(pageEl, size) {
        const clone = pageEl.cloneNode(true);

        // Remove elementos exclusivos da UI do editor
        clone.querySelectorAll([
            '.craftools-ctrlbar',
            '.album-drag-handle',
            '.craftools-sidebar-overlay',
        ].join(',')).forEach(el => el.remove());

        // Achata todos os <craftools-element> (Web Components) em divs regulares
        clone.querySelectorAll('craftools-element').forEach(el => this._flattenElement(el));

        // Determina a classe de @page nomeado para este tamanho
        const pageClass = `ct${this._sizeKey(size.width, size.height)}`;

        // Garante que o background da página seja preservado
        const bgStyle = size.background ? `background: ${size.background};` : '';

        // Monta o html final da página
        const inner = clone.innerHTML;
        return `<div class="print-page print-page-${pageClass}" style="width:${size.width}; min-height:${size.height}; ${bgStyle}">${inner}</div>`;
    }

    // ── Achata um <craftools-element> em divs regulares ──────────────────────
    static _flattenElement(elNode) {
        const transform = elNode.style.transform || '';
        const width     = elNode.style.width     || 'auto';
        const height    = elNode.style.height    || 'auto';
        const zIndex    = elNode.style.zIndex    || '2';
        const overflow  = elNode.style.overflow  || 'visible';

        const replacement = document.createElement('div');
        replacement.className = 'ct-el';
        replacement.style.cssText = `transform:${transform}; width:${width}; height:${height}; z-index:${zIndex}; overflow:${overflow};`;

        // 1. Check for Background Blur Layer
        const blurLayer = elNode.querySelector('.craftools-element-blur-bg');
        if (blurLayer) {
            replacement.appendChild(blurLayer.cloneNode(true));
        }

        // 2. Identify _content div (it's the one that is NOT a UI layer)
        // Usually it's the first child that isn't the blur layer or ctrlbar
        let contentDiv = null;
        for (const child of elNode.children) {
            if (!child.classList.contains('craftools-element-blur-bg') && 
                !child.classList.contains('craftools-ctrlbar') &&
                !child.classList.contains('craftools-sidebar-overlay')) {
                contentDiv = child;
                break;
            }
        }

        if (contentDiv) {
            const inner = document.createElement('div');
            inner.className = 'ct-el-inner';
            // Copia filhos reais
            [...contentDiv.childNodes].forEach(child => {
                if (child.nodeType === 1 || child.nodeType === 3) {
                    inner.appendChild(child.cloneNode(true));
                }
            });
            replacement.appendChild(inner);
        }

        elNode.replaceWith(replacement);
    }

    // ── Envolve tudo num documento HTML completo ──────────────────────────────
    static _wrapDocument(css, body) {
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Craftools</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
    <style>${css}</style>
</head>
<body>
${body}
<script>
    // Dispara o print assim que as fontes e imagens carregarem
    window.addEventListener('load', () => {
        // Ajusta o título do documento
        document.title =  "${this.createTitle()}" +  window.location.href.split('/').reverse()[0];

        // Pequeno delay para garantir renderização completa
        setTimeout(() => window.print(), 600);
    });
<\/script>
</body>
</html>`;
    }

    // ── Abre o blob em nova aba ───────────────────────────────────────────────
    static _openPrintWindow(html) {
        const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
        const url  = URL.createObjectURL(blob);

        const win = window.open(url, '_blank');
        if (!win) {
            alert('Seu navegador bloqueou a abertura da janela de impressão. Permita pop-ups para este site.');
            URL.revokeObjectURL(url);
            return;
        }

        // Limpa o blob após 60s (tempo suficiente para o print dialog)
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }

    // ── Helper: chave para map/class a partir de um tamanho ──────────────────
    static _sizeKey(w, h) {
        // Gera um hash numérico simples e curto baseado na string de tamanho
        const str = `${w}|${h}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
        }
        return hash.toString(36); // base36 para ficar curto
    }

    static createTitle() {
        const n = new Date();
        const pad = (v) => String(v).padStart(2, '0');
        return `Craftools - ${String(n.getFullYear()).slice(-2)}${pad(n.getMonth()+1)}${pad(n.getDate())}${pad(n.getHours())}${pad(n.getMinutes())} - `;
    }
}
