export var Craftools_Settings =
{
    mediaTypes: {
        paper: {
            name: "Artes impressas",
            description: "Quero criar artes impressas",
            icon: "menu_book",
            sizes: [
                {
                    name: "A4",
                    icon: "stock_media",
                    description: "Indicado para Papel timbrado, agendas, certificados",
                    size: "210,297",
                    sizeUnit: "mm"
                },


                {
                    name: "A3",
                    icon: "stock_media",
                    description: "Cartazes, convites grandes, materiais dobrados",
                    size: "297,420",
                    sizeUnit: "mm"
                },

                {
                    name: "A5",
                    icon: "stock_media",
                    description: "Cartazes, convites grandes, materiais dobrados",
                    size: "148,210",
                    sizeUnit: "mm"
                },
            ]
        },
        screen: {
            name: "Editor de Fotos",
            description: "Quero editar fotos",
            icon: "photo_camera_back",
            sizes: [
                {
                    name: "*",
                    icon: "stock_media",
                    description: "Importe sua foto e comece a editar!",
                    size: "*",
                    sizeUnit: "*"
                }
            ]
        },
        socialMedia: {
            name: "Redes Sociais",
            description: "Quero criar artes para redes sociais",
            icon: "dataset_linked",
            sizes: [
                {
                    name: "Instagram - Quadrado",
                    icon: "stock_media",
                    description: "Vamos começar!",
                    size: "1080,1080",
                    sizeUnit: "px"
                }
            ]
        },
    }


};