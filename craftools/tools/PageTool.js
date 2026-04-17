export class PageTool {
    static attachPageEvents(editor, pageEl) {
        pageEl.addEventListener('click', (e) => {
            if (e.target === pageEl || e.target.closest('div[style*="canvas"]')) {
                // Remove a exibição de ferramenta ativa
                editor.querySelectorAll('.craftools-tool-btn').forEach(b => b.classList.remove('active'));
                
                // Configurações do painel direito
                const rightPanel = editor.querySelector('#right-panel');
                const panelTitle = editor.querySelector('#panel-title');
                const panelBody = editor.querySelector('#panel-body');
                
                panelTitle.textContent = 'Configurações da Página';
                editor.activePage = pageEl;
                
                const currentColor = pageEl.style.backgroundColor || '#ffffff';
                
                panelBody.innerHTML = `
                    <div class="craftools-field">
                        <span class="craftools-label">Cor de Fundo</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="color" class="craftools-color-swatch" id="page-bg-input" value="${currentColor}">
                            <span style="font-size: 12px; color: var(--text-secondary)">Escolha a cor</span>
                        </div>
                    </div>
                    <div class="craftools-field">
                        <button class="craftools-danger-btn" id="delete-page-btn">
                            <span class="material-symbols-outlined">delete</span> Apagar Página
                        </button>
                    </div>
                `;
                
                // Mudar a cor da página atual
                panelBody.querySelector('#page-bg-input').addEventListener('input', (ev) => {
                    if (editor.activePage) editor.activePage.style.background = ev.target.value;
                });

                // Apagar página com alerta de confirmação e sistema de proteção
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
