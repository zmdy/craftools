import { PaperThemes } from "./PaperTool.js"; // Importa os temas se necessário

export class PaperPatterns {
    
    /**
     * Gera o conteúdo interno do SVG (elementos gráficos e patterns) 
     * com base nas configurações da ferramenta de papel.
     */
    static generateSVG(meta, width, height) {
        const theme = meta.theme || 'default';
        const themeConfig = PaperThemes[theme] || PaperThemes['default'];
        
        // Cores do tema como fallback
        const bgColor = meta.bgColor || themeConfig.bg;
        const lineColor = meta.lineColor || themeConfig.line;
        
        const spacing = parseFloat(meta.lineSpacing) || 8;
        const lWidth = parseFloat(meta.lineWidth) || 0.5;
        const lStyle = meta.lineStyle || 'solid';
        
        // Configurar stroke-dasharray para estilo de linha
        let dashStyle = '';
        if (lStyle === 'dashed') {
            dashStyle = `${spacing * 0.5},${spacing * 0.3}`;
        } else if (lStyle === 'dotted') {
            dashStyle = `${lWidth},${spacing * 0.3}`;
        }

        const margins = (meta.margins || { top: 25, right: 20, bottom: 25, left: 20 });
        const mT = parseFloat(margins.top) || 0;
        const mR = parseFloat(margins.right) || 0;
        const mB = parseFloat(margins.bottom) || 0;
        const mL = parseFloat(margins.left) || 0;

        const availW = Math.max(0, width - mL - mR);
        const availH = Math.max(0, height - mT - mB);

        let svgContent = '';

        // 1. Cor de Fundo da Folha
        svgContent += `<rect width="100%" height="100%" fill="${bgColor}"/>`;

        // 2. Desenho do Padrão de Fundo Adicional (se houver)
        if (meta.bgPattern && meta.bgPattern !== 'none') {
            svgContent += this._renderBgPattern(meta.bgPattern, lineColor, width, height);
        }

        // 3. Renderizar Padrão de Escrita Específico (dentro da área útil das margens)
        const paperType = meta.paperType || 'lined';
        svgContent += `<g class="paper-writing-pattern">`;
        
        switch (paperType) {
            case 'lined':
                svgContent += this._renderLined(mL, mT, availW, availH, spacing, lineColor, lWidth, dashStyle);
                break;
            case 'vertical_lined':
                // Pautado com linha vertical de margem
                svgContent += this._renderLined(mL, mT, availW, availH, spacing, lineColor, lWidth, dashStyle);
                svgContent += `<line x1="${mL}" y1="0" x2="${mL}" y2="${height}" stroke="#ef4444" stroke-width="${lWidth * 1.5}"/>`;
                break;
            case 'grid':
                svgContent += this._renderGrid(mL, mT, availW, availH, spacing, lineColor, lWidth, dashStyle);
                break;
            case 'dot':
                svgContent += this._renderDot(mL, mT, availW, availH, spacing, lineColor, lWidth);
                break;
            case 'pink_millimeter_grid':
                svgContent += this._renderMillimeterGrid(mL, mT, availW, availH, lineColor, lWidth);
                break;
            case 'grid_lined_split':
                svgContent += this._renderSplitGrid(mL, mT, availW, availH, spacing, lineColor, lWidth, dashStyle);
                break;
            case 'music':
                svgContent += this._renderMusic(mL, mT, availW, availH, spacing, lineColor, lWidth);
                break;
            case 'guitar_tab':
                svgContent += this._renderGuitarTab(mL, mT, availW, availH, spacing, lineColor, lWidth);
                break;
            case 'ukulele_staff_tab':
                svgContent += this._renderUkulele(mL, mT, availW, availH, spacing, lineColor, lWidth);
                break;
            case 'guitar_chord_treble_staff':
                svgContent += this._renderGuitarChordStaff(mL, mT, availW, availH, spacing, lineColor, lWidth);
                break;
            case 'calligraphy':
                svgContent += this._renderCalligraphy(mL, mT, availW, availH, lineColor, lWidth);
                break;
            case 'cornell':
                svgContent += this._renderCornell(mL, mT, availW, availH, spacing, lineColor, lWidth, dashStyle, width, height);
                break;
            case 'isometric':
                svgContent += this._renderIsometric(mL, mT, availW, availH, spacing, lineColor, lWidth);
                break;
            case 'perspective_sketch':
                svgContent += this._renderPerspective(mL, mT, availW, availH, lineColor, lWidth);
                break;
            case 'hexagonal':
                svgContent += this._renderHexagonal(mL, mT, availW, availH, spacing, lineColor, lWidth);
                break;
            case 'seyes':
                svgContent += this._renderSeyes(mL, mT, availW, availH, lineColor, lWidth);
                break;
            case 'storyboard':
                svgContent += this._renderStoryboard(mL, mT, availW, availH, lineColor, lWidth);
                break;
            case 'blank':
            default:
                // Em branco, nada a desenhar
                break;
        }
        svgContent += `</g>`;

        // 4. Barra Lateral Guiada (se ativada independentemente do padrão)
        if (meta.sidebar && meta.sidebar.enabled) {
            svgContent += `<line x1="${mL}" y1="0" x2="${mL}" y2="${height}" stroke="#3b82f6" stroke-width="${lWidth * 1.5}" stroke-dasharray="4,2"/>`;
        }

        // 5. Linha para data no topo direito
        if (meta.basicOptions && meta.basicOptions.dateLine && mT > 10) {
            svgContent += `<g transform="translate(${width - mR - 65}, ${mT - 12})" style="font-family:'DM Sans', sans-serif; font-size: 8px; fill:${lineColor}; opacity: 0.85;">
                <text x="0" y="0">DATA / DATE:</text>
                <line x1="56" y1="2" x2="68" y2="2" stroke="${lineColor}" stroke-width="0.5"/>
                <text x="69" y="0">/</text>
                <line x1="74" y1="2" x2="86" y2="2" stroke="${lineColor}" stroke-width="0.5"/>
                <text x="87" y="0">/</text>
                <line x1="92" y1="2" x2="114" y2="2" stroke="${lineColor}" stroke-width="0.5"/>
            </g>`;
        }

        // 6. Logomarca no topo esquerdo
        if (meta.logo && meta.logo.enabled && mT > 10) {
            svgContent += `<g transform="translate(${mL}, ${mT - 14})" style="opacity: 0.6;">
                <circle cx="6" cy="6" r="5" fill="none" stroke="${lineColor}" stroke-width="1"/>
                <path d="M 3,6 L 9,6 M 6,3 L 6,9" stroke="${lineColor}" stroke-width="0.8"/>
                <text x="15" y="9" style="font-family:'DM Serif Display', serif; font-size: 9px; font-weight: bold; fill:${lineColor};">CrafTools</text>
            </g>`;
        }

        // 7. Marca d'água no fundo
        if (meta.watermark && meta.watermark.enabled) {
            svgContent += `<g transform="translate(${width / 2}, ${height / 2}) rotate(-45)" style="pointer-events: none; user-select: none;">
                <text text-anchor="middle" dominant-baseline="middle" 
                      style="font-family:'DM Sans', sans-serif; font-size: 24px; font-weight: 800; fill:${lineColor}; opacity: 0.05; letter-spacing: 4px;">
                    CRAFTOOLS
                </text>
            </g>`;
        }

        // 8. Número de página no rodapé
        if (meta.pageSettings && meta.pageSettings.showPageNumber && mB > 8) {
            // Nota: o número da página é calculado dinamicamente na renderização real.
            // Para o preview/estático, usamos um número de página fictício '1'.
            svgContent += `<text x="${width / 2}" y="${height - mB + 10}" text-anchor="middle"
                style="font-family:'DM Sans', sans-serif; font-size: 8px; fill:${lineColor}; opacity: 0.7;">1</text>`;
        }

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="display:block; overflow:hidden; position:absolute; inset:0;">${svgContent}</svg>`;
    }

    // ── Métodos de Renderização de Papéis ─────────────────────────────────────

    static _renderLined(x, y, w, h, spacing, color, width, dash) {
        let lines = '';
        const rows = Math.floor(h / spacing);
        for (let i = 1; i <= rows; i++) {
            const ly = y + i * spacing;
            lines += `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
        }
        return lines;
    }

    static _renderGrid(x, y, w, h, spacing, color, width, dash) {
        let lines = '';
        const rows = Math.floor(h / spacing);
        const cols = Math.floor(w / spacing);
        
        // Linhas horizontais
        for (let i = 0; i <= rows; i++) {
            const ly = y + i * spacing;
            lines += `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
        }
        // Linhas verticais
        for (let j = 0; j <= cols; j++) {
            const lx = x + j * spacing;
            lines += `<line x1="${lx}" y1="${y}" x2="${lx}" y2="${y + h}" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
        }
        return lines;
    }

    static _renderDot(x, y, w, h, spacing, color, width) {
        let dots = '';
        const rows = Math.floor(h / spacing);
        const cols = Math.floor(w / spacing);
        const r = Math.max(0.4, width * 1.5);
        for (let i = 0; i <= rows; i++) {
            const ly = y + i * spacing;
            for (let j = 0; j <= cols; j++) {
                const lx = x + j * spacing;
                dots += `<circle cx="${lx}" cy="${ly}" r="${r}" fill="${color}"/>`;
            }
        }
        return dots;
    }

    static _renderMillimeterGrid(x, y, w, h, color, width) {
        let lines = '';
        // 1mm = linhas finas, 5mm = médias, 10mm = fortes
        // Usamos rosa milimétrico padrão se a cor não for sobrescrita (ex: #f43f5e rosa escuro, #ffe4e6 rosa claro)
        const isDefaultColor = color === '#808080' || color === 'var(--text-secondary)';
        const c10 = isDefaultColor ? '#f43f5e' : color;
        const c5 = isDefaultColor ? '#fda4af' : color;
        const c1 = isDefaultColor ? '#ffe4e6' : color;

        // Desenhar a cada 1mm
        for (let d = 0; d <= w; d += 1) {
            const lx = x + d;
            const c = (d % 10 === 0) ? c10 : ((d % 5 === 0) ? c5 : c1);
            const sw = (d % 10 === 0) ? width * 1.5 : ((d % 5 === 0) ? width * 1.0 : width * 0.5);
            lines += `<line x1="${lx}" y1="${y}" x2="${lx}" y2="${y + h}" stroke="${c}" stroke-width="${sw}"/>`;
        }
        for (let d = 0; d <= h; d += 1) {
            const ly = y + d;
            const c = (d % 10 === 0) ? c10 : ((d % 5 === 0) ? c5 : c1);
            const sw = (d % 10 === 0) ? width * 1.5 : ((d % 5 === 0) ? width * 1.0 : width * 0.5);
            lines += `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${c}" stroke-width="${sw}"/>`;
        }
        return lines;
    }

    static _renderSplitGrid(x, y, w, h, spacing, color, width, dash) {
        let out = '';
        const splitX = x + w * 0.3; // 30% esquerda, 70% direita
        
        // Linha divisória vertical
        out += `<line x1="${splitX}" y1="${y}" x2="${splitX}" y2="${y + h}" stroke="${color}" stroke-width="${width * 1.5}"/>`;
        
        // Linhas pautadas direita
        const rows = Math.floor(h / spacing);
        for (let i = 1; i <= rows; i++) {
            const ly = y + i * spacing;
            out += `<line x1="${splitX}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
        }
        
        // Pautado largo no lado esquerdo (tópicos/sumários)
        const leftSpacing = spacing * 1.5;
        const leftRows = Math.floor(h / leftSpacing);
        for (let i = 1; i <= leftRows; i++) {
            const ly = y + i * leftSpacing;
            out += `<line x1="${x}" y1="${ly}" x2="${splitX}" y2="${ly}" stroke="${color}" stroke-width="${width * 0.7}" stroke-dasharray="2,2"/>`;
        }
        return out;
    }

    static _renderMusic(x, y, w, h, spacing, color, width) {
        let out = '';
        const lineSpacing = 2; // 2mm fixo para pauta de música
        const staffHeight = 4 * lineSpacing; // 8mm total da pauta
        const gapBetweenStaves = 14; // Espaço entre as pautas
        const step = staffHeight + gapBetweenStaves; // 22mm
        
        const count = Math.floor((h - staffHeight) / step) + 1;
        for (let s = 0; s < count; s++) {
            const sy = y + s * step;
            // 5 linhas horizontais
            for (let i = 0; i < 5; i++) {
                const ly = sy + i * lineSpacing;
                out += `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${color}" stroke-width="${width}"/>`;
            }
            // Clave de Sol (caractere Unicode posicionado)
            out += `<text x="${x + 2}" y="${sy + staffHeight - 1}" font-family="Noto Music, serif" font-size="12" fill="${color}" style="user-select:none;">𝄞</text>`;
            // Linha inicial de fechamento
            out += `<line x1="${x}" y1="${sy}" x2="${x}" y2="${sy + staffHeight}" stroke="${color}" stroke-width="${width * 1.5}"/>`;
            out += `<line x1="${x + w}" y1="${sy}" x2="${x + w}" y2="${sy + staffHeight}" stroke="${color}" stroke-width="${width * 1.5}"/>`;
        }
        return out;
    }

    static _renderGuitarTab(x, y, w, h, spacing, color, width) {
        let out = '';
        const lineSpacing = 2;
        const staffHeight = 5 * lineSpacing; // 10mm total
        const gap = 15;
        const step = staffHeight + gap;
        
        const count = Math.floor((h - staffHeight) / step) + 1;
        for (let s = 0; s < count; s++) {
            const sy = y + s * step;
            // 6 linhas
            for (let i = 0; i < 6; i++) {
                const ly = sy + i * lineSpacing;
                out += `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${color}" stroke-width="${width}"/>`;
            }
            // Texto TAB empilhado verticalmente
            out += `<g transform="translate(${x + 2}, ${sy + 1.2})" style="font-family:'monospace', sans-serif; font-size: 3.2px; font-weight: bold; fill:${color}; text-anchor:middle;">
                <text x="2" y="0">T</text>
                <text x="2" y="3">A</text>
                <text x="2" y="6">B</text>
            </g>`;
            // Linhas de fechamento
            out += `<line x1="${x}" y1="${sy}" x2="${x}" y2="${sy + staffHeight}" stroke="${color}" stroke-width="${width * 1.5}"/>`;
            out += `<line x1="${x + w}" y1="${sy}" x2="${x + w}" y2="${sy + staffHeight}" stroke="${color}" stroke-width="${width * 1.5}"/>`;
        }
        return out;
    }

    static _renderUkulele(x, y, w, h, spacing, color, width) {
        let out = '';
        const lineSpacing = 1.8;
        const staffH = 4 * lineSpacing; // 7.2mm
        const tabH = 3 * lineSpacing; // 5.4mm
        const split = 4; // gap entre pauta e tab
        const systemH = staffH + split + tabH; // 16.6mm
        const gap = 14;
        const step = systemH + gap;

        const count = Math.floor((h - systemH) / step) + 1;
        for (let s = 0; s < count; s++) {
            const sy = y + s * step;
            const tabY = sy + staffH + split;

            // 1. Pauta Superior (5 linhas)
            for (let i = 0; i < 5; i++) {
                const ly = sy + i * lineSpacing;
                out += `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${color}" stroke-width="${width}"/>`;
            }
            out += `<text x="${x + 2}" y="${sy + staffH - 1}" font-family="Noto Music, serif" font-size="10" fill="${color}">𝄞</text>`;

            // 2. Tablatura Inferior (4 linhas)
            for (let i = 0; i < 4; i++) {
                const ly = tabY + i * lineSpacing;
                out += `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${color}" stroke-width="${width}"/>`;
            }
            // TAB ukulele
            out += `<g transform="translate(${x + 2}, ${tabY + 1})" style="font-family:'monospace', sans-serif; font-size: 2.8px; font-weight: bold; fill:${color}; text-anchor:middle;">
                <text x="2" y="0">T</text>
                <text x="2" y="2.2">A</text>
                <text x="2" y="4.4">B</text>
            </g>`;

            // 3. Linha conectora vertical lateral
            out += `<line x1="${x}" y1="${sy}" x2="${x}" y2="${tabY + tabH}" stroke="${color}" stroke-width="${width * 1.5}"/>`;
            out += `<line x1="${x + w}" y1="${sy}" x2="${x + w}" y2="${tabY + tabH}" stroke="${color}" stroke-width="${width * 1.5}"/>`;
            
            // Colchete de junção de sistema à esquerda
            out += `<path d="M ${x + 1} ${sy} C ${x - 1} ${sy}, ${x - 1} ${tabY + tabH}, ${x + 1} ${tabY + tabH}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
        }
        return out;
    }

    static _renderGuitarChordStaff(x, y, w, h, spacing, color, width) {
        let out = '';
        const lineSpacing = 1.8;
        const staffH = 4 * lineSpacing; // 7.2mm
        const chordBoxH = 6; // Altura do box do acorde
        const split = 4;
        const systemH = staffH + split + chordBoxH;
        const gap = 12;
        const step = systemH + gap;

        const count = Math.floor((h - systemH) / step) + 1;
        for (let s = 0; s < count; s++) {
            const sy = y + s * step;
            const staffY = sy + chordBoxH + split;

            // 1. Acordes vazios (desenha 3 caixas de acorde simuladas acima da pauta)
            const numChords = 3;
            const chordSpacing = w / (numChords + 1);
            for (let c = 1; c <= numChords; c++) {
                const cx = x + c * chordSpacing - 4; // Centraliza a caixa de 8mm
                const cy = sy;
                
                // Caixa 5 strings × 4 frets (8mm × 6mm)
                // Linha de topo grossa (pestana)
                out += `<line x1="${cx}" y1="${cy}" x2="${cx + 8}" y2="${cy}" stroke="${color}" stroke-width="${width * 2}"/>`;
                // 4 linhas horizontais restantes
                for (let i = 1; i <= 4; i++) {
                    const ly = cy + i * 1.5;
                    out += `<line x1="${cx}" y1="${ly}" x2="${cx + 8}" y2="${ly}" stroke="${color}" stroke-width="${width * 0.7}"/>`;
                }
                // 6 linhas verticais (cordas)
                for (let j = 0; j < 6; j++) {
                    const lx = cx + j * 1.6;
                    out += `<line x1="${lx}" y1="${cy}" x2="${lx}" y2="${cy + 6}" stroke="${color}" stroke-width="${width * 0.7}"/>`;
                }
            }

            // 2. Pauta (5 linhas)
            for (let i = 0; i < 5; i++) {
                const ly = staffY + i * lineSpacing;
                out += `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${color}" stroke-width="${width}"/>`;
            }
            out += `<text x="${x + 2}" y="${staffY + staffH - 1}" font-family="Noto Music, serif" font-size="10" fill="${color}">𝄞</text>`;
            out += `<line x1="${x}" y1="${staffY}" x2="${x}" y2="${staffY + staffH}" stroke="${color}" stroke-width="${width * 1.5}"/>`;
            out += `<line x1="${x + w}" y1="${staffY}" x2="${x + w}" y2="${staffY + staffH}" stroke="${color}" stroke-width="${width * 1.5}"/>`;
        }
        return out;
    }

    static _renderCalligraphy(x, y, w, h, color, width) {
        let out = '';
        const topGuideline = 2; // ascendente
        const bodyH = 3;        // altura do 'x'
        const descGuideline = 2;// descendente
        const staffH = topGuideline + bodyH + descGuideline; // 7mm
        const gap = 10;
        const step = staffH + gap;

        const count = Math.floor((h - staffH) / step) + 1;
        for (let s = 0; s < count; s++) {
            const sy = y + s * step;

            // Fundo sombreado para o corpo central (altura do x)
            out += `<rect x="${x}" y="${sy + topGuideline}" width="${w}" height="${bodyH}" fill="${color}" fill-opacity="0.06"/>`;

            // 4 linhas horizontais
            out += `<line x1="${x}" y1="${sy}" x2="${x + w}" y2="${sy}" stroke="${color}" stroke-width="${width * 0.7}" stroke-dasharray="2,2"/>`; // Topo
            out += `<line x1="${x}" y1="${sy + topGuideline}" x2="${x + w}" y2="${sy + topGuideline}" stroke="${color}" stroke-width="${width}"/>`; // Médio superior
            out += `<line x1="${x}" y1="${sy + topGuideline + bodyH}" x2="${x + w}" y2="${sy + topGuideline + bodyH}" stroke="${color}" stroke-width="${width}"/>`; // Base
            out += `<line x1="${x}" y1="${sy + staffH}" x2="${x + w}" y2="${sy + staffH}" stroke="${color}" stroke-width="${width * 0.7}" stroke-dasharray="2,2"/>`; // Descendente

            // Linhas guias diagonais de inclinação a 55 graus
            const rad = 55 * Math.PI / 180;
            const dx = staffH / Math.tan(rad);
            for (let gx = x + 15; gx < x + w - 10; gx += 14) {
                out += `<line x1="${gx + dx}" y1="${sy}" x2="${gx}" y2="${sy + staffH}" stroke="${color}" stroke-width="${width * 0.5}" stroke-opacity="0.5" stroke-dasharray="1,2"/>`;
            }
        }
        return out;
    }

    static _renderCornell(x, y, w, h, spacing, color, width, dash, fullW, fullH) {
        let out = '';
        
        const headerH = 20; // 20mm
        const summaryH = 30; // 30mm
        const noteAreaH = h - headerH - summaryH;
        
        const splitX = x + w * 0.28; // 28% tópicos à esquerda
        
        // 1. Cabeçalho (Header)
        out += `<rect x="${x}" y="${y}" width="${w}" height="${headerH}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
        out += `<g transform="translate(${x + 4}, ${y + 6})" style="font-family:'DM Sans', sans-serif; font-size: 7px; fill:${color}; font-weight: bold; opacity:0.85;">
            <text x="0" y="0">SUBJECT / TEMA:</text>
            <line x1="72" y1="2" x2="${w - 8}" y2="2" stroke="${color}" stroke-width="0.5"/>
            
            <text x="0" y="8">NAME / NOME:</text>
            <line x1="60" y1="10" x2="${w * 0.6}" y2="10" stroke="${color}" stroke-width="0.5"/>
            
            <text x="${w * 0.65}" y="8">DATE / DATA:</text>
            <line x1="${w * 0.65 + 50}" y1="10" x2="${w - 8}" y2="10" stroke="${color}" stroke-width="0.5"/>
        </g>`;

        // 2. Divisores da Área Central (Tópicos vs Notas)
        const centerY = y + headerH;
        out += `<rect x="${x}" y="${centerY}" width="${w}" height="${noteAreaH}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
        out += `<line x1="${splitX}" y1="${centerY}" x2="${splitX}" y2="${centerY + noteAreaH}" stroke="${color}" stroke-width="${width * 1.5}"/>`;

        // Linhas pautadas na área de Notas (lado direito)
        const rows = Math.floor(noteAreaH / spacing);
        for (let i = 1; i < rows; i++) {
            const ly = centerY + i * spacing;
            out += `<line x1="${splitX}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
        }

        // Pautado muito sutil à esquerda (tópicos/percepções)
        const leftSpacing = spacing * 1.5;
        const leftRows = Math.floor(noteAreaH / leftSpacing);
        for (let i = 1; i < leftRows; i++) {
            const ly = centerY + i * leftSpacing;
            out += `<line x1="${x}" y1="${ly}" x2="${splitX}" y2="${ly}" stroke="${color}" stroke-width="${width * 0.5}" stroke-opacity="0.4" stroke-dasharray="1,2"/>`;
        }

        // 3. Sumário (Summary) no rodapé
        const summaryY = centerY + noteAreaH;
        out += `<rect x="${x}" y="${summaryY}" width="${w}" height="${summaryH}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
        out += `<text x="${x + 4}" y="${summaryY + 5}" style="font-family:'DM Sans', sans-serif; font-size: 6.5px; font-weight: bold; fill:${color}; opacity:0.85;">SUMMARY / RESUMO:</text>`;
        
        // Pautado no sumário
        const sumRows = Math.floor((summaryH - 6) / spacing);
        for (let i = 1; i <= sumRows; i++) {
            const ly = summaryY + 6 + i * spacing;
            out += `<line x1="${x + 4}" y1="${ly}" x2="${x + w - 4}" y2="${ly}" stroke="${color}" stroke-width="${width * 0.7}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
        }

        return out;
    }

    static _renderIsometric(x, y, w, h, spacing, color, width) {
        let out = '';
        // Altura do triângulo isométrico
        const hSpacing = spacing;
        const wSpacing = spacing * Math.sqrt(3);

        // 1. Linhas verticais
        for (let lx = x; lx <= x + w; lx += wSpacing) {
            out += `<line x1="${lx}" y1="${y}" x2="${lx}" y2="${y + h}" stroke="${color}" stroke-width="${width * 0.5}" stroke-opacity="0.5"/>`;
        }
        for (let lx = x + wSpacing / 2; lx <= x + w; lx += wSpacing) {
            out += `<line x1="${lx}" y1="${y}" x2="${lx}" y2="${y + h}" stroke="${color}" stroke-width="${width * 0.5}" stroke-opacity="0.3" stroke-dasharray="1,1"/>`;
        }

        // 2. Linhas diagonais a 30 graus (subindo) e 150 graus (descendo)
        // Usamos equações de reta para traçar todas as linhas diagonais que cruzam a área útil.
        // Espaçamento vertical entre interseções é hSpacing
        const stepY = hSpacing;
        
        // Para simplificar, desenhamos uma malha cruzada cobrindo um retângulo inflado
        const rad = 30 * Math.PI / 180;
        const slope = Math.tan(rad); // ~0.577

        // Diagonais subindo: y = slope * x + b
        // Diagonais descendo: y = -slope * x + b
        // Onde b varia em incrementos
        const startB = y - slope * (x + w);
        const endB = y + h;
        const stepB = hSpacing * 2;

        for (let b = startB - 100; b < endB + 100; b += stepB) {
            // Reta subindo
            // Ponto inicial (x_start, y_start) na margem esquerda (x) ou superior (y)
            const y1 = slope * x + b;
            const y2 = slope * (x + w) + b;
            
            // Clipa a reta dentro do box (x, y, w, h)
            if (!(y1 > y + h && y2 > y + h) && !(y1 < y && y2 < y)) {
                out += `<line x1="${x}" y1="${y1}" x2="${x + w}" y2="${y2}" stroke="${color}" stroke-width="${width * 0.7}" stroke-opacity="0.5"/>`;
            }

            // Reta descendo
            const yd1 = -slope * x + b;
            const yd2 = -slope * (x + w) + b;
            if (!(yd1 > y + h && yd2 > y + h) && !(yd1 < y && yd2 < y)) {
                out += `<line x1="${x}" y1="${yd1}" x2="${x + w}" y2="${yd2}" stroke="${color}" stroke-width="${width * 0.7}" stroke-opacity="0.5"/>`;
            }
        }
        return out;
    }

    static _renderPerspective(x, y, w, h, color, width) {
        let out = '';
        const cX = x + w / 2;
        const cY = y + h * 0.45; // Linha do horizonte a 45% do topo

        // Linha do Horizonte
        out += `<line x1="${x}" y1="${cY}" x2="${x + w}" y2="${cY}" stroke="${color}" stroke-width="${width * 1.5}"/>`;

        // Linhas de fuga (raios partindo do ponto de fuga central cX, cY)
        const stepAngle = 15; // 15 graus
        for (let angle = 15; angle < 180; angle += stepAngle) {
            if (angle === 90 || angle === 180) continue;
            const rad = angle * Math.PI / 180;
            
            // Vetor diretor
            const dx = Math.cos(rad);
            const dy = Math.sin(rad);
            
            // Estende a linha até as bordas
            // Encontra distância de colisão com o box
            const length = Math.max(w, h) * 1.5;
            out += `<line x1="${cX}" y1="${cY}" x2="${cX + dx * length}" y2="${cY + dy * length}" stroke="${color}" stroke-width="${width * 0.5}" stroke-opacity="0.4"/>`;
            out += `<line x1="${cX}" y1="${cY}" x2="${cX - dx * length}" y2="${cY - dy * length}" stroke="${color}" stroke-width="${width * 0.5}" stroke-opacity="0.4"/>`;
        }

        // Linhas horizontais com perspectiva (vão se aproximando ao chegar perto do horizonte cY)
        // Acima e abaixo do horizonte
        let dist = 8;
        const decay = 0.78; // Reduz o espaço a cada passo
        
        // Abaixo do horizonte
        let ly = cY + dist;
        while (ly < y + h) {
            out += `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${color}" stroke-width="${width * 0.7}" stroke-opacity="0.5"/>`;
            dist *= decay;
            if (dist < 0.8) dist = 0.8;
            ly += dist;
        }

        // Acima do horizonte
        dist = 8;
        ly = cY - dist;
        while (ly > y) {
            out += `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${color}" stroke-width="${width * 0.7}" stroke-opacity="0.4"/>`;
            dist *= decay;
            if (dist < 0.8) dist = 0.8;
            ly -= dist;
        }

        return out;
    }

    static _renderHexagonal(x, y, w, h, spacing, color, width) {
        let out = '';
        const size = spacing / 1.5; // Comprimento da aresta do hexágono
        const hexW = size * Math.sqrt(3);
        const hexH = size * 2;
        
        const stepX = hexW;
        const stepY = size * 1.5;

        const rows = Math.ceil(h / stepY) + 1;
        const cols = Math.ceil(w / stepX) + 1;

        for (let r = 0; r < rows; r++) {
            const ly = y + r * stepY;
            const odd = r % 2 === 1;
            const shiftX = odd ? hexW / 2 : 0;

            for (let c = 0; c < cols; c++) {
                const lx = x + c * stepX + shiftX;

                // Desenha apenas 3 arestas do hexágono para evitar duplicar linhas sobrepostas
                // Arestas: Top-right, Right, Bottom-right
                const x0 = lx;
                const y0 = ly - size / 2;
                const x1 = lx + hexW / 2;
                const y1 = ly - size;
                const x2 = lx + hexW;
                const y2 = ly - size / 2;
                const x3 = lx + hexW;
                const y3 = ly + size / 2;
                const x4 = lx + hexW / 2;
                const y4 = ly + size;

                // Apenas desenha se as coordenadas estiverem dentro da área útil (clip aproximado)
                if (x2 <= x + w && y3 <= y + h) {
                    out += `<path d="M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4}" fill="none" stroke="${color}" stroke-width="${width * 0.8}" stroke-opacity="0.65"/>`;
                }
            }
        }
        return out;
    }

    static _renderSeyes(x, y, w, h, color, width) {
        let out = '';
        
        // Seyes: Grade francesa clássica.
        // Linhas principais a cada 8mm (linha grossa azul/roxa ou lineColor)
        // Linhas verticais finas a cada 8mm
        // 3 linhas auxiliares horizontais intermediárias a cada 2mm (muito finas)
        const mainSpacing = 8;
        
        // Cores padrão Seyes se cor for padrão cinza
        const isDefault = color === '#808080' || color === 'var(--text-secondary)';
        const mainColor = isDefault ? '#4f46e5' : color; // Roxo/Azul
        const auxColor = isDefault ? '#93c5fd' : color;  // Azul claro
        const marginColor = '#ef4444'; // Margem vermelha clássica Seyes

        const rows = Math.floor(h / mainSpacing);
        const cols = Math.floor(w / mainSpacing);

        // 1. Linhas verticais Seyes (grade de 8mm)
        for (let j = 0; j <= cols; j++) {
            const lx = x + j * mainSpacing;
            out += `<line x1="${lx}" y1="${y}" x2="${lx}" y2="${y + h}" stroke="${auxColor}" stroke-width="${width * 0.4}" stroke-opacity="0.4"/>`;
        }

        // 2. Linhas horizontais principais e auxiliares
        for (let i = 0; i <= rows; i++) {
            const ly = y + i * mainSpacing;
            
            // Linha principal
            out += `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="${mainColor}" stroke-width="${width}"/>`;
            
            // 3 Linhas auxiliares acima da principal (só desenha se não passar o limite superior y)
            if (i < rows) {
                out += `<line x1="${x}" y1="${ly + 2}" x2="${x + w}" y2="${ly + 2}" stroke="${auxColor}" stroke-width="${width * 0.3}" stroke-opacity="0.6"/>`;
                out += `<line x1="${x}" y1="${ly + 4}" x2="${x + w}" y2="${ly + 4}" stroke="${auxColor}" stroke-width="${width * 0.3}" stroke-opacity="0.6"/>`;
                out += `<line x1="${x}" y1="${ly + 6}" x2="${x + w}" y2="${ly + 6}" stroke="${auxColor}" stroke-width="${width * 0.3}" stroke-opacity="0.6"/>`;
            }
        }

        // 3. Linha de margem clássica francesa vermelha (esquerda)
        out += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${marginColor}" stroke-width="${width * 1.5}"/>`;

        return out;
    }

    static _renderStoryboard(x, y, w, h, color, width) {
        let out = '';
        
        // Storyboard layout:
        // Exibe caixas de desenho proporcionais com linhas para legenda abaixo.
        // Calcula dinamicamente quantas caixas cabem:
        // Cada quadro de storyboard ocupa: L = 48mm, H = 27mm (proporção 16:9).
        // Mais 3 linhas pautadas abaixo dele para anotações = 8mm adicionais.
        // Altura total por quadro = 37mm. Espaço entre quadros = 8mm.
        const boxW = 54;
        const boxH = 30; // 16:9 ~ 1.8 ratio
        const textH = 8; // 3 linhas
        const frameTotalH = boxH + textH + 4; // ~44mm
        const frameTotalW = boxW;
        
        const gapX = 10;
        const gapY = 12;

        const numCols = Math.max(1, Math.floor((w + gapX) / (frameTotalW + gapX)));
        const numRows = Math.max(1, Math.floor((h + gapY) / (frameTotalH + gapY)));

        // Centraliza as caixas storyboard horizontalmente
        const paddingLeft = x + (w - (numCols * frameTotalW + (numCols - 1) * gapX)) / 2;
        const paddingTop = y + 4;

        for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
                const fx = paddingLeft + c * (frameTotalW + gapX);
                const fy = paddingTop + r * (frameTotalH + gapY);

                // 1. Moldura de Desenho (Retângulo do frame)
                out += `<rect x="${fx}" y="${fy}" width="${boxW}" height="${boxH}" fill="none" stroke="${color}" stroke-width="${width * 1.2}"/>`;
                
                // Pequeno ícone ou número do quadro no canto
                out += `<rect x="${fx}" y="${fy}" width="${7}" height="${5}" fill="${color}" fill-opacity="0.1"/>`;
                out += `<text x="${fx + 2.2}" y="${fy + 4}" font-family="sans-serif" font-weight="bold" font-size="3.5px" fill="${color}">${r * numCols + c + 1}</text>`;

                // 2. Linhas de legenda (3 linhas horizontais)
                const lineStartY = fy + boxH + 2;
                out += `<line x1="${fx}" y1="${lineStartY}" x2="${fx + boxW}" y2="${lineStartY}" stroke="${color}" stroke-width="${width * 0.6}" stroke-opacity="0.75"/>`;
                out += `<line x1="${fx}" y1="${lineStartY + 2.5}" x2="${fx + boxW}" y2="${lineStartY + 2.5}" stroke="${color}" stroke-width="${width * 0.6}" stroke-opacity="0.75"/>`;
                out += `<line x1="${fx}" y1="${lineStartY + 5.0}" x2="${fx + boxW}" y2="${lineStartY + 5.0}" stroke="${color}" stroke-width="${width * 0.6}" stroke-opacity="0.75"/>`;
            }
        }
        return out;
    }

    // ── Métodos Auxiliares ────────────────────────────────────────────────────

    static _renderBgPattern(patternType, color, width, height) {
        let patternContent = '';
        if (patternType === 'grid') {
            patternContent = `<pattern id="bg-pat-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <line x1="0" y1="10" x2="10" y2="10" stroke="${color}" stroke-width="0.3" stroke-opacity="0.15"/>
                <line x1="10" y1="0" x2="10" y2="10" stroke="${color}" stroke-width="0.3" stroke-opacity="0.15"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#bg-pat-grid)"/>`;
        } else if (patternType === 'dots') {
            patternContent = `<pattern id="bg-pat-dots" width="8" height="8" patternUnits="userSpaceOnUse">
                <circle cx="4" cy="4" r="0.5" fill="${color}" fill-opacity="0.25"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#bg-pat-dots)"/>`;
        } else if (patternType === 'lines') {
            patternContent = `<pattern id="bg-pat-lines" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="10" x2="10" y2="10" stroke="${color}" stroke-width="0.4" stroke-opacity="0.18"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#bg-pat-lines)"/>`;
        } else if (patternType === 'crosshatch') {
            patternContent = `<pattern id="bg-pat-cross" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="12" x2="12" y2="12" stroke="${color}" stroke-width="0.3" stroke-opacity="0.15"/>
                <line x1="12" y1="0" x2="12" y2="12" stroke="${color}" stroke-width="0.3" stroke-opacity="0.15"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#bg-pat-cross)"/>`;
        } else if (patternType === 'graph') {
            patternContent = `<pattern id="bg-pat-graph" width="20" height="20" patternUnits="userSpaceOnUse">
                <line x1="0" y1="20" x2="20" y2="20" stroke="${color}" stroke-width="0.4" stroke-opacity="0.2"/>
                <line x1="20" y1="0" x2="20" y2="20" stroke="${color}" stroke-width="0.4" stroke-opacity="0.2"/>
                <line x1="0" y1="10" x2="20" y2="10" stroke="${color}" stroke-width="0.2" stroke-opacity="0.1" stroke-dasharray="1,1"/>
                <line x1="10" y1="0" x2="10" y2="20" stroke="${color}" stroke-width="0.2" stroke-opacity="0.1" stroke-dasharray="1,1"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#bg-pat-graph)"/>`;
        }
        return patternContent;
    }
}
