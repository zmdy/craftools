export class CtxBar {
    constructor(container) {
        this.container = container; // Should be document.body or the app wrapper
        this.el = document.createElement('div');
        this.el.className = 'craftools-ctxbar hidden';
        this.el.style.cssText = 'position:fixed; z-index:500; display:flex; align-items:center; gap:2px; padding:4px 6px; border-radius:12px; background:var(--bg-shell, #fff); border:1px solid var(--border, #ccc); box-shadow:var(--shadow-lg, 0 4px 12px rgba(0,0,0,0.15)); transition:opacity 0.15s; pointer-events:auto;';
        this.container.appendChild(this.el);
        
        this.activeElement = null;
    }

    createButton(iconName, label, onClick, extraClass = '') {
        const btn = document.createElement('button');
        btn.className = `craftools-ctx-btn ${extraClass}`;
        btn.title = label;
        btn.style.cssText = 'display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:6px; border:none; background:transparent; color:var(--text-secondary); cursor:pointer; transition:background 0.1s, color 0.1s;';
        
        btn.addEventListener('mouseover', () => {
            if(extraClass === 'danger') {
                btn.style.background = 'rgba(239,68,68,0.1)';
                btn.style.color = '#ef4444';
            } else {
                btn.style.background = 'var(--bg-input)';
                btn.style.color = 'var(--text-primary)';
            }
        });
        btn.addEventListener('mouseout', () => {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-secondary)';
        });

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.style.cssText = 'font-size:18px; line-height:1;';
        icon.textContent = iconName;
        
        btn.appendChild(icon);

        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });

        return btn;
    }

    createSeparator() {
        const sep = document.createElement('div');
        sep.className = 'craftools-ctx-sep';
        sep.style.cssText = 'width:1px; height:18px; background:var(--border); margin:0 2px; flex-shrink:0;';
        return sep;
    }

    show(element, options = []) {
        if (!element) return;
        this.activeElement = element;
        this.el.innerHTML = '';

        // Default commands (z-index)
        const zAdjust = (action) => {
            const page = element.closest('.craftools-page');
            if(!page) return;
            const siblings = [...page.querySelectorAll('craftools-element')];
            const currentZ = parseInt(element.style.zIndex) || 2;
            
            if (action === 'front') element.style.zIndex = Math.max(...siblings.map(el => parseInt(el.style.zIndex) || 2)) + 1;
            if (action === 'back') {
                const minZ = Math.min(...siblings.map(el => parseInt(el.style.zIndex) || 2));
                element.style.zIndex = Math.max(1, minZ - 1);
            }
            if (action === 'up') element.style.zIndex = currentZ + 1;
            if (action === 'down') element.style.zIndex = Math.max(1, currentZ - 1);
        };

        this.el.appendChild(this.createButton('flip_to_front', 'Para frente', () => zAdjust('front')));
        this.el.appendChild(this.createButton('flip_to_back', 'Para trás', () => zAdjust('back')));
        this.el.appendChild(this.createButton('arrow_upward', 'Subir', () => zAdjust('up')));
        this.el.appendChild(this.createButton('arrow_downward', 'Descer', () => zAdjust('down')));

        // Custom tools commands
        if (options && options.length > 0) {
            this.el.appendChild(this.createSeparator());
            options.forEach(opt => {
                this.el.appendChild(this.createButton(opt.icon, opt.label, () => {
                    if (opt.command) opt.command(element);
                }));
            });
        }

        this.el.classList.remove('hidden');
        this.el.style.display = 'flex';
        this.position(element);
        
        // Auto-update position on move
        this._moveHandler = () => this.position(element);
        element.addEventListener('craftools-element-change', this._moveHandler);
    }

    position(element) {
        if(!this.activeElement || this.activeElement !== element) return;
        
        const rect = element.getBoundingClientRect();
        let top = rect.top - this.el.offsetHeight - 12;
        let left = rect.left;

        if (top < 10) {
            top = rect.bottom + 12;
        }

        left = Math.min(Math.max(left, 10), window.innerWidth - this.el.offsetWidth - 10);
        
        this.el.style.top = `${top}px`;
        this.el.style.left = `${left}px`;
    }

    hide() {
        this.el.classList.add('hidden');
        this.el.style.display = 'none';
        if (this.activeElement && this._moveHandler) {
            this.activeElement.removeEventListener('craftools-element-change', this._moveHandler);
        }
        this.activeElement = null;
    }
}
