export const GridSizes = [
    {
        name: "Etiquetas A4-90 (8 etiquetas)",
        cellWidth: 99.1,
        cellHeight: 67.8,
        cellPadding: "2 2 2 3", // top right bottom left (in mm)
        pageMargin: "12.9 5.9 12.9 5.9", // top right bottom left (in mm)
        cellGap: 0,
        sizes: ["210,297"] // Formato A4 vindo de Settings.js
    },
    {
        name: "Revelação - Fotos 5x5 com borda",
        cellWidth: 50.8,
        cellHeight: 50.8,
        cellPadding: "3 3 3 3",
        pageMargin: "0 0 0 0",
        cellGap: 0,
        sizes: ["210,297", "148,210", "297,420"] // A4, A5, A3
    },
    {
        name: "Revelação - Fotos 7x5 sem borda",
        cellWidth: 50.8,
        cellHeight: 76.2,
        cellPadding: "0 0 0 0",
        pageMargin: "0 0 0 0",
        cellGap: 0,
        sizes: ["210,297", "148,210"] // A4, A5
    },
    {
        name: "Revelação Polaroid",
        cellWidth: 76.2,
        cellHeight: 101.6,
        cellPadding: "5 5 25 5",
        pageMargin: "0 0 0 0",
        cellGap: 0,
        sizes: ["210,297", "297,420"] 
    },
    {
        name: "Revelação 10x15 - Com Borda",
        cellWidth: 101.6,
        cellHeight: 152.4,
        cellPadding: "3 3 3 3",
        pageMargin: "0 0 0 0",
        cellGap: 0,
        sizes: ["210,297", "297,420"]
    },
    {
        name: "Instagram Grid (Quadrado)",
        cellWidth: 360,
        cellHeight: 360,
        cellPadding: "0 0 0 0",
        pageMargin: "0 0 0 0",
        cellGap: 0,
        sizes: ["1080,1080"] // Social Media
    }
];
