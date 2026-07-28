export interface ElementState {
  id: string;
  type: string;
  cssText: string;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  contentHTML: string;
  /**
   * Inline style of the `.ct-bg-layer` div (BaseTool.ts's
   * _getOrCreateBgLayer()), if the element has one. That div is inserted as
   * the element's actual first DOM child the moment any Background field is
   * touched -- ahead of the real content area -- so it isn't part of
   * `contentHTML` or the outer element's own `cssText` and needs its own
   * slot here.
   */
  bgLayerCssText?: string;
  /**
   * Deep-cloned snapshot of element._craftoolsMeta (ImageTool, QRCodeTool,
   * BarcodeTool, etc.) at serialization time. Undefined for tools that don't
   * use _craftoolsMeta (Stamp, CurvedText — they mirror their state to
   * dataset.ctState instead, which is captured in `dataset`).
   */
  meta?: Record<string, unknown>;
}

export interface PageState {
  id: string;
  cssText: string;
  elements: ElementState[];
}

export interface EditorState {
  pages: PageState[];
}

/**
 * StateSerializer
 * Converts the canvas DOM into a lightweight JSON tree for History Manager,
 * solving the huge RAM overhead of saving 10 copies of raw HTML strings.
 * Also performs DOM reconciliation to update elements in-place without destroying
 * their event listeners or in-memory caches when undoing/redoing.
 */
export class StateSerializer {
  
  /** Serializes the #pages-wrapper into a lightweight JSON tree. */
  static serialize(pagesWrapper: HTMLElement): EditorState {
    const state: EditorState = { pages: [] };
    
    pagesWrapper.querySelectorAll('.craftools-page').forEach((pageEl: Element) => {
      const pageHtmlEl = pageEl as HTMLElement;
      if (!pageHtmlEl.dataset.ctId) {
        pageHtmlEl.dataset.ctId = 'page-' + Math.random().toString(36).substring(2, 9);
      }
      
      const pageState: PageState = {
        id: pageHtmlEl.dataset.ctId,
        cssText: pageHtmlEl.style.cssText,
        elements: []
      };
      
      pageHtmlEl.querySelectorAll('craftools-element').forEach((el: Element) => {
        const htmlEl = el as HTMLElement;
        if (!htmlEl.dataset.ctId) {
          htmlEl.dataset.ctId = 'el-' + Math.random().toString(36).substring(2, 9);
        }
        
        // Grab attributes we care about for the element positioning and type
        const attributes: Record<string, string> = {};
        for (const attr of htmlEl.attributes) {
          if (['x', 'y', 'w', 'h', 'r', 'data-craftool', 'data-locked'].includes(attr.name)) {
            attributes[attr.name] = attr.value;
          }
        }
        
        // NOT necessarily children[0] -- BaseTool._getOrCreateBgLayer() inserts
        // a `.ct-bg-layer` div as the element's real first child the moment any
        // Background field is touched, ahead of the content area built by
        // Element.ts's _build(). Craftools_Element exposes a stable
        // `contentArea` accessor (backed by its private _content field)
        // specifically so callers don't have to guess by DOM position --
        // VariableContentTool.ts and AgendaExport.ts already special-case this
        // same hazard when locating an element's real content div.
        const contentEl = (htmlEl as unknown as { contentArea?: HTMLElement }).contentArea
          ?? (htmlEl.children[0] as HTMLElement | undefined);
        const contentHTML = contentEl ? contentEl.innerHTML : '';

        const bgLayer = htmlEl.querySelector<HTMLElement>(':scope > .ct-bg-layer');
        const bgLayerCssText = bgLayer ? bgLayer.style.cssText : undefined;

        const datasetObj: Record<string, string> = {};
        for (const [key, val] of Object.entries(htmlEl.dataset)) {
          if (val !== undefined) datasetObj[key] = val;
        }

        // _craftoolsMeta is a plain JS object property (not a DOM attribute or
        // dataset entry) used by ImageTool, QRCodeTool, BarcodeTool and others
        // to store tool-specific state. Deep-clone it so mutations after the
        // snapshot don't silently corrupt history.
        const craftoolsMeta = (htmlEl as HTMLElement & { _craftoolsMeta?: Record<string, unknown> })._craftoolsMeta;

        pageState.elements.push({
          id: htmlEl.dataset.ctId,
          type: htmlEl.getAttribute('data-craftool') || htmlEl.tagName.toLowerCase(),
          cssText: htmlEl.style.cssText,
          dataset: datasetObj,
          attributes,
          contentHTML,
          bgLayerCssText,
          meta: craftoolsMeta ? JSON.parse(JSON.stringify(craftoolsMeta)) : undefined,
        });
      });
      
      state.pages.push(pageState);
    });
    
    return state;
  }
  
  /** Reconciles the JSON tree back into the live DOM in-place. */
  static reconcile(pagesWrapper: HTMLElement, targetState: EditorState): void {
    const existingPages = new Map<string, HTMLElement>();
    pagesWrapper.querySelectorAll('.craftools-page').forEach((pageEl: Element) => {
      const p = pageEl as HTMLElement;
      if (p.dataset.ctId) existingPages.set(p.dataset.ctId, p);
    });
    
    const newPages: HTMLElement[] = [];
    
    for (const pageState of targetState.pages) {
      let pageEl = existingPages.get(pageState.id);
      
      if (!pageEl) {
        pageEl = document.createElement('section');
        pageEl.className = 'craftools-page';
        pageEl.dataset.ctId = pageState.id;

        // Pages usually have a specific structure, let's ensure the default empty content div exists
        // However, most of the time pages aren't deleted, just elements are.
        const pageContent = document.createElement('div');
        pageContent.style.cssText = 'display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 14px;';
        pageEl.appendChild(pageContent);

        // Connect the page to the live document RIGHT AWAY (final position
        // gets sorted out by the reordering pass below -- moving an
        // already-connected node within the same parent doesn't re-fire
        // custom element lifecycle callbacks, so this is safe to do before
        // ordering is settled). This matters a lot for what happens next:
        // every <craftools-element> appended below via `pageEl.appendChild(el)`
        // only gets its connectedCallback() (and therefore Element.ts's
        // _build(), which creates _content/contentArea) fired once IT is
        // connected to the *document* -- not merely appended to `pageEl`.
        // If `pageEl` were left detached until the old end-of-function
        // insertion, every element appended to it in the loop below would
        // stay uninitialized (no _content, contentArea undefined, no
        // ctrlbar/overlay) for the entire loop, and _build() would only
        // finally run once everything gets connected at the very end --
        // by which point contentHTML/bgLayerCssText restoration below has
        // already silently no-op'd against a still-missing content area.
        pagesWrapper.appendChild(pageEl);
      } else {
        existingPages.delete(pageState.id);
      }
      
      pageEl.style.cssText = pageState.cssText;
      newPages.push(pageEl);
      
      const existingEls = new Map<string, HTMLElement>();
      pageEl.querySelectorAll('craftools-element').forEach((el: Element) => {
        const e = el as HTMLElement;
        if (e.dataset.ctId) existingEls.set(e.dataset.ctId, e);
      });
      
      for (const elState of pageState.elements) {
        let el = existingEls.get(elState.id);
        
        if (!el) {
          el = document.createElement('craftools-element') as HTMLElement;
          el.dataset.ctId = elState.id;
          if (elState.attributes['data-craftool']) {
            el.setAttribute('data-craftool', elState.attributes['data-craftool']);
          }
          pageEl.appendChild(el);
          
          // Force connectedCallback and _build synchronous execution by reading a property
          // if it hasn't fired yet (Browsers usually fire it synchronously on appendChild, but just in case)
        } else {
          existingEls.delete(elState.id);
        }
        
        // 1. Restore attributes
        // First clear relevant old attributes to avoid leftovers
        ['x', 'y', 'w', 'h', 'r', 'data-craftool', 'data-locked'].forEach(attr => el!.removeAttribute(attr));
        for (const [key, val] of Object.entries(elState.attributes)) {
          el.setAttribute(key, val);
        }
        
        // 2. Restore dataset
        // Clear dataset keys that no longer exist
        Object.keys(el.dataset).forEach(key => {
          if (!(key in elState.dataset)) delete el!.dataset[key];
        });
        for (const [key, val] of Object.entries(elState.dataset)) {
          el.dataset[key] = val;
        }
        
        // 3. Restore in-memory tool state objects
        // _craftoolsMeta: used by ImageTool, QRCodeTool, BarcodeTool, etc.
        // Without this, editing properties after an undo would use the stale
        // pre-undo meta as the base, silently discarding the undone changes.
        if (elState.meta) {
          (el as HTMLElement & { _craftoolsMeta?: Record<string, unknown> })._craftoolsMeta =
            JSON.parse(JSON.stringify(elState.meta));
        }
        // _ctState: used by StampTool and CurvedTextTool (mirrored to
        // dataset.ctState on every write, so it's implicitly in `dataset`
        // above -- re-parse it here so _applyProperty()'s
        // `if (!e._ctState)` guard doesn't fall back to DEFAULT_STATE()).
        if (el.dataset.ctState) {
          try {
            (el as HTMLElement & { _ctState?: unknown })._ctState = JSON.parse(el.dataset.ctState);
          } catch { /* corrupted ctState -- leave _ctState as-is */ }
        }

        // 4. Restore style
        el.style.cssText = elState.cssText;

        // 5. Restore Inner Content -- via contentArea, not children[0] (see
        // serialize()'s comment re: .ct-bg-layer shifting the real content
        // div to children[1] once a Background field has ever been touched).
        const contentEl = (el as unknown as { contentArea?: HTMLElement }).contentArea
          ?? (el.children[0] as HTMLElement | undefined);
        if (contentEl) {
          contentEl.innerHTML = elState.contentHTML;
        }

        // 5a. Restore the background layer, if the element had one -- same
        // insertion convention as BaseTool._getOrCreateBgLayer() (always the
        // element's first DOM child).
        if (elState.bgLayerCssText) {
          let bgLayer = el.querySelector<HTMLElement>(':scope > .ct-bg-layer');
          if (!bgLayer) {
            bgLayer = document.createElement('div');
            bgLayer.className = 'ct-bg-layer';
            el.insertBefore(bgLayer, el.firstChild);
          }
          bgLayer.style.cssText = elState.bgLayerCssText;
        }

        // 5b. Sync Craftools_Element's internal transform fields (px/py/pw/ph/pr
        // + unit strings) from the attributes just restored above.
        // Craftools_Element (Element.ts) only ever parses x/y/w/h/r into these
        // fields once, inside connectedCallback() -- there's no
        // attributeChangedCallback, so setAttribute() alone (step 1) never
        // updates them. For a brand-new node, connectedCallback already fired
        // during appendChild() above (before attributes were restored), seeding
        // defaults (50/50/200/80/0); for a reused node (undo/redo), it fired
        // long ago with whatever position it had at creation time. Either way,
        // without this step _applyTransform() below repaints using stale
        // values instead of the ones we just restored, which visually
        // collapses every element to the same default box.
        const anyEl = el as unknown as {
          px: number; py: number; pw: number; ph: number; pr: number;
          unitX: string; unitY: string; unitW: string; unitH: string;
        };
        const rawX = elState.attributes['x'] || '50';
        const rawY = elState.attributes['y'] || '50';
        const rawW = elState.attributes['w'] || '200';
        const rawH = elState.attributes['h'] || '80';
        anyEl.unitX = rawX.replace(/[0-9.-]/g, '') || 'px';
        anyEl.unitY = rawY.replace(/[0-9.-]/g, '') || 'px';
        anyEl.unitW = rawW.replace(/[0-9.-]/g, '') || 'px';
        anyEl.unitH = rawH.replace(/[0-9.-]/g, '') || 'px';
        anyEl.px = parseFloat(rawX);
        anyEl.py = parseFloat(rawY);
        anyEl.pw = parseFloat(rawW);
        anyEl.ph = parseFloat(rawH);
        anyEl.pr = parseFloat(elState.attributes['r'] ?? '') || 0;

        // 6. Force custom element to visually update its transforms and UI handles
        if (typeof (el as any)._applyTransform === 'function') {
           (el as any)._applyTransform();
        }
      }
      
      // Remove elements that were in DOM but not in the new state (deleted by undo)
      for (const orphanedEl of existingEls.values()) {
        orphanedEl.remove();
      }
    }
    
    // Remove pages that were in DOM but not in state
    for (const orphanedPage of existingPages.values()) {
      orphanedPage.remove();
    }
    
    // Ensure correct page ordering in the DOM without re-creating nodes
    let currentChild = pagesWrapper.firstElementChild;
    for (const page of newPages) {
      if (currentChild !== page) {
        pagesWrapper.insertBefore(page, currentChild);
      } else {
        currentChild = currentChild.nextElementSibling;
      }
    }
  }
}
