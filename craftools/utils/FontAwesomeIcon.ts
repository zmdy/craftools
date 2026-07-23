// @ts-nocheck
/**
 * FontAwesomeIcon.ts
 *
 * Tiny helper to render a single Font Awesome (Free Solid) icon as an
 * inline `<svg>` sized like a text glyph (1em, `currentColor`) -- used by
 * the calendar-format "icon" display mode (Seasons.ts / MoonPhases.ts /
 * Zodiac.ts), which each need one small icon inline within a resolved date
 * variable's text, not a full standalone canvas element.
 *
 * NOT related to IconTool.ts's own icon-element rendering (IconLibrary.ts /
 * utils/icons/FontAwesomePack.ts) -- that system needs full pack/category/
 * fill-or-gradient support for a placeable, resizable, recolorable canvas
 * element. This one only needs a single fixed-color glyph matching
 * surrounding text, same "hand-drawn-sized" convention MoonPhases.ts
 * established (`width="1em" height="1em"`, `vertical-align:-0.125em`)
 * before Font Awesome was available as an option at all.
 */

/** Shape of a named icon import from '@fortawesome/free-solid-svg-icons'. */
export interface FaIconDef {
    icon: [number, number, unknown, unknown, string | string[]];
}

export function faIconHtml(fa: FaIconDef): string {
    const [w, h, , , pathData] = fa.icon;
    const d = Array.isArray(pathData) ? pathData[0] : pathData;
    return `<svg width="1em" height="1em" viewBox="0 0 ${w} ${h}" style="display:inline-block;vertical-align:-0.125em;fill:currentColor;" aria-hidden="true"><path d="${d}"/></svg>`;
}
