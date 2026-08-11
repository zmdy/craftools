/**
 * LetteringFontPoolField.ts — shared "which fonts can the random per-letter
 * picker draw from" checklist, used by both LetteringTool.ts's own schema
 * and VariableContentTool.ts's "Lettering" section (the useLettering toggle
 * that renders a resolved variable's text as lettering) -- both ultimately
 * feed LetteringGenerator.ts's `LetteringMeta.fontPool`, so both should
 * offer the exact same picker.
 *
 * Unlike this app's usual "small reusable custom-field renderer" convention
 * (LetteringTool.ts/VariableContentTool.ts each keep their OWN trivial
 * _renderPillGroup()/_renderActionButton() private statics, duplicated
 * rather than shared -- see either file's own comment), this one is real
 * enough (font catalog + local-font list + checkbox state + live preview in
 * each font's own typeface) that duplicating it wasn't worth it.
 */

import { FONTS, getSavedLocalFonts, loadCraftoolsFonts } from './FontList.js';

export interface LetteringFontPoolLabels {
  selectAll: string;
  clearAll: string;
  hint: string;
}

/**
 * Renders a scrollable checklist of every available font (the static FONTS
 * catalog, same source font-select.field.ts's buildFontList() uses, plus
 * any "typed local font" names saved via FontList.ts's saveLocalFont()).
 * Each row previews the font name IN that font's own typeface -- same idea
 * as CtFontSelect.ts's dropdown items, just checkbox-driven instead of
 * single-select.
 *
 * `readValue`/`onChange` deal in the RAW `fontPool: string[]` value (empty
 * = no restriction, see LetteringMeta.fontPool's own doc comment) -- the
 * caller is responsible for reading/writing it through whatever state
 * mechanism its own tool uses (dataset.ctState via PropertyRenderer, same
 * as every other 'custom' field in this app).
 */
export function renderLetteringFontPoolField(
  readValue: () => string[],
  onChange: (value: string[]) => void,
  labels: LetteringFontPoolLabels,
): HTMLElement {
  const options = [...FONTS];
  for (const local of getSavedLocalFonts()) {
    if (!options.includes(local)) options.push(local);
  }
  // Best-effort -- loads every catalog font's real typeface so the
  // checklist rows preview correctly. Cheap/idempotent (loadCraftoolsFonts
  // just points a shared <link> at the union of families requested so far).
  loadCraftoolsFonts(options);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'border:1px solid var(--border, #e4e4e7); border-radius:8px; padding:8px; margin-bottom:4px;';

  const actionsRow = document.createElement('div');
  actionsRow.style.cssText = 'display:flex; gap:6px; margin-bottom:6px;';
  const btnAll = document.createElement('button');
  btnAll.type = 'button';
  btnAll.className = 'craftools-pill';
  btnAll.style.cssText = 'flex:1; justify-content:center; font-size:11px; padding:5px 8px;';
  btnAll.textContent = labels.selectAll;
  const btnNone = document.createElement('button');
  btnNone.type = 'button';
  btnNone.className = 'craftools-pill';
  btnNone.style.cssText = 'flex:1; justify-content:center; font-size:11px; padding:5px 8px;';
  btnNone.textContent = labels.clearAll;
  actionsRow.appendChild(btnAll);
  actionsRow.appendChild(btnNone);
  wrap.appendChild(actionsRow);

  const list = document.createElement('div');
  list.style.cssText = 'max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:1px;';
  wrap.appendChild(list);

  const hint = document.createElement('span');
  hint.style.cssText = 'font-size:10px; color:var(--text-muted); display:block; margin-top:6px;';
  hint.textContent = labels.hint;
  wrap.appendChild(hint);

  const paint = (): void => {
    const current = new Set(readValue());
    list.innerHTML = '';
    options.forEach(fontName => {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:4px 6px; border-radius:6px; cursor:pointer;';
      row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-hover, rgba(0,0,0,.04))'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = current.has(fontName);
      checkbox.style.cssText = 'flex-shrink:0; cursor:pointer;';
      checkbox.addEventListener('change', () => {
        const next = new Set(readValue());
        if (checkbox.checked) next.add(fontName); else next.delete(fontName);
        onChange([...next]);
        paint();
      });

      const nameSpan = document.createElement('span');
      nameSpan.textContent = fontName;
      nameSpan.style.cssText = `font-family:"${fontName.replace(/"/g, '\\"')}", sans-serif; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`;

      row.appendChild(checkbox);
      row.appendChild(nameSpan);
      list.appendChild(row);
    });
  };

  btnAll.addEventListener('click', () => { onChange([...options]); paint(); });
  btnNone.addEventListener('click', () => { onChange([]); paint(); });

  paint();
  return wrap;
}
