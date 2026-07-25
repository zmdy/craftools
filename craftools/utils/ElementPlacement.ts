/**
 * ElementPlacement.ts
 *
 * Small shared helper for positioning a freshly created element in the
 * center of its target page. Used by Editor.ts's desktop "click to add"
 * sidebar tool handler so every element-generating tool behaves the same
 * way on simple click regardless of size/type, instead of each tool
 * hardcoding its own default x/y (previously CurvedTextTool/StampTool
 * always landed at a fixed x=20,y=20; the other 8 element-generating tools
 * had no desktop click handler at all -- see Editor.ts's
 * ELEMENT_CREATOR_TOOLS handler).
 *
 * Deliberately works in page-local attribute units -- the same coordinate
 * system createElement() already writes x/y/w/h in -- rather than screen
 * pixels. `pageEl.offsetWidth/offsetHeight` reflect the page's layout box,
 * which is unaffected by the `transform: scale()` zoom applied to
 * #pages-wrapper, so no zoom math is needed here. Contrast with
 * PageTool.ts's drag-and-drop handler, which starts from mouse *screen*
 * coordinates (`e.clientX/clientY`) and therefore does need to divide by
 * `window.craftoolsZoomLevel` to land in the same coordinate system.
 */
export function centerElementOnPage(el: HTMLElement, pageEl: HTMLElement): void {
  const pageW = pageEl.offsetWidth  || parseFloat(getComputedStyle(pageEl).width)  || 0;
  const pageH = pageEl.offsetHeight || parseFloat(getComputedStyle(pageEl).height) || 0;
  // Page not laid out yet (e.g. detached/zero-size) -- leave whatever
  // default x/y the tool's own createElement() already set rather than
  // centering against a bogus 0×0 page.
  if (!pageW || !pageH) return;

  const elW = parseFloat(el.getAttribute('w') || '') || el.offsetWidth  || 0;
  const elH = parseFloat(el.getAttribute('h') || '') || el.offsetHeight || 0;

  el.setAttribute('x', String(Math.max(0, (pageW - elW) / 2)));
  el.setAttribute('y', String(Math.max(0, (pageH - elH) / 2)));
}
