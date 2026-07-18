/**
 * ImageTransform.ts
 */

export interface CraftoolsTransformEl extends HTMLElement {
  _craftoolsMeta?:   Record<string, any>;
  contentArea?:      HTMLElement;
  _isImageActive?:   boolean;
  _syncSidebar?:     () => void;
}

interface DragData {
  isPanning: boolean;
  startX:    number;
  startY:    number;
  initPosX:  number;
  initPosY:  number;
  hasMoved:  boolean;
}

export class ImageTransform {
  static applyTransform(element: CraftoolsTransformEl): void {
      const meta = element._craftoolsMeta;
      if (!meta) return;

      const content = element.contentArea || element;
      const img = content.querySelector('img');
      if (!img) return;

      // Internal transform: Positioning (translate), Zoom (scale), and Internal Rotation
      img.style.transform = `translate(${meta.posX || 0}px, ${meta.posY || 0}px) scale(${meta.zoom || 1}) rotate(${meta.rotation || 0}deg)`;
      img.style.transformOrigin = 'center center';
  }

  /**
   * Returns sibling image elements linked to this one (Album "cartão de
   * visita"/Business Card mode) -- via the shared `_linkedElements` array
   * (Album wizard multi-upload) or the `data-linked-id` attribute
   * (PageTool.ts's card-cloning logic). Deliberately duplicated from
   * ImageTool.ts's own private `_getLinkedSiblings()` instead of imported:
   * ImageTool.ts already imports this module (to call applyTransform()/
   * setupInteractions()), so importing back would be a circular dependency.
   * Keep both in sync if the linking mechanism ever changes.
   */
  private static _getLinkedSiblings(element: CraftoolsTransformEl & { _linkedElements?: HTMLElement[] }): HTMLElement[] {
      if (Array.isArray(element._linkedElements)) {
          return element._linkedElements.filter(el => el !== element);
      }
      const lid = element.getAttribute('data-linked-id');
      if (!lid) return [];
      return [...document.querySelectorAll<HTMLElement>(`craftools-element[data-linked-id="${lid}"]`)]
          .filter(el => el !== element);
  }

  /**
   * Propagates posX/posY/zoom/rotation to every linked sibling in real
   * time, live during the wheel/drag interaction itself -- previously only
   * panel-driven photo *swaps* (ImageTool.ts's `src` change) synced across
   * a linked Business Card set; adjusting the pan/zoom/rotation directly on
   * the canvas (this module's whole job) never touched siblings at all, so
   * e.g. a business card's front and back photo cells drifted out of sync
   * the moment you dragged/scrolled one of them.
   */
  private static _propagateToSiblings(element: CraftoolsTransformEl): void {
      const meta = element._craftoolsMeta;
      if (!meta) return;
      this._getLinkedSiblings(element).forEach(sibling => {
          const s = sibling as CraftoolsTransformEl;
          if (!s._craftoolsMeta) s._craftoolsMeta = {};
          s._craftoolsMeta.posX     = meta.posX;
          s._craftoolsMeta.posY     = meta.posY;
          s._craftoolsMeta.zoom     = meta.zoom;
          s._craftoolsMeta.rotation = meta.rotation;
          this.applyTransform(s);
      });
  }

  static setupInteractions(element: CraftoolsTransformEl): void {
      const content = element.contentArea;
      if (!content) return;
      
      content.style.overflow = 'hidden';

      // Helper state for dragging
      const dragData: DragData = {
          isPanning: false,
          startX: 0,
          startY: 0,
          initPosX: 0,
          initPosY: 0,
          hasMoved: false
      };

      // ZOOM and ROTATION via Wheel
      element.addEventListener('wheel', (e: WheelEvent) => {
          if (!element._isImageActive) return; // Context check: only allow if panel is open!
          e.preventDefault();
          e.stopPropagation();
          
          const meta = element._craftoolsMeta;
          if (!meta) return;
          
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
          this._propagateToSiblings(element);
          if (element._syncSidebar) element._syncSidebar();
      }, { passive: false });

      // Double Click to enter/exit explicit pan mode
      content.addEventListener('dblclick', (e: MouseEvent) => {
          if (!element._isImageActive) return;
          e.stopPropagation();
      });

      // PAN logic
      content.addEventListener('pointerdown', (e: PointerEvent) => {
          if (!element._isImageActive || !element._craftoolsMeta) return; // Context check!
          
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

      content.addEventListener('pointermove', (e: PointerEvent) => {
          if (!dragData.isPanning || !element._craftoolsMeta) return;
          
          const dx = e.clientX - dragData.startX;
          const dy = e.clientY - dragData.startY;
          
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
              dragData.hasMoved = true;
          }

          element._craftoolsMeta.posX = dragData.initPosX + dx;
          element._craftoolsMeta.posY = dragData.initPosY + dy;

          this.applyTransform(element);
          this._propagateToSiblings(element);
          if (element._syncSidebar) element._syncSidebar();
      });

      const endPan = (e: Event) => {
          if (!dragData.isPanning) return;
          dragData.isPanning = false;
          
          if (element._isImageActive) {
              content.style.cursor = 'move';
          } else {
              content.style.cursor = 'default';
          }
          if (e && e instanceof PointerEvent) {
            content.releasePointerCapture(e.pointerId);
          }
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
