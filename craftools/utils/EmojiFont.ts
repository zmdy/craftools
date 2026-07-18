/**
 * EmojiFont.ts — single source of truth for "which font renders emoji".
 *
 * Every font-family stack in the app that might render emoji (text tools'
 * contenteditable/SVG content, the Emoji tool's sidebar/footer icon)
 * appends this as a fallback. Browsers resolve a font-family list per
 * *glyph*, not per element -- a character missing from the user's chosen
 * text font (e.g. an emoji, which almost no text font includes) silently
 * falls through to the next font in the stack that does have it. That's
 * the whole "smart conversion": no text scanning, no wrapping matched
 * runs in spans -- just always keeping an emoji-capable font as the last
 * link in the chain, for every font-family this app ever sets.
 *
 * Single source of truth so swapping to a different emoji font, or later
 * letting the user pick between several, is a one-line change here instead
 * of a hunt for every hardcoded 'Noto Color Emoji' string. Multi-font
 * loading/selection itself is intentionally NOT built yet -- fonts will
 * come from the font-storage API (planned separately, not this file's
 * job) -- this is just the seam future code plugs into: swap
 * EMOJI_FONT_STACK's first entry (or make it a getter backed by a user
 * preference) and every caller picks it up automatically.
 *
 * craftools.css's `:root { --font-emoji: ... }` mirrors this exact stack
 * for the handful of places emoji fonts are needed in plain HTML/CSS that
 * never goes through this module (index.html's static sidebar/footer
 * emoji icon spans). Keep both in sync if this ever changes.
 */

/** Ordered fallback stack: the browser tries each left-to-right per glyph. */
export const EMOJI_FONT_STACK =
  "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Android Emoji'";

/**
 * Builds a full font-family CSS value for `primaryFont`, with the emoji
 * fallback stack appended so any emoji typed alongside regular text still
 * renders in full color regardless of what `primaryFont` itself supports.
 *
 * @param primaryFont  Unquoted font name, e.g. 'DM Sans'.
 */
export function withEmojiFallback(primaryFont: string): string {
  return `'${primaryFont}', ${EMOJI_FONT_STACK}, sans-serif`;
}
