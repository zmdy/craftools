export const GridSizes = [
    {
        name: "Fotos 5x5 com borda",
        cellWidth: 50,
        cellHeight: 50,
        cellPadding: "3 3 3 3", 
        pageMargin: "20 5 15 5", 
        cellGap: 0,
        sizes: ["105,148", "148,210", "210,297", "297,210", , "297,420", ] 
    },
    {
        name: "Fotos 5x5 sem borda",
        cellWidth: 50,
        cellHeight: 50,
        cellPadding: "0 0 0 0", 
        pageMargin: "20 5 15 5", 
        cellGap: 0,
        sizes: ["105,148", "148,210", "210,297", "297,210", , "297,420", ] 
    },
    {
        name: "Fotos 7x5 com borda",
        cellWidth: 50,
        cellHeight: 70,
        cellPadding: "3 3 3 3", 
        pageMargin: "10 5 5 5", 
        cellGap: 0,
        sizes: ["105,148", "148,210", "210,297", "297,210", , "297,420", ] 
    },
    {
        name: "Fotos 7x5 sem borda",
        cellWidth: 50,
        cellHeight: 70,
        cellPadding: "0 0 0 0", 
        pageMargin: "10 5 5 5", 
        cellGap: 0,
        sizes: ["105,148", "148,210", "210,297", "297,210", , "297,420", ] 
    },
    {
        name: "Fotos 7x5 mini polaroid",
        cellWidth: 50,
        cellHeight: 70,
        cellPadding: "3 3 18 3", 
        pageMargin: "10 5 5 5", 
        cellGap: 0,
        sizes: ["105,148", "148,210", "210,297", "297,210", , "297,420", ] 
    },
   {
        name: "Fotos 9x7 Polaroid",
        cellWidth: 70,
        cellHeight: 90,
        cellPadding: "3 3 23 3", 
        pageMargin: "10 5 5 10", 
        cellGap: 0,
        sizes: ["297,210", , "297,420", ] 
    }, 
    {
        name: "Fotos 9x7 Polaroid Instax",
        cellWidth: 70,
        cellHeight: 90,
        cellPadding: "3 3 13 3", 
        pageMargin: "10 5 5 10", 
        cellGap: 0,
        sizes: ["297,210", , "297,420", ] 
    }, 
    {
        name: "Fotos 9x7 Polaroid Horizontal",
        cellWidth: 90,
        cellHeight: 70,
        cellPadding: "3 3 18 3", 
        pageMargin: "10 5 5 10", 
        cellGap: 0,
        sizes: ["297,210", , "297,420", ] 
    },
    {
        name: "Fotos 9x7 Com Borda",
        cellWidth: 70,
        cellHeight: 90,
        cellPadding: "3 3 3 3", 
        pageMargin: "10 5 5 10", 
        cellGap: 0,
        sizes: ["297,210", , "297,420", ] 
    },
    {
        name: "Fotos 9x7 Sem Borda",
        cellWidth: 70,
        cellHeight: 90,
        cellPadding: "0 0 0 0", 
        pageMargin: "10 5 5 10", 
        cellGap: 0,
        sizes: ["297,210", , "297,420", ] 
    },
    {
        name: "Instagram Grid (Quadrado)",
        cellWidth: 360,
        cellHeight: 360,
        cellPadding: "0 0 0 0",
        pageMargin: "0 0 0 0",
        cellGap: 0,
        sizes: ["1080,1080"] // Social Media
    },
    // ── Photostrips ───────────────────────────────────────────────────────
    {
        name: "Tirinha 5x15 com borda",
        cellWidth: 50,       // largura total da stripe
        cellHeight: 150,     // altura total da stripe
        cellPadding: "3 3 3 3",
        pageMargin: "20 5 15 5",
        cellGap: 0,
        sizes: ["105,148", "148,210", "210,297", "297,210", "297,420"],
        cellLines: 3,        // 3 fotos verticalmente dentro da stripe
        cellColumns: 1 ,      // 1 coluna de fotos dentro da stripe,
        cellSpacing: 3,
    },
    {
        name: "Tirinha 10x15 com borda",
        cellWidth: 100,      // largura total da stripe
        cellHeight: 150,     // altura total da stripe
        cellPadding: "3 3 3 3",
        pageMargin: "20 5 15 5",
        cellGap: 0,
        sizes: ["148,210", "210,297", "297,210", "297,420"],
        cellLines: 2,        // 2 fotos verticalmente dentro da stripe
        cellColumns: 2,       // 2 fotos horizontalmente dentro da stripe
        cellSpacing: 3
    }
];
