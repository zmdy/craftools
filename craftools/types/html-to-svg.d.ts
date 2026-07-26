/**
 * html-to-svg.d.ts
 *
 * Minimal ambient declaration for @tooooools/html-to-svg -- the package
 * ships no TypeScript types of its own (confirmed: no .d.ts anywhere in
 * its published files, no "types"/"typings" field in its package.json).
 * Typed loosely (constructor options + the two methods AgendaSvgExport.ts
 * actually calls) rather than fully modeling its internals, since this is
 * an experimental integration -- see AgendaSvgExport.ts's own header
 * comment for why.
 */
declare module '@tooooools/html-to-svg' {
  interface HtmlToSvgFontDeclaration {
    family: string;
    url:    string;
    weight?: string;
    style?:  string;
  }

  interface HtmlToSvgOptions {
    debug?: boolean;
    ignore?: string;
    fonts?: HtmlToSvgFontDeclaration[];
  }

  interface HtmlToSvgRenderOptions {
    rasterizeNestedSVG?: boolean;
    splitText?: boolean;
  }

  export default class HtmlToSvg {
    constructor(options?: HtmlToSvgOptions);
    preload(): Promise<void>;
    render(
      element: Element,
      options?: HtmlToSvgRenderOptions,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transform?: (from: any, to: any) => Promise<any>,
    ): Promise<SVGSVGElement>;
    destroy(): void;
  }
}
