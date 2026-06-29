export const GridSizes = [
    {
        name: "Kit 12fts. (4 polaroid + 8 mini)",
        type: "promo_kit",
        cellSlots: [
            { id: "polaroid", cellWidth: 70, cellHeight: 100, cellPadding: "3 3 23 3", cellCount: 4, slotLines: 2, slotColumns: 2, cellGap: 0, },
            { id: "mini", cellWidth: 50, cellHeight: 70, cellPadding: "3 3 18 3", cellCount: 8, slotLines: 3, slotColumns: 3, cellGap: 0, },
        ],
        pageMargin: "0 0 0 0",
        cellGap: 0,
        sizes: ["297,210", "297,420"]
    },
    {
        name: "Kit 12fts. (4 quadradas + 8 mini)",
        type: "promo_kit",
        cellSlots: [
            { id: "polaroid_quadrada", cellWidth: 70, cellHeight: 70, cellPadding: "3 3 23 3", cellCount: 4, slotLines: 2, slotColumns: 2, cellGap: 0, },
            { id: "mini", cellWidth: 50, cellHeight: 70, cellPadding: "3 3 18 3", cellCount: 8, slotLines: 3, slotColumns: 3, cellGap: 0, },
        ],
        pageMargin: "0 0 0 0",
        cellGap: 0,
        sizes: ["297,210", "297,420"]
    },
    {
        name: "Kit 20fts. (4 tirinhas + 8 mini)",
        type: "promo_kit",
        cellSlots: [
            { id: "strip1", cellWidth: 50, cellHeight: 148, cellPadding: "3 3 18 3", cellCount: 4, cellGap: 2, cellLines: 3, cellColumns: 1, cellSpacing: 3, cellGap: 0, },
            { id: "mini", cellWidth: 50, cellHeight: 70, cellPadding: "3 3 18 3", cellCount: 8,  cellGap: 0, },
        ],
        pageMargin: "5 2 5 2",
        cellGap: 0,
        sizes: ["210,297", "297,420"]
    },
    {
        name: "Kit 12fts. (2 tirinhas + 2 polaroid + 4 mini)",
        type: "promo_kit",
        cellSlots: [
            { id: "strip1", cellWidth: 50, cellHeight: 148, cellPadding: "3 3 18 3", cellCount: 2, cellGap: 2, cellLines: 3, cellColumns: 1, cellSpacing: 3, cellGap: 0, },
            { id: "mini", cellWidth: 50, cellHeight: 70, cellPadding: "3 3 18 3", cellCount: 4,  cellGap: 0, slotLines: 2, slotColumns: 2},
            { id: "polaroid", cellWidth: 70, cellHeight: 100, cellPadding: "3 3 23 3", cellCount: 2, slotLines: 2, slotColumns: 2, cellGap: 0, }, 
        ],
        pageMargin: "0 0 0 0",
        cellGap: 5,
        sizes: ["210,297", "297,420"]
    },
    {
        name: "Kit 16fts. (4 tirinhas + 2 polaroid + 4 mini)",
        type: "promo_kit",
        cellSlots: [
            { id: "strip1", cellWidth: 50, cellHeight: 148, cellPadding: "3 3 18 3", cellCount: 4, cellGap: 2, cellLines: 3, cellColumns: 1, cellSpacing: 3, cellGap: 0, slotLines: 1, slotColumns: 4},
            { id: "polaroid", cellWidth: 70, cellHeight: 100, cellPadding: "3 3 23 3", cellCount: 2, cellGap: 0, }, 
            { id: "mini", cellWidth: 50, cellHeight: 70, cellPadding: "3 3 18 3", cellCount: 2,  cellGap: 0, slotLines: 2, slotColumns: 1,},
            
        ],
        pageMargin: "0 0 0 0",
        cellGap: 5,
        sizes: ["210,297", "297,420"]
    },
    {
        name: "Promo Kit (5x5, 5x7, 7x9)",
        type: "promo_kit",
        cellSlots: [
            { id: "g1", cellWidth: 50, cellHeight: 50, cellPadding: "3 3 3 3", cellCount: 6, cellGap: 0, },
            { id: "g2", cellWidth: 50, cellHeight: 70, cellPadding: "3 3 3 3", cellCount: 2, cellGap: 0, },
            { id: "g3", cellWidth: 70, cellHeight: 100, cellPadding: "3 3 3 3", cellCount: 2, cellGap: 0, }
        ],
        pageMargin: "20 15 15 15",
        cellGap: 2,
        sizes: ["210,297", "297,210", "297,420"]
    },
    {
        name: "Promo Kit + Tirinha (5x5 + tirinha 4x12)",
        type: "promo_kit",
        cellSlots: [
            { id: "strip1", cellWidth: 40, cellHeight: 120, cellPadding: "2 2 2 2", cellCount: 2, cellGap: 2, cellLines: 3, cellColumns: 1, cellSpacing: 2 },
            { id: "g1", cellWidth: 50, cellHeight: 50, cellPadding: "3 3 3 3", cellCount: 4, cellGap: 2 }
        ],
        pageMargin: "20 15 15 15",
        cellGap: 2,
        sizes: ["210,297", "297,210", "297,420"]
    },
    {
        name: "Promo Kit Aniversário (Tirinha 10x15 + Polaroids 7x9)",
        type: "promo_kit",
        cellSlots: [
            { id: "strip1", cellWidth: 100, cellHeight: 150, cellPadding: "3 3 3 3", cellCount: 1, cellGap: 2, cellLines: 2, cellColumns: 2, cellSpacing: 3 },
            { id: "g1", cellWidth: 70, cellHeight: 100, cellPadding: "3 3 23 3", cellCount: 2, cellGap: 2 }
        ],
        pageMargin: "20 15 15 15",
        cellGap: 2,
        sizes: ["210,297", "297,210", "297,420"]
    },
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
        name: "Fotos 7x7",
        cellWidth: 70,
        cellHeight: 70,
        cellPadding: "3 3 3 3", 
        pageMargin: "5 5 5 5", 
        cellGap: 0,
        sizes: ["297,210", , "297,420", ] 
    }, 
    {
        name: "Fotos 7x7 Sem borda",
        cellWidth: 70,
        cellHeight: 70,
        cellPadding: "0 0 0 0", 
        pageMargin: "5 5 5 5", 
        cellGap: 0,
        sizes: ["297,210", , "297,420", ] 
    }, 
    {
        name: "Fotos 7x7 Polaroid",
        cellWidth: 70,
        cellHeight: 70,
        cellPadding: "3 3 23 3", 
        pageMargin: "5 5 5 5", 
        cellGap: 0,
        sizes: ["297,210", , "297,420", ] 
    }, 
    {
        name: "Fotos 10x7 Polaroid",
        cellWidth: 70,
        cellHeight: 100,
        cellPadding: "3 3 23 3", 
        pageMargin: "5 5 5 5", 
        cellGap: 0,
        sizes: ["297,210", , "297,420", ] 
    }, 
    {
        name: "Fotos 10x7 Polaroid Horizontal",
        cellWidth: 100,
        cellHeight: 70,
        cellPadding: "3 3 18 3", 
        pageMargin: "5 5 5 5", 
        cellGap: 0,
        sizes: ["297,210", , "297,420", ] 
    },
    {
        name: "Fotos 10x7 Com Borda",
        cellWidth: 70,
        cellHeight: 100,
        cellPadding: "3 3 3 3", 
        pageMargin: "5 5 5 5", 
        cellGap: 0,
        sizes: ["297,210", , "297,420", ] 
    },
    {
        name: "Fotos 10x7 Sem Borda",
        cellWidth: 70,
        cellHeight: 100,
        cellPadding: "0 0 0 0", 
        pageMargin: "5 5 5 5", 
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
    },
];
