export class PageTool {
    static attachPageEvents(editor, pageEl) {
        pageEl.addEventListener('click', (e) => {
            if (e.target === pageEl || e.target.closest('div[style*="canvas"]')) {
                editor.querySelectorAll('.craftools-tool-btn').forEach(b => b.classList.remove('active'));
                
                const rightPanel = editor.querySelector('#right-panel');
                const panelTitle = editor.querySelector('#panel-title');
                const panelBody = editor.querySelector('#panel-body');
                
                panelTitle.textContent = 'Configurações da Página';
                editor.activePage = pageEl;
                
                // Parse current dimensions
                const currentWidthRaw = pageEl.style.width || '800px';
                const currentHeightRaw = pageEl.style.minHeight || '600px';
                const currentUnitMatch = currentWidthRaw.match(/[a-z%]+$/i);
                const currentUnit = currentUnitMatch ? currentUnitMatch[0] : 'px';
                const currentW = parseFloat(currentWidthRaw);
                const currentH = parseFloat(currentHeightRaw);

                // Determine active media sizes from global state
                const presetsHtml = (window.craftoolsApp && window.craftoolsApp.activeMedia && window.craftoolsApp.activeMedia.sizes) 
                    ? window.craftoolsApp.activeMedia.sizes.map((s, i) => `<button class="craftools-pill preset-btn" data-index="${i}">${s.name}</button>`).join('')
                    : '<span style="font-size:11px;color:var(--text-muted)">Sem predefinições</span>';

                const currentColor = pageEl.style.backgroundColor || '#ffffff';
                const currentBg = pageEl.style.background || '';

                panelBody.innerHTML = `
                    <div class="craftools-field">
                        <span class="craftools-label">Predefinição</span>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="presets-container">
                            ${presetsHtml}
                        </div>
                    </div>

                    <div class="craftools-field">
                        <span class="craftools-label">Dimensões</span>
                        <div style="display: flex; gap: 4px; margin-bottom: 6px;" id="unit-group">
                            ${['px', 'mm', 'cm', 'in', '%'].map(u => `<button class="craftools-pill unit-btn ${u === currentUnit ? 'active' : ''}" data-unit="${u}">${u}</button>`).join('')}
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <input type="number" class="craftools-input" id="dim-w" style="width: 70px;" value="${currentW}">
                            <span style="color: var(--text-muted); font-size: 13px;">×</span>
                            <input type="number" class="craftools-input" id="dim-h" style="width: 70px;" value="${currentH}">
                            <span style="color: var(--text-muted); font-size: 11px;" id="dim-unit-label">${currentUnit}</span>
                        </div>
                    </div>

                    <div class="craftools-field">
                        <span class="craftools-label">Fundo</span>
                        <div style="display: flex; gap: 4px; margin-bottom: 10px;" id="bg-type-group">
                            <button class="craftools-pill bg-type-btn active" data-type="color">Cor</button>
                            <button class="craftools-pill bg-type-btn" data-type="gradient">Gradiente</button>
                            <button class="craftools-pill bg-type-btn" data-type="image">Imagem</button>
                        </div>
                        
                        <div id="bg-color-section">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <input type="color" class="craftools-color-swatch" id="page-bg-color" value="${currentColor}">
                                <span style="font-size: 12px; color: var(--text-secondary)">Escolha a cor</span>
                            </div>
                        </div>
                        
                        <div id="bg-gradient-section" style="display: none;">
                            <input type="text" class="craftools-input" id="page-bg-grad-input" placeholder="linear-gradient(...)">
                            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;" id="grad-presets"></div>
                        </div>

                        <div id="bg-image-section" style="display: none;">
                            <input type="url" class="craftools-input" id="page-bg-img-url" placeholder="URL da imagem">
                            <input type="file" id="page-bg-img-file" accept="image/*" style="margin-top: 8px; font-size: 11px; width: 100%;">
                        </div>
                    </div>

                    <div class="craftools-field">
                        <button class="craftools-danger-btn" id="delete-page-btn">
                            <span class="material-symbols-outlined">delete</span> Apagar Página
                        </button>
                    </div>
                `;

                let activeUnit = currentUnit;

                // Bind Presets
                panelBody.querySelectorAll('.preset-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const s = window.craftoolsApp.activeMedia.sizes[btn.getAttribute('data-index')];
                        if (s.size !== "*") {
                            const parts = s.size.split(',');
                            document.getElementById('dim-w').value = parts[0];
                            document.getElementById('dim-h').value = parts[1];
                            activeUnit = s.sizeUnit;
                            document.getElementById('dim-unit-label').innerText = activeUnit;
                            panelBody.querySelectorAll('.unit-btn').forEach(b => {
                                b.classList.toggle('active', b.getAttribute('data-unit') === activeUnit);
                            });
                            editor.activePage.style.width = parts[0] + activeUnit;
                            editor.activePage.style.minHeight = parts[1] + activeUnit;
                        }
                    });
                });

                // Bind Dimensions
                const applyDims = () => {
                    const w = document.getElementById('dim-w').value;
                    const h = document.getElementById('dim-h').value;
                    editor.activePage.style.width = w + activeUnit;
                    editor.activePage.style.minHeight = h + activeUnit;
                };

                document.getElementById('dim-w').addEventListener('input', applyDims);
                document.getElementById('dim-h').addEventListener('input', applyDims);

                panelBody.querySelectorAll('.unit-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        panelBody.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        activeUnit = btn.getAttribute('data-unit');
                        document.getElementById('dim-unit-label').innerText = activeUnit;
                        applyDims();
                    });
                });

                // Bind Backgrounds
                const bgTypeBtns = panelBody.querySelectorAll('.bg-type-btn');
                const sections = {
                    color: document.getElementById('bg-color-section'),
                    gradient: document.getElementById('bg-gradient-section'),
                    image: document.getElementById('bg-image-section')
                };

                bgTypeBtns.forEach(btn => {
                    btn.addEventListener('click', () => {
                        bgTypeBtns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        const type = btn.getAttribute('data-type');
                        Object.keys(sections).forEach(k => sections[k].style.display = 'none');
                        sections[type].style.display = 'block';
                    });
                });

                // Color Background
                document.getElementById('page-bg-color').addEventListener('input', (e) => {
                    editor.activePage.style.background = e.target.value;
                });

                // Gradient Background
                const gradInput = document.getElementById('page-bg-grad-input');
                gradInput.addEventListener('input', (e) => {
                    editor.activePage.style.background = e.target.value;
                });
                
                const gradPresetsContainer = document.getElementById('grad-presets');
                const gradList = ['linear-gradient(135deg,#f5f7fa,#c3cfe2)', 'linear-gradient(135deg,#fddb92,#d1fdff)', 'linear-gradient(135deg,#a18cd1,#fbc2eb)', 'linear-gradient(120deg,#f093fb,#f5576c)', 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', 'radial-gradient(circle at top,#ffecd2,#fcb69f)', 'linear-gradient(135deg,#11998e,#38ef7d)'];
                gradList.forEach(grad => {
                    const gradBtn = document.createElement('button');
                    gradBtn.style.cssText = `width:26px;height:26px;border-radius:5px;background:${grad};border:1px solid var(--border);cursor:pointer;`;
                    gradBtn.addEventListener('click', () => {
                        gradInput.value = grad;
                        editor.activePage.style.background = grad;
                    });
                    gradPresetsContainer.appendChild(gradBtn);
                });

                // Image Background
                const imgUrlInput = document.getElementById('page-bg-img-url');
                imgUrlInput.addEventListener('input', (e) => {
                    editor.activePage.style.background = `url(${e.target.value}) center/cover no-repeat`;
                });

                const imgFileInput = document.getElementById('page-bg-img-file');
                imgFileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            imgUrlInput.value = ev.target.result;
                            editor.activePage.style.background = `url(${ev.target.result}) center/cover no-repeat`;
                        };
                        reader.readAsDataURL(file);
                    }
                });

                // Delete Page
                panelBody.querySelector('#delete-page-btn').addEventListener('click', () => {
                    if (confirm("Tem certeza que deseja excluir esta página? Essa ação não pode ser desfeita.")) {
                        const pagesWrapper = editor.querySelector('#pages-wrapper');
                        if (pagesWrapper.querySelectorAll('.craftools-page').length > 1) {
                            editor.activePage.remove();
                            rightPanel.classList.add('hidden');
                            editor.activePage = null;
                        } else {
                            alert("Você não pode apagar a única página restante.");
                        }
                    }
                });

                rightPanel.classList.remove('hidden');
            }
        });
    }

    static addNewPage(editor) {
        const pagesWrapper = editor.querySelector('#pages-wrapper');
        const lastPage = pagesWrapper.querySelector('.craftools-page:last-child');
        
        // Clona a última página para manter a dimensão local
        const clone = lastPage.cloneNode(true);
        clone.id = 'page-' + Date.now();
        
        // Remove os componentes filhos da página inteiramente mas mantém a sua forma
        clone.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 14px;">Nova Página</div>`;
        
        // Acoplar os eventos para poder clicar na nova página localmente
        this.attachPageEvents(editor, clone);
        pagesWrapper.appendChild(clone);
        
        // Scrollar automaticamente para a página nova de forma suave
        pagesWrapper.parentElement.scrollTo({ top: pagesWrapper.parentElement.scrollHeight, behavior: 'smooth' });
    }
}
