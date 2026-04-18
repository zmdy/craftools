export class ImageTransform {
    static applyTransform(element) {
        const meta = element._craftoolsMeta;
        if (!meta) return;
        
        const content = element.contentArea || element;
        const img = content.querySelector('img');
        if (!img) return;

        // Internal transform: Positioning (translate), Zoom (scale), and Internal Rotation
        img.style.transform = `translate(${meta.posX || 0}px, ${meta.posY || 0}px) scale(${meta.zoom || 1}) rotate(${meta.rotation || 0}deg)`;
        img.style.transformOrigin = 'center center';
    }

    static setupInteractions(element) {
        const content = element.contentArea;
        if (!content) return;
        
        content.style.overflow = 'hidden';

        // Helper state for dragging to prevent multiple bindings issues
        const dragData = {
            isPanning: false,
            startX: 0,
            startY: 0,
            initPosX: 0,
            initPosY: 0,
            hasMoved: false
        };

        // ZOOM and ROTATION via Wheel
        element.addEventListener('wheel', (e) => {
            if (!element._isImageActive) return; // Context check: only allow if panel is open!
            e.preventDefault();
            e.stopPropagation();
            
            const meta = element._craftoolsMeta;
            
            if (e.ctrlKey || e.metaKey) {
                // Rotation
                const delta = e.deltaY > 0 ? -2 : 2;
                meta.rotation = (meta.rotation || 0) + delta;
            } else {
                // Zoom
                const delta = e.deltaY > 0 ? -0.05 : 0.05;
                meta.zoom = Math.max(0.1, Math.min(10, (meta.zoom || 1) + delta));
            }
            
            this.applyTransform(element);
            if (element._syncSidebar) element._syncSidebar();
        }, { passive: false });

        // Double Click to enter/exit explicit pan mode (optional UI cue)
        content.addEventListener('dblclick', (e) => {
            if (!element._isImageActive) return;
            e.stopPropagation();
        });

        // PAN logic
        content.addEventListener('pointerdown', (e) => {
            if (!element._isImageActive) return; // Context check!
            
            dragData.isPanning = true;
            dragData.hasMoved = false;
            dragData.startX = e.clientX;
            dragData.startY = e.clientY;
            dragData.initPosX = element._craftoolsMeta.posX || 0;
            dragData.initPosY = element._craftoolsMeta.posY || 0;
            
            e.stopPropagation();
            content.style.cursor = 'grabbing';
            content.setPointerCapture(e.pointerId);
        });

        content.addEventListener('pointermove', (e) => {
            if (!dragData.isPanning) return;
            
            const dx = e.clientX - dragData.startX;
            const dy = e.clientY - dragData.startY;
            
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                dragData.hasMoved = true;
            }

            element._craftoolsMeta.posX = dragData.initPosX + dx;
            element._craftoolsMeta.posY = dragData.initPosY + dy;
            
            this.applyTransform(element);
            if (element._syncSidebar) element._syncSidebar();
        });

        const endPan = (e) => {
            if (!dragData.isPanning) return;
            dragData.isPanning = false;
            
            if (element._isImageActive) {
                content.style.cursor = 'move';
            } else {
                content.style.cursor = 'default';
            }
            if (e) content.releasePointerCapture(e.pointerId);
        };

        content.addEventListener('pointerup', endPan);
        content.addEventListener('pointercancel', endPan);

        // Deselect event to clean up context state
        element.addEventListener('craftools-element-deselect', () => {
             element._isImageActive = false;
             content.style.pointerEvents = 'none'; // Lock inner interactions safely
             content.style.cursor = 'default';
        });
    }
}
