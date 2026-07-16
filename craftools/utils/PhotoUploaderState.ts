/**
 * PhotoUploaderState.ts
 */

export interface BackgroundState {
  type?:     string;
  value?:    string;
  position?: string;
  size?:     string;
}

export interface OverlayState {
  url?:      string;
  position?: string;
  size?:     string;
  opacity?:  number;
}

export interface PhotoBgState {
  bg?:      BackgroundState;
  overlay?: OverlayState;
  border?:  any;
}

export interface AdjustState {
  brightness?: number;
  contrast?:   number;
  saturation?: number;
}

export interface TransformState {
  posX?:     number;
  posY?:     number;
  zoom?:     number;
  rotation?: number;
}

export class PhotoUploaderState {
  public focusedIndex:      number;
  public captionEditingEl:  HTMLElement | null;
  public photoBackground:   Record<number, PhotoBgState>;
  public adjustState:       Record<number, AdjustState>;
  public photoTransforms:   Record<number, TransformState>;
  public photoAjusteActive: Record<number, boolean>;
  public bgStateObserver:   MutationObserver | null;

  constructor() {
      this.focusedIndex      = -1;
      this.captionEditingEl  = null;
      this.photoBackground   = {};
      this.adjustState       = {};
      this.photoTransforms   = {};
      this.photoAjusteActive = {};
      this.bgStateObserver   = null;
  }

  /** Desconecta e limpa o observer do painel de Fundo, se houver algum ativo. */
  disconnectBgObserver(): void {
      if (this.bgStateObserver) {
          this.bgStateObserver.disconnect();
          this.bgStateObserver = null;
      }
  }
}
