export interface MediaTypeSize {
  key:        string;
  name:       string;
  icon:       string;
  description: string;
  size:       string;
  sizeUnit:   string;
}

export interface MediaType {
  name:        string;
  description: string;
  icon:        string;
  sizes:       MediaTypeSize[];
}

export interface CraftoolsSettingsShape {
  mediaTypes: Record<string, MediaType>;
}

export const Craftools_Settings: CraftoolsSettingsShape = {
    mediaTypes: {
        paper: {
            name: "Artes impressas",
            description: "Quero criar artes impressas",
            icon: "menu_book",
            sizes: [
                { key: "a4",          name: "A4",           icon: "stock_media", description: "Indicado para Papel timbrado, agendas, certificados", size: "210,297",  sizeUnit: "mm" },
                { key: "a4Landscape", name: "A4 Horizontal", icon: "stock_media", description: "Indicado para Papel timbrado, agendas, certificados", size: "297,210",  sizeUnit: "mm" },
                { key: "a6",          name: "A6",           icon: "stock_media", description: "Indicado para impressão de fotos",                    size: "105,148",  sizeUnit: "mm" },
                { key: "a5",          name: "A5",           icon: "stock_media", description: "Cartazes, convites grandes, materiais dobrados",       size: "148,210",  sizeUnit: "mm" },
                { key: "a3",          name: "A3",           icon: "stock_media", description: "Cartazes, convites grandes, materiais dobrados",       size: "297,420",  sizeUnit: "mm" },
            ],
        },
        screen: {
            name: "Editor de Fotos",
            description: "Quero editar fotos",
            icon: "photo_camera_back",
            sizes: [
                { key: "freeform", name: "*", icon: "stock_media", description: "Importe sua foto e comece a editar!", size: "*", sizeUnit: "*" },
            ],
        },
        socialMedia: {
            name: "Redes Sociais",
            description: "Quero criar artes para redes sociais",
            icon: "dataset_linked",
            sizes: [
                { key: "instagramSquare", name: "Instagram - Quadrado", icon: "stock_media", description: "Vamos começar!", size: "1080,1080", sizeUnit: "px" },
            ],
        },
    },
};
