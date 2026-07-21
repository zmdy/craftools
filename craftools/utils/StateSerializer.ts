export interface ElementState {
  id: string;
  type: string;
  cssText: string;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  contentHTML: string;
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
          if (['x', 'y', 'w', 'h', 'r', 'data-type', 'data-locked'].includes(attr.name)) {
            attributes[attr.name] = attr.value;
          }
        }
        
        // Element's first child is ALWAYS the content area (created by _build())
        const contentEl = htmlEl.children[0] as HTMLElement;
        const contentHTML = contentEl ? contentEl.innerHTML : '';
        
        const datasetObj: Record<string, string> = {};
        for (const [key, val] of Object.entries(htmlEl.dataset)) {
          if (val !== undefined) datasetObj[key] = val;
        }

        pageState.elements.push({
          id: htmlEl.dataset.ctId,
          type: htmlEl.dataset.type || htmlEl.tagName.toLowerCase(),
          cssText: htmlEl.style.cssText,
          dataset: datasetObj,
          attributes,
          contentHTML
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
          if (elState.attributes['data-type']) {
            el.dataset.type = elState.attributes['data-type'];
          }
          pageEl.appendChild(el);
          
          // Force connectedCallback and _build synchronous execution by reading a property
          // if it hasn't fired yet (Browsers usually fire it synchronously on appendChild, but just in case)
        } else {
          existingEls.delete(elState.id);
        }
        
        // 1. Restore attributes
        // First clear relevant old attributes to avoid leftovers
        ['x', 'y', 'w', 'h', 'r', 'data-type', 'data-locked'].forEach(attr => el!.removeAttribute(attr));
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
        
        // 3. Restore style
        el.style.cssText = elState.cssText;
        
        // 4. Restore Inner Content
        const contentEl = el.children[0] as HTMLElement;
        if (contentEl) {
          contentEl.innerHTML = elState.contentHTML;
        }
        
        // 5. Force custom element to visually update its transforms and UI handles
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
