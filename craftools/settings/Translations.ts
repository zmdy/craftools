declare global {
    interface Window {
        craftoolsLang?: string;
    }
}

type TranslationDict = Record<string, unknown>;

export const Translations: Record<string, TranslationDict> = {
    "pt-br": {
        setup: {
            title: "O que você quer criar?",
            subtitle: "Selecione uma categoria abaixo para começar",
            chooseSize: "Escolha o tamanho",
            availableSizes: "Tamanhos disponíveis para",
            back: "Voltar",
            welcome: "Bem-vindo ao CrafTools!"
        },
        editor: {
            newPage: "Nova Pág",
            generator: "Gerador de Templates",
            toolTitle: "Título",
            text: "Texto",
            image: "Imagem",
            album: "Álbum",
            qrcode: "QR Code",
            barcode: "Código de Barras",
            papers: "Papéis",
            panelTitle: "Ferramenta",
            emptyPanel: "Opções para esta ferramenta em breve...",
            zoomOut: "Menos Zoom",
            zoomIn: "Mais Zoom",
            zoomReset: "Resetar Zoom",
            themeToggle: "Alternar tema",
            moreOptions: "Mais opções",
            page: "Página",
            tools: "Ferramentas",
            exportPdf: "Exportar PDF",
            agendaExport: "Exportar Agenda",
            calendarTool: "Calendário",
            miniCalendar: "Mini Calendário",
            emojiKitchen: "Emoji Kitchen",
            emoji: "Emojis",
            variableContent: "Conteúdo Variável",
            icons: "Ícones",
            newPageSidebar: "Nova Página",
            papers2: "Papéis / Temas",
            undoTitle: "Desfazer (Ctrl+Z)",
            redoTitle: "Refazer (Ctrl+Y)",
            historyIndicatorTitle: "Ações guardadas no histórico de desfazer/refazer",
            historyIndicatorDetail: "Histórico de desfazer/refazer: {c} de {m} ações guardadas (limite máximo)",
            selectLanguage: "Selecionar Idioma",
            panelSubtitle: "Tecnologia para criatividade",
            sectionPagesFiles: "Páginas e Arquivos",
            searchTools: "Buscar ferramentas...",
            noToolsFound: "Nenhuma ferramenta encontrada",
            imageSlicer: "Fatiador de Imagem",
            curvedText: "Texto em Curva",
            stamp: "Carimbo / Selo"
        },
        mediaTypes: {
            paper: "Artes impressas",
            paperDesc: "Quero criar artes impressas",
            screen: "Editor de Fotos",
            screenDesc: "Quero editar fotos",
            socialMedia: "Redes Sociais",
            socialMediaDesc: "Quero criar artes para redes sociais"
        },
        common: {
            confirm: "Confirmar",
            cancel: "Cancelar",
            delete: "Excluir",
            bringForward: "Para frente",
            sendBackward: "Para trás",
            moveUp: "Subir",
            moveDown: "Descer",
            duplicate: "Duplicar elemento",
            border: "Borda",
            borderNone: "Nenhuma",
            borderSolid: "Sólida",
            borderDashed: "Tracejada",
            borderDotted: "Pontilhada",
            borderColor: "Cor da Borda",
            borderWidth: "Largura da Borda",
            borderStyle: "Estilo da Borda",
            radius: "Arredondamento (px)",
            padding: "Espaçamento Interno (Padding)",
            margin: "Margem Externa (Margin)",
            top: "Topo",
            right: "Direita",
            bottom: "Base",
            left: "Esquerda",
            size: "Tamanho",
            position: "Posição",
            zindex: "Camada (Z-Index)",
            copyStyles: "Copiar Estilos",
            pasteStyles: "Colar Estilos",
            copy: "Copiar",
            paste: "Colar",
            copied: "Copiado",
            noStyleCopied: "Nenhum estilo copiado!",
            incompatibleStyleTypes: "Você só pode colar estilos entre elementos do mesmo tipo (ex: Imagem para Imagem).",
            sectionForma: "Forma (Borda, Margem...)",
            lock: "Bloquear",
            locked: "Bloqueado",
            lockElement: "Bloquear elemento (impede mover/redimensionar)",
            unlockElement: "Desbloquear elemento",
            sectionTamanho: "Tamanho & Posicionamento",
            autoFitText: "Ajustar tamanho automaticamente ao texto",
            enabled: "Ativado",
            disabled: "Desativado",
            all: "Todos",
            sectionEstilo: "Estilo",
            align: "Alinhar na página",
            alignLeft: "Alinhar à esquerda",
            alignCenterH: "Centralizar horizontalmente",
            alignRight: "Alinhar à direita",
            alignTop: "Alinhar no topo",
            alignCenterV: "Centralizar verticalmente",
            alignBottom: "Alinhar na base",
            borderRadius: "Arredondamento (px)",
            opacity: "Opacidade",
            shadow: "Sombra",
            shadowEnabled: "Ativar sombra",
            shadowColor: "Cor da sombra",
            alignment: "Alinhamento",
            textAlign: "Alinhar texto"
        },
        textTool: {
            typography: "Tipografia",
            color: "Cor"
        },
        barcodeTool: {
            format: "Formato",
            formatCode39: "Code 39 (texto/números)",
            formatEan13: "EAN-13 (produto, 12-13 dígitos)"
        },
        miniCalendarTool: {
            modeDiasSemana: "Apenas tabela de dias (com feriados marcados)",
            modeCalendario: "Calendário (cabeçalho + tabela de dias)",
            modeHeader: "Apenas cabeçalho (mês e ano)",
            modeHolidaysBox: "Apenas caixa de feriados",
            modeMoonBox: "Apenas caixa de fases da lua",
            modeCompleto1: "Calendário com feriados",
            modeCompleto2: "Calendário completo com fases da lua"
        },
        qrTool: {
            spotifyBarColor: "Cor do Código"
        },
        variablePanel: {
            title: "Texto Variável"
        },
        sessionRecovery: {
            title: "Sessão recuperada",
            message: "Detectamos uma sessão de trabalho não finalizada.",
            savedAt: "Salva em:",
            newProject: "Novo projeto",
            restoreSession: "Recuperar sessão"
        },
        sizes: {
            paper: {
                a4: "A4",
                a4Desc: "Indicado para Papel timbrado, agendas, certificados",
                a4Landscape: "A4 Horizontal",
                a4LandscapeDesc: "Indicado para Papel timbrado, agendas, certificados",
                a6: "A6",
                a6Desc: "Indicado para impressão de fotos",
                a5: "A5",
                a5Desc: "Cartazes, convites grandes, materiais dobrados",
                a3: "A3",
                a3Desc: "Cartazes, convites grandes, materiais dobrados"
            },
            screen: { freeform: "*", freeformDesc: "Importe sua foto e comece a editar!" },
            socialMedia: { instagramSquare: "Instagram - Quadrado", instagramSquareDesc: "Vamos começar!" }
        }
    },
    "en": {
        setup: {
            title: "What do you want to create?",
            subtitle: "Select a category below to start",
            chooseSize: "Choose size",
            availableSizes: "Available sizes for",
            back: "Back",
            welcome: "Welcome to CrafTools!"
        },
        editor: {
            newPage: "New Page",
            generator: "Template Generator",
            toolTitle: "Title",
            text: "Text",
            image: "Image",
            album: "Album",
            qrcode: "QR Code",
            barcode: "Barcode",
            papers: "Papers",
            panelTitle: "Tool",
            emptyPanel: "Options for this tool coming soon...",
            zoomOut: "Zoom Out",
            zoomIn: "Zoom In",
            zoomReset: "Reset Zoom",
            themeToggle: "Toggle theme",
            moreOptions: "More options",
            page: "Page",
            tools: "Tools",
            exportPdf: "Export PDF",
            agendaExport: "Export Agenda",
            calendarTool: "Calendar",
            miniCalendar: "Mini Calendar",
            emojiKitchen: "Emoji Kitchen",
            emoji: "Emojis",
            variableContent: "Variable Content",
            icons: "Icons",
            newPageSidebar: "New Page",
            papers2: "Papers / Themes",
            undoTitle: "Undo (Ctrl+Z)",
            redoTitle: "Redo (Ctrl+Y)",
            historyIndicatorTitle: "Actions saved in the undo/redo history",
            historyIndicatorDetail: "Undo/redo history: {c} of {m} actions saved (maximum limit)",
            selectLanguage: "Select Language",
            panelSubtitle: "Technology for Creativity",
            sectionPagesFiles: "Pages & Files",
            searchTools: "Search tools...",
            noToolsFound: "No tools found",
            imageSlicer: "Image Slicer",
            curvedText: "Curved Text",
            stamp: "Stamp / Seal"
        },
        mediaTypes: {
            paper: "Printed Arts",
            paperDesc: "I want to create printed arts",
            screen: "Photo Editor",
            screenDesc: "I want to edit photos",
            socialMedia: "Social Media",
            socialMediaDesc: "I want to create social media arts"
        },
        common: {
            confirm: "Confirm",
            cancel: "Cancel",
            delete: "Delete",
            bringForward: "Bring to Front",
            sendBackward: "Send to Back",
            moveUp: "Move Up",
            moveDown: "Move Down",
            duplicate: "Duplicate element",
            border: "Border",
            borderNone: "None",
            borderSolid: "Solid",
            borderDashed: "Dashed",
            borderDotted: "Dotted",
            borderColor: "Border Color",
            borderWidth: "Border Width",
            borderStyle: "Border Style",
            radius: "Roundness (px)",
            padding: "Padding",
            margin: "Margin",
            top: "Top",
            right: "Right",
            bottom: "Bottom",
            left: "Left",
            size: "Size",
            position: "Position",
            zindex: "Layer (Z-Index)",
            copyStyles: "Copy Styles",
            pasteStyles: "Paste Styles",
            copy: "Copy",
            paste: "Paste",
            copied: "Copied",
            noStyleCopied: "No style copied yet!",
            incompatibleStyleTypes: "You can only paste styles between elements of the same type (e.g. Image to Image).",
            sectionForma: "Shape (Border, Margin...)",
            lock: "Lock",
            locked: "Locked",
            lockElement: "Lock element (prevents moving/resizing)",
            unlockElement: "Unlock element",
            sectionTamanho: "Size & Position",
            autoFitText: "Automatically resize to fit text",
            enabled: "Enabled",
            disabled: "Disabled",
            all: "All",
            sectionEstilo: "Style",
            align: "Align on page",
            alignLeft: "Align left",
            alignCenterH: "Center horizontally",
            alignRight: "Align right",
            alignTop: "Align top",
            alignCenterV: "Center vertically",
            alignBottom: "Align bottom",
            borderRadius: "Roundness (px)",
            opacity: "Opacity",
            shadow: "Shadow",
            shadowEnabled: "Enable shadow",
            shadowColor: "Shadow color",
            alignment: "Alignment",
            textAlign: "Align text"
        },
        textTool: { typography: "Typography", color: "Color" },
        barcodeTool: { format: "Format", formatCode39: "Code 39 (text/numbers)", formatEan13: "EAN-13 (product, 12-13 digits)" },
        miniCalendarTool: {
            modeDiasSemana: "Days table only (with holidays marked)",
            modeCalendario: "Calendar (header + days table)",
            modeHeader: "Header only (month and year)",
            modeHolidaysBox: "Holidays box only",
            modeMoonBox: "Moon phases box only",
            modeCompleto1: "Calendar with holidays",
            modeCompleto2: "Full calendar with moon phases"
        },
        qrTool: { spotifyBarColor: "Code Color" },
        variablePanel: { title: "Variable Text" },
        sessionRecovery: {
            title: "Session recovered",
            message: "We detected an unfinished work session.",
            savedAt: "Saved at:",
            newProject: "New project",
            restoreSession: "Restore session"
        },
        sizes: {
            paper: {
                a4: "A4", a4Desc: "Great for letterhead, planners, certificates",
                a4Landscape: "A4 Landscape", a4LandscapeDesc: "Great for letterhead, planners, certificates",
                a6: "A6", a6Desc: "Great for printing photos",
                a5: "A5", a5Desc: "Posters, large invitations, folded materials",
                a3: "A3", a3Desc: "Posters, large invitations, folded materials"
            },
            screen: { freeform: "*", freeformDesc: "Import your photo and start editing!" },
            socialMedia: { instagramSquare: "Instagram - Square", instagramSquareDesc: "Let's get started!" }
        }
    },
    "es": {
        setup: {
            title: "¿Qué quieres crear?",
            subtitle: "Selecciona una categoría abajo para empezar",
            chooseSize: "Elige el tamaño",
            availableSizes: "Tamaños disponibles para",
            back: "Volver",
            welcome: "¡Bienvenido a CrafTools!"
        },
        editor: {
            newPage: "Nueva Pág.",
            generator: "Generador de Templates",
            toolTitle: "Título",
            text: "Texto",
            image: "Imagen",
            album: "Álbum",
            qrcode: "Código QR",
            barcode: "Código de Barras",
            papers: "Papeles",
            panelTitle: "Herramienta",
            emptyPanel: "Opciones para esta herramienta próximamente...",
            zoomOut: "Menos Zoom",
            zoomIn: "Más Zoom",
            zoomReset: "Restablecer Zoom",
            themeToggle: "Cambiar tema",
            moreOptions: "Más opciones",
            page: "Página",
            tools: "Herramientas",
            exportPdf: "Exportar PDF",
            agendaExport: "Exportar Agenda",
            calendarTool: "Calendario",
            miniCalendar: "Mini Calendario",
            emojiKitchen: "Emoji Kitchen",
            emoji: "Emojis",
            variableContent: "Contenido Variable",
            icons: "Iconos",
            newPageSidebar: "Nueva Página",
            papers2: "Papeles / Temas",
            undoTitle: "Deshacer (Ctrl+Z)",
            redoTitle: "Rehacer (Ctrl+Y)",
            historyIndicatorTitle: "Acciones guardadas en el historial de deshacer/rehacer",
            historyIndicatorDetail: "Historial de deshacer/rehacer: {c} de {m} acciones guardadas (límite máximo)",
            selectLanguage: "Seleccionar Idioma",
            panelSubtitle: "Tecnología para la creatividad",
            sectionPagesFiles: "Páginas y Archivos",
            searchTools: "Buscar herramientas...",
            noToolsFound: "No se encontraron herramientas",
            imageSlicer: "Cortador de Imagen",
            curvedText: "Texto Curvo",
            stamp: "Sello / Timbre"
        },
        mediaTypes: {
            paper: "Artes impresas",
            paperDesc: "Quiero crear artes impresas",
            screen: "Editor de Fotos",
            screenDesc: "Quiero editar fotos",
            socialMedia: "Redes Sociales",
            socialMediaDesc: "Quiero crear artes para redes sociales"
        },
        common: {
            confirm: "Confirmar",
            cancel: "Cancelar",
            delete: "Eliminar",
            bringForward: "Traer al frente",
            sendBackward: "Enviar al fondo",
            moveUp: "Subir",
            moveDown: "Bajar",
            duplicate: "Duplicar elemento",
            border: "Borde",
            borderNone: "Ninguna",
            borderSolid: "Sólido",
            borderDashed: "Discontinuo",
            borderDotted: "Punteado",
            borderColor: "Color del Borde",
            borderWidth: "Grosor del Borde",
            borderStyle: "Estilo del Borde",
            radius: "Redondeo (px)",
            padding: "Relleno Interno (Padding)",
            margin: "Margen Externo (Margin)",
            top: "Arriba",
            right: "Derecha",
            bottom: "Abajo",
            left: "Izquierda",
            size: "Tamaño",
            position: "Posición",
            zindex: "Capa (Z-Index)",
            copyStyles: "Copiar Estilos",
            pasteStyles: "Pegar Estilos",
            copy: "Copiar",
            paste: "Pegar",
            copied: "Copiado",
            noStyleCopied: "¡Ningún estilo copiado!",
            incompatibleStyleTypes: "Solo puedes pegar estilos entre elementos del mismo tipo (ej.: Imagen a Imagen).",
            sectionForma: "Forma (Borde, Margen...)",
            lock: "Bloquear",
            locked: "Bloqueado",
            lockElement: "Bloquear elemento (impide mover/redimensionar)",
            unlockElement: "Desbloquear elemento",
            sectionTamanho: "Tamaño y Posición",
            autoFitText: "Ajustar tamaño automáticamente al texto",
            enabled: "Activado",
            disabled: "Desactivado",
            all: "Todos",
            sectionEstilo: "Estilo",
            align: "Alinear en la página",
            alignLeft: "Alinear a la izquierda",
            alignCenterH: "Centrar horizontalmente",
            alignRight: "Alinear a la derecha",
            alignTop: "Alinear arriba",
            alignCenterV: "Centrar verticalmente",
            alignBottom: "Alinear abajo",
            borderRadius: "Redondeo (px)",
            opacity: "Opacidad",
            shadow: "Sombra",
            shadowEnabled: "Activar sombra",
            shadowColor: "Color de la sombra",
            alignment: "Alineación",
            textAlign: "Alinear texto"
        },
        textTool: { typography: "Tipografía", color: "Color" },
        barcodeTool: { format: "Formato", formatCode39: "Code 39 (texto/números)", formatEan13: "EAN-13 (producto, 12-13 dígitos)" },
        miniCalendarTool: {
            modeDiasSemana: "Solo tabla de días (con feriados marcados)",
            modeCalendario: "Calendario (encabezado + tabla de días)",
            modeHeader: "Solo encabezado (mes y año)",
            modeHolidaysBox: "Solo caja de feriados",
            modeMoonBox: "Solo caja de fases de la luna",
            modeCompleto1: "Calendario con feriados",
            modeCompleto2: "Calendario completo con fases de la luna"
        },
        qrTool: { spotifyBarColor: "Color del Código" },
        variablePanel: { title: "Texto Variable" },
        sessionRecovery: {
            title: "Sesión recuperada",
            message: "Detectamos una sesión de trabajo sin finalizar.",
            savedAt: "Guardada el:",
            newProject: "Nuevo proyecto",
            restoreSession: "Recuperar sesión"
        },
        sizes: {
            paper: {
                a4: "A4", a4Desc: "Ideal para papel timbrado, agendas, certificados",
                a4Landscape: "A4 Horizontal", a4LandscapeDesc: "Ideal para papel timbrado, agendas, certificados",
                a6: "A6", a6Desc: "Ideal para impresión de fotos",
                a5: "A5", a5Desc: "Carteles, invitaciones grandes, materiales plegados",
                a3: "A3", a3Desc: "Carteles, invitaciones grandes, materiales plegados"
            },
            screen: { freeform: "*", freeformDesc: "¡Importa tu foto y empieza a editar!" },
            socialMedia: { instagramSquare: "Instagram - Cuadrado", instagramSquareDesc: "¡Vamos a empezar!" }
        }
    }
};

export class I18n {
    static get currentLang(): string {
        return window.craftoolsLang ?? 'pt-br';
    }

    static set lang(val: string) {
        window.craftoolsLang = val;
        localStorage.setItem('craftools-lang', val);
    }

    static addTranslations(path: string, dict: Record<string, Record<string, unknown>>): void {
        for (const lang in dict) {
            if (!Translations[lang]) Translations[lang] = {};
            (Translations[lang] as Record<string, unknown>)[path] = dict[lang];
        }
    }

    static t(path: string): string {
        const lang  = this.currentLang;
        const keys  = path.split('.');
        let val: unknown = Translations[lang];

        for (const key of keys) {
            if (val !== null && typeof val === 'object' && key in (val as object)) {
                val = (val as Record<string, unknown>)[key];
            } else {
                return path; // fallback to path key
            }
        }
        return typeof val === 'string' ? val : path;
    }

    static init(): void {
        const saved = localStorage.getItem('craftools-lang');
        if (saved) {
            window.craftoolsLang = saved;
        } else {
            const nav = navigator.language ?? '';
            let lang = 'pt-br';
            if (nav.startsWith('es'))     lang = 'es';
            else if (nav.startsWith('en')) lang = 'en';
            window.craftoolsLang = lang;
        }
    }
}
