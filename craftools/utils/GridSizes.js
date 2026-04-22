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
        name: "Fotos 5x5 com borda",
        cellWidth: 50,
        cellHeight: 50,
        cellPadding: "3 3 3 3", 
        pageMargin: "20 5 15 5", 
        cellGap: 0,
        sizes: ["148,210", "210,297", "297,420", ] 
    },
    {
        name: "Fotos 5x5 sem borda",
        cellWidth: 50,
        cellHeight: 50,
        cellPadding: "0 0 0 0", 
        pageMargin: "20 5 15 5", 
        cellGap: 0,
        sizes: ["148,210", "210,297", "297,420", ] 
    },
    {
        name: "Fotos 7x5 com borda",
        cellWidth: 50,
        cellHeight: 70,
        cellPadding: "3 3 3 3", 
        pageMargin: "10 5 5 5", 
        cellGap: 0,
        sizes: ["148,210", "210,297", "297,420", ] 
    },
    {
        name: "Fotos 7x5 sem borda",
        cellWidth: 50,
        cellHeight: 70,
        cellPadding: "0 0 0 0", 
        pageMargin: "10 5 5 5", 
        cellGap: 0,
        sizes: ["148,210", "210,297", "297,420", ] 
    },
    {
        name: "Fotos 7x5 mini polaroid",
        cellWidth: 50,
        cellHeight: 70,
        cellPadding: "3 3 18 3", 
        pageMargin: "10 5 5 5", 
        cellGap: 0,
        sizes: ["148,210", "210,297", "297,420", ] 
    },
   {
        name: "Fotos 9x7 Polaroid",
        cellWidth: 70,
        cellHeight: 90,
        cellPadding: "3 3 23 3", 
        pageMargin: "10 5 5 10", 
        cellGap: 0,
        sizes: ["148,210", "210,297", "297,420", ] 
    }, 
    {
        name: "Fotos 9x7 Polaroid Horizontal",
        cellWidth: 90,
        cellHeight: 70,
        cellPadding: "3 3 18 3", 
        pageMargin: "10 5 5 10", 
        cellGap: 0,
        sizes: ["148,210", "210,297", "297,420", ] 
    },
    {
        name: "Fotos 9x7 Polaroid Revelada",
        cellWidth: 70,
        cellHeight: 90,
        cellPadding: "3 3 3 3", 
        pageMargin: "10 5 5 10", 
        cellGap: 0,
        sizes: ["148,210", "210,297", "297,420", ] 
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
