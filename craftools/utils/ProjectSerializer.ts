import { StateSerializer, type EditorState } from './StateSerializer.js';
import html2canvas from 'html2canvas';

export interface ProjectAsset {
  mime: string;
  data: string; // base64 payload
}

export interface ProjectMeta {
  title: string;
  /**
   * Optional short blurb shown under the title/thumbnail in the sample-
   * projects gallery on the setup screen (Setup.ts's renderHome()). Not
   * collected from regular users on export (ExportTool.ts's "project" action
   * only prompts for a title) -- populated by hand for the bundled
   * assets/samples/*.craftools files, and left undefined for everything else.
   */
  description?: string;
  created_at: string;
  updated_at: string;
  author: string;
  thumbnail: string; // base64 PNG thumbnail (small)
}

export interface ProjectContainer {
  version: number;
  mode: 'embedded' | 'cloud';
  meta: ProjectMeta;
  pages: any[]; // PageState array from StateSerializer
  assets?: Record<string, ProjectAsset>;
}

// Ensure TypeScript is happy with CompressionStream / DecompressionStream globals if they are not in the current target
declare global {
  interface Window {
    CompressionStream?: any;
    DecompressionStream?: any;
  }
}

export class ProjectSerializer {

  /**
   * Helper to calculate SHA-256 of an ArrayBuffer in hex format using Web Crypto API.
   */
  private static async _calculateHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Helper to compress a string to Gzip using native CompressionStream.
   */
  private static async _compress(text: string): Promise<Blob> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      }
    }).pipeThrough(new (window.CompressionStream as any)('gzip'));
    
    return new Response(stream).blob();
  }

  /**
   * Helper to decompress a Gzip Blob to string using native DecompressionStream.
   */
  private static async _decompress(blob: Blob): Promise<string> {
    const stream = blob.stream().pipeThrough(new (window.DecompressionStream as any)('gzip'));
    return new Response(stream).text();
  }

  /**
   * Serializes the pages and bundles all base64 images into a single .craftools Gzip Blob.
   */
  static async exportProject(pagesWrapper: HTMLElement, title: string, description?: string): Promise<Blob> {
    // 1. Serialize editor state
    const editorState = StateSerializer.serialize(pagesWrapper);

    // 2. Generate small PNG thumbnail of the first page using html2canvas
    let thumbnail = '';
    const firstPage = pagesWrapper.querySelector('.craftools-page') as HTMLElement;
    if (firstPage) {
      try {
        const canvas = await html2canvas(firstPage, {
          scale: 0.15, // Low scale for small file size
          useCORS: true,
          allowTaint: true,
          logging: false,
          ignoreElements: (el: Element) =>
            el.classList?.contains('craftools-ctrlbar') ||
            el.classList?.contains('album-drag-handle') ||
            el.classList?.contains('slot-drag-handle') ||
            el.classList?.contains('cell-edit-btn')
        });
        thumbnail = canvas.toDataURL('image/png');
      } catch (e) {
        console.error('[ProjectSerializer] Failed to generate thumbnail:', e);
      }
    }

    // 3. Stringify pages to inspect for base64 data URIs
    let pagesJsonStr = JSON.stringify(editorState.pages);

    // Regex to detect standard base64 data URIs: data:image/MIME;base64,PAYLOAD
    const base64Regex = /data:(image\/[a-zA-Z0-9.\-\/+]+);base64,([a-zA-Z0-9\+\/=]+)/g;
    const assets: Record<string, ProjectAsset> = {};

    // Find all base64 matches in the JSON string
    // To avoid regex re-eval problems with string replacement while looping,
    // we collect all unique matches first.
    const uniqueMatches = new Map<string, { mime: string; data: string }>();
    let match;
    while ((match = base64Regex.exec(pagesJsonStr)) !== null) {
      const fullUri = match[0];
      const mime = match[1];
      const data = match[2];
      uniqueMatches.set(fullUri, { mime, data });
    }

    // 4. Process matches: compute SHA-256 of the binary payload, populate assets map and replace references
    for (const [fullUri, info] of uniqueMatches.entries()) {
      try {
        const binaryString = atob(info.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const hash = await this._calculateHash(bytes.buffer);
        const assetKey = `sha256:${hash}`;
        
        assets[assetKey] = {
          mime: info.mime,
          data: info.data
        };

        // Replace all occurrences of this specific base64 URI with the asset schema URI
        // JSON-escaped version is identical for safe chars, but replace it globally
        pagesJsonStr = pagesJsonStr.split(fullUri).join(`asset://${assetKey}`);
      } catch (e) {
        console.error('[ProjectSerializer] Failed to extract asset:', e);
      }
    }

    // 5. Construct the container
    const container: ProjectContainer = {
      version: 1,
      mode: 'embedded',
      meta: {
        title: title || 'Sem título',
        description: description || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: 'local-user',
        thumbnail
      },
      pages: JSON.parse(pagesJsonStr),
      assets
    };

    // 6. Gzip compress the JSON string
    const finalJsonStr = JSON.stringify(container);
    return this._compress(finalJsonStr);
  }

  /**
   * Reads just the `meta` block (title, description, thumbnail) of a
   * .craftools Gzip Blob without touching the DOM or hydrating any page/
   * asset data. Used by Setup.ts's sample-projects gallery to preview each
   * bundled assets/samples/*.craftools file (thumbnail + description) before
   * the user picks one to load -- at that point there's no #pages-wrapper
   * yet (the editor screen hasn't been mounted), so importProject() (which
   * requires one) can't be used here.
   */
  static async readMeta(fileBlob: Blob): Promise<ProjectMeta> {
    const decompressedStr = await this._decompress(fileBlob);
    const container = JSON.parse(decompressedStr) as ProjectContainer;
    if (container.version !== 1) {
      throw new Error(`Unsupported project version: ${container.version}`);
    }
    return container.meta;
  }

  /**
   * Decompresses the .craftools Gzip Blob, hydrates asset references, and reconciles the DOM.
   */
  static async importProject(pagesWrapper: HTMLElement, fileBlob: Blob): Promise<string> {
    // 1. Decompress Gzip
    const decompressedStr = await this._decompress(fileBlob);
    
    // 2. Parse container
    const container = JSON.parse(decompressedStr) as ProjectContainer;
    if (container.version !== 1) {
      throw new Error(`Unsupported project version: ${container.version}`);
    }

    let pagesJsonStr = JSON.stringify(container.pages);

    // 3. Hydrate assets if in embedded mode
    if (container.mode === 'embedded' && container.assets) {
      for (const [key, asset] of Object.entries(container.assets)) {
        const assetUri = `asset://${key}`;
        const dataUri = `data:${asset.mime};base64,${asset.data}`;
        
        // Globally replace the asset:// URI back with the real base64 data URI
        pagesJsonStr = pagesJsonStr.split(assetUri).join(dataUri);
      }
    } else if (container.mode === 'cloud') {
      // In cloud mode, assets will be fetched from API endpoints.
      // Left prepared for future integration as requested.
      console.warn('[ProjectSerializer] Cloud mode is prepared but not fully implemented in this initial offline release.');
    }

    // 4. Reconcile canvas DOM using StateSerializer
    const hydratedPages = JSON.parse(pagesJsonStr);
    const editorState: EditorState = { pages: hydratedPages };
    
    StateSerializer.reconcile(pagesWrapper, editorState);

    // Return project title for notifications/UI updates
    return container.meta.title;
  }
}
