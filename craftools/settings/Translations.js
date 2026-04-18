export const Translations = {
    "pt-br": {
        setup: {
            title: "O que você quer criar?",
            subtitle: "Selecione uma categoria abaixo para começar",
            chooseSize: "Escolha o tamanho",
            availableSizes: "Tamanhos disponíveis para",
            back: "Voltar"
        },
        editor: {
            newPage: "Nova Pág",
            generator: "Gerador",
            text: "Texto",
            image: "Imagem",
            album: "Álbum",
            papers: "Papéis",
            panelTitle: "Ferramenta",
            emptyPanel: "Opções para esta ferramenta em breve...",
            zoomOut: "Menos Zoom",
            zoomIn: "Mais Zoom",
            zoomReset: "Resetar Zoom",
            themeToggle: "Alternar tema",
            page: "Página",
            tools: "Ferramentas"
        },
        mediaTypes: {
            paper: "Artes impressas",
            paperDesc: "Quero criar artes impressas",
            screen: "Editor de Fotos",
            screenDesc: "Quero editar fotos",
            socialMedia: "Redes Sociais",
            socialMediaDesc: "Quero criar artes para redes sociais"
        }
    },
    "en": {
        setup: {
            title: "What do you want to create?",
            subtitle: "Select a category below to start",
            chooseSize: "Choose size",
            availableSizes: "Available sizes for",
            back: "Back"
        },
        editor: {
            newPage: "New Page",
            generator: "Generator",
            text: "Text",
            image: "Image",
            album: "Album",
            papers: "Papers",
            panelTitle: "Tool",
            emptyPanel: "Options for this tool coming soon...",
            zoomOut: "Zoom Out",
            zoomIn: "Zoom In",
            zoomReset: "Reset Zoom",
            themeToggle: "Toggle theme",
            page: "Page",
            tools: "Tools"
        },
        mediaTypes: {
            paper: "Printed Arts",
            paperDesc: "I want to create printed arts",
            screen: "Photo Editor",
            screenDesc: "I want to edit photos",
            socialMedia: "Social Media",
            socialMediaDesc: "I want to create social media arts"
        }
    }
};

export class I18n {
    static get currentLang() {
        return window.craftoolsLang || "pt-br";
    }

    static set lang(val) {
        window.craftoolsLang = val;
        localStorage.setItem('craftools-lang', val);
    }

    static addTranslations(path, dict) {
        for (const lang in dict) {
            if (!Translations[lang]) Translations[lang] = {};
            Translations[lang][path] = dict[lang];
        }
    }

    static t(path) {
        const lang = this.currentLang;
        const keys = path.split('.');
        let translation = Translations[lang];
        
        for (const key of keys) {
            if (translation && translation[key]) {
                translation = translation[key];
            } else {
                return path; // Fallback to path if not found
            }
        }
        return translation;
    }

    static init() {
        const savedLang = localStorage.getItem('craftools-lang');
        if (savedLang) {
            window.craftoolsLang = savedLang;
        } else {
            const browserLang = navigator.language.startsWith('en') ? 'en' : 'pt-br';
            window.craftoolsLang = browserLang;
        }
    }
}
