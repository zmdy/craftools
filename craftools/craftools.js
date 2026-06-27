import { Craftools_Setup } from "./components/Setup.js";
import { Craftools_Editor } from "./components/Editor.js";
import { Craftools_Element } from "./components/Element.js";
import { Craftools_Settings } from "./settings/Settings.js";
import { I18n } from "./settings/Translations.js";
import { SessionManager } from "./utils/SessionManager.js";
import { HistoryManager } from "./utils/HistoryManager.js";

export class Craftools{
    // Constructor
    constructor(wrapper){
        I18n.init();
        // Case the wrapper is a valid HTML element
        if( !this.setWrapper(wrapper) )
            return false;

        window.craftoolsApp = this;
        
        // Defines the components of the application
        this.components = [Craftools_Setup, Craftools_Editor, Craftools_Element];
        this.screen = Craftools_Setup; // setup, module_MODULENAME
        
        this.initComponents();
        this.renderComponent();

        // Listen to navigation events
        this.wrapper.addEventListener('craftools-start', (e) => {
            this.activeMedia = e.detail.media;
            this.activeSize = e.detail.size;
            window.craftoolsSize = e.detail.size;
            this.screen = Craftools_Editor;
            HistoryManager.clear();
            this.renderComponent();
        });

        // Check for saved session recovery
        this._checkSessionRecovery();
        
        // Load custom fonts from IndexedDB
        this._loadCustomFonts();
    }

    // Loads custom fonts uploaded by the user from IndexedDB
    _loadCustomFonts() {
        const req = indexedDB.open('CraftoolsFonts', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('fonts')) {
                db.createObjectStore('fonts');
            }
        };
        req.onsuccess = (e) => {
            const db = e.target.result;
            if(!db.objectStoreNames.contains('fonts')) return;
            const tx = db.transaction('fonts', 'readonly');
            const store = tx.objectStore('fonts');
            const getAll = store.getAll();
            const getKeys = store.getAllKeys();
            
            getAll.onsuccess = () => {
                getKeys.onsuccess = async () => {
                    window.__craftoolsCustomFonts = window.__craftoolsCustomFonts || {};
                    for(let i=0; i<getKeys.result.length; i++) {
                        const fontName = getKeys.result[i];
                        const buffer = getAll.result[i];
                        try {
                            const fontFace = new FontFace(fontName, buffer);
                            const loadedFace = await fontFace.load();
                            document.fonts.add(loadedFace);
                            window.__craftoolsCustomFonts[fontName] = true;
                        } catch(err) {
                            console.error('Failed to load custom font from DB', fontName, err);
                        }
                    }
                };
            };
        };
    }

    // Sets the wrapper and checks if it's valid
    setWrapper(wrapper){
        try {
            wrapper = wrapper instanceof HTMLElement ? wrapper : document.querySelector(wrapper);
            if(wrapper) this.wrapper = wrapper;
            return this.wrapper;
        } catch (error) {
            this.wrapper = false;
            console.error(`The term "${wrapper}" is not a valid HTML Element or selector.`)
            console.error(error);
        }
    }

    // Sets the wrapper content - or clears it
    setWrapperContent(content){
        this.wrapper.innerHTML = ""; 

        if (content instanceof HTMLElement) {
            this.wrapper.appendChild(content);
        } else {
            this.wrapper.innerHTML = content;
        }
    }

    // Initializes the components
    initComponents(){
        this.components.forEach(component => {
            component.init();
        });
    }

    // Run the this.action component
    renderComponent(){
        console.log(this.screen.name)
        let component_name = this.screen.name.toLowerCase().replace('_', '-');
        let component = document.createElement(component_name);

        this.setWrapperContent(component);
    }

    // Checks for a previously saved session and shows recovery modal if found
    _checkSessionRecovery() {
        const session = SessionManager.getSavedSession();
        if (!session || !session.html) return;

        const ts = new Date(session.timestamp);
        const localeMap = { 'pt-br': 'pt-BR', 'es': 'es-ES', 'en': 'en-US' };
        const dateStr = ts.toLocaleDateString(localeMap[I18n.currentLang] || 'en-US', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const overlay = document.createElement('div');
        overlay.id = 'craftools-recovery-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(0,0,0,0.65); backdrop-filter: blur(6px);
            display: flex; align-items: center; justify-content: center;
            animation: ct-fadein 0.25s ease;
        `;

        overlay.innerHTML = `
            <style>
                @keyframes ct-fadein { from { opacity:0; transform: scale(0.96); } to { opacity:1; transform: scale(1); } }
                @keyframes ct-modal-in { from { opacity:0; transform: translateY(20px) scale(0.97); } to { opacity:1; transform: translateY(0) scale(1); } }
                #ct-recovery-modal { animation: ct-modal-in 0.3s cubic-bezier(.22,1,.36,1); }
            </style>
            <div id="ct-recovery-modal" style="
                background: var(--bg-panel, #1e1e2e);
                border: 1px solid var(--border, rgba(255,255,255,0.08));
                border-radius: 20px;
                padding: 36px 40px;
                max-width: 440px;
                width: 90%;
                box-shadow: 0 32px 80px rgba(0,0,0,0.5);
                text-align: center;
                font-family: 'DM Sans', sans-serif;
            ">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #f97316, #fb923c); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 8px 24px rgba(249,115,22,0.3);">
                    <span class="material-symbols-outlined" style="font-size: 28px; color: #fff;">history</span>
                </div>
                <h2 style="font-family: 'DM Serif Display', serif; font-size: 22px; font-weight: 700; color: var(--text-primary, #fff); margin: 0 0 8px;">${I18n.t('sessionRecovery.title')}</h2>
                <p style="font-size: 13px; color: var(--text-secondary, rgba(255,255,255,0.6)); margin: 0 0 6px; line-height: 1.6;">
                    ${I18n.t('sessionRecovery.message')}
                </p>
                <p style="font-size: 12px; color: var(--text-muted, rgba(255,255,255,0.4)); margin: 0 0 28px;">
                    ${I18n.t('sessionRecovery.savedAt')} <strong style="color: var(--accent, #f97316);">${dateStr}</strong>
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="ct-recovery-new" style="
                        padding: 10px 22px; border-radius: 10px; border: 1px solid var(--border, rgba(255,255,255,0.1));
                        background: transparent; color: var(--text-secondary, rgba(255,255,255,0.6));
                        font-family: 'DM Sans', sans-serif; font-size: 13px; cursor: pointer;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">
                        ${I18n.t('sessionRecovery.newProject')}
                    </button>
                    <button id="ct-recovery-restore" style="
                        padding: 10px 24px; border-radius: 10px; border: none;
                        background: linear-gradient(135deg, #f97316, #fb923c);
                        color: #fff; font-family: 'DM Sans', sans-serif;
                        font-size: 13px; font-weight: 600; cursor: pointer;
                        box-shadow: 0 4px 16px rgba(249,115,22,0.35);
                        transition: all 0.2s;
                    " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                        <span class="material-symbols-outlined" style="font-size:14px; vertical-align: middle; margin-right: 4px;">restore</span>
                        ${I18n.t('sessionRecovery.restoreSession')}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const dismiss = () => overlay.remove();

        overlay.querySelector('#ct-recovery-new').addEventListener('click', () => {
            SessionManager.clearSaved();
            dismiss();
        });

        overlay.querySelector('#ct-recovery-restore').addEventListener('click', () => {
            dismiss();
            // Set the size config from the saved session
            window.craftoolsSize = session.sizeConfig || { size: '*', sizeUnit: 'px', key: 'recovered' };
            this.screen = Craftools_Editor;
            this.renderComponent();
            // Restore the saved HTML into the new editor
            setTimeout(() => {
                const pagesWrapper = document.querySelector('#pages-wrapper');
                if (pagesWrapper && session.html) {
                    SessionManager.restoreSession(session, pagesWrapper);
                    // Re-attach page events
                    const editor = document.querySelector('craftools-editor');
                    if (editor) {
                        pagesWrapper.querySelectorAll('.craftools-page').forEach(page => {
                            const { PageTool } = window._craftoolsPageTool || {};
                            // Use the editor's method if available
                            if (editor._reattachAllPageEvents) editor._reattachAllPageEvents(pagesWrapper);
                        });
                    }
                    // Take initial history snapshot
                    setTimeout(() => HistoryManager.snapshot(pagesWrapper), 200);
                }
            }, 150);
        });
    }
}