import { I18n } from "../../settings/Translations.js";
import { FILTERS_CONFIG, ImageFilters } from "./ImageFilters.js";
import { ImageTransform } from "./ImageTransform.js";
import { BaseTool } from "../BaseTool.js";
import { PanelUI } from "../../utils/PanelUI.js";
import "./ImageTool_Translations.js";

export class ImageTool extends BaseTool {

    // Legacy renderPropertiesPanel deleted.
    // Panel rendering is now schema-driven in ImageTool.ts via PropertyRenderer.

    static _applyBgBlur(element) {
        const meta = element._craftoolsMeta;
        if (!meta) return;

        let blurBg = element.querySelector('.craftools-element-blur-bg');
        
        if (meta.bgBlur <= 0) {
            if (blurBg) blurBg.remove();
            element.style.overflow = "";
            return;
        }

        if (!blurBg) {
            element.style.overflow = "hidden";
            blurBg = document.createElement('div');
            blurBg.className = "craftools-element-blur-bg";
            blurBg.style.cssText = `
                position: absolute;
                inset: -20px;
                background-size: cover;
                background-position: center;
                opacity: 0.6;
                pointer-events: none;
                z-index: -1;
            `;
            element.insertBefore(blurBg, element.firstChild);
        }

        blurBg.style.backgroundImage = `url(${meta.src})`;
        blurBg.style.filter = `blur(${meta.bgBlur}px)`;
    }

    /**
     * Returns the other image elements "siblings" linked to this one —
     * used to keep photo/adjustments synchronised across all cells in
     * Album (Business Card) mode.
     *
     * Two linking mechanisms exist in the system:
     *  1) `element._linkedElements` — shared array assigned by the Album
     *     wizard (AlbumTool.js) when multiple photos are uploaded at once;
     *     the elements already share the same `_craftoolsMeta` object by
     *     reference.
     *  2) `data-linked-id` — DOM attribute assigned by PageTool.js
     *     (Business Card Cloning Logic) when ONE tool is dragged into a
     *     grid cell in "card" mode; the element is cloned (cloneNode) to
     *     the other cells, but cloneNode does NOT copy JS properties such as
     *     `_craftoolsMeta` — each clone ends up with its own meta object,
     *     disconnected from the others, so the sync below must also copy the
     *     VALUES of meta (not just re-apply the same reference).
     */
    static _getLinkedSiblings(element) {
        if (Array.isArray(element._linkedElements)) {
            return element._linkedElements.filter(el => el !== element);
        }
        const lid = element.getAttribute('data-linked-id');
        if (!lid) return [];
        return [...document.querySelectorAll(`craftools-element[data-linked-id="${lid}"]`)]
            .filter(el => el !== element);
    }

    /** Copies the current meta state to a sibling element (unless it is
     *  already the same shared object) and re-applies it to the sibling's DOM. */
    static _pushMetaToSibling(sibling, meta) {
        if (sibling._craftoolsMeta !== meta) {
            if (!sibling._craftoolsMeta) sibling._craftoolsMeta = this.getDefaultMeta();
            Object.assign(sibling._craftoolsMeta, meta, { filters: { ...meta.filters } });
        }
        const sMeta = sibling._craftoolsMeta;
        const img = sibling.contentArea?.querySelector('img');
        if (img) {
            if (img.getAttribute('src') !== meta.src) img.src = meta.src;
            img.style.mixBlendMode = (sMeta.blendMode && sMeta.blendMode !== 'normal') ? sMeta.blendMode : '';
            img.style.borderWidth = (sMeta.borderWidth || 0) + 'px';
            img.style.borderStyle = sMeta.borderStyle || 'none';
            img.style.borderColor = sMeta.borderColor || '#000000';
            img.style.borderRadius = (sMeta.borderRadius || 0) + 'px';
        }
        ImageTransform.applyTransform(sibling);
        ImageFilters.applyFilters(sibling);
        this._applyBgBlur(sibling);
    }

    /** Propagates the current meta to all linked sibling elements. */
    static _propagateToSiblings(element, meta) {
        this._getLinkedSiblings(element).forEach(sibling => this._pushMetaToSibling(sibling, meta));
    }

    static getCtxOptions() {
        return [
            {
                icon: 'published_with_changes',
                label: I18n.t('imageTool.switchPhoto'),
                command: (element) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = () => {
                        const file = input.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = e => {
                                if (!element._craftoolsMeta) element._craftoolsMeta = this.getDefaultMeta();
                                element._craftoolsMeta.src = e.target.result;
                                const img = element.contentArea.querySelector('img');
                                if (img) img.src = e.target.result;

                                 // Update blurred background if present
                                 const blurBg = element.querySelector('.craftools-element-blur-bg');
                                 if (blurBg) blurBg.style.backgroundImage = `url(${e.target.result})`;

                                 // Propagate to other linked elements (Business Card
                                 // mode) even when the properties panel was never
                                 // opened for this element.
                                 this._propagateToSiblings(element, element._craftoolsMeta);
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    input.click();
                }
            }
        ];
    }

    static getDefaultMeta() {
        const meta = {
            src: '',
            objectFit: 'cover',
            zoom: 1,
            posX: 0,
            posY: 0,
            rotation: 0,
            bgBlur: 0,
            blendMode: 'normal',
            borderWidth: 0,
            borderStyle: 'none',
            borderColor: '#000000',
            borderRadius: 0,
            filters: {}
        };
        FILTERS_CONFIG.forEach(f => meta.filters[f.key] = f.def);
        return meta;
    }

    static createElement(type, editorApp) {
        const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E";
        
        const el = document.createElement('craftools-element');
        el.setAttribute('x', '50');
        el.setAttribute('y', '50');
        el.setAttribute('w', '200');
        el.setAttribute('h', '200');
        el.setAttribute('data-craftool', 'imagem');

        el._craftoolsMeta = this.getDefaultMeta();
        el._craftoolsMeta.src = placeholder;

        const img = document.createElement('img');
        img.src = placeholder;
        img.style.cssText = `display:block;width:100%;height:100%;object-fit:${el._craftoolsMeta.objectFit};user-select:none;pointer-events:none;`;

        el.appendChild(img);
        
        // Wait for the web component to be connected and built
        const initElement = () => {
            if (el.contentArea) {
                ImageTransform.setupInteractions(el);
                ImageTransform.applyTransform(el);
                ImageFilters.applyFilters(el);
                this._applyBgBlur(el);
            } else {
                requestAnimationFrame(initElement);
            }
        };
        initElement();

        return el;
    }
}
