    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        renderDashboard();
    }

    function switchPage(pageId) {
        document.querySelectorAll('.page-section').forEach(p => p.classList.add('hidden'));

        document.getElementById('page-' + pageId).classList.remove('hidden');
        document.querySelectorAll('#btn-page-dash, #btn-page-portfolio, #btn-page-embrapii, #btn-page-certificados, #btn-page-inscritos').forEach(b => b.classList.remove('active'));
        document.getElementById('btn-page-' + pageId).classList.add('active');
        if (pageId === 'dash')          setTimeout(() => { Object.values(charts).forEach(c => c.resize()); }, 100);
        if (pageId === 'embrapii')      renderEmbrapii(uploadedFiles);
        if (pageId === 'certificados')  renderCertificadosPage();
        if (pageId === 'inscritos')     renderInscritos(uploadedFiles.filter(f => f.type !== 'levantamento'));
    }

    function toggleAccordion(id, btnElement) {
        document.getElementById(id).classList.toggle('show');
        if(btnElement) btnElement.classList.toggle('open');
    }

    function updateSidebar() {
        const container = document.getElementById('dynamic-editions');
        container.innerHTML = '';
        // levantamento files are cert-only — excluded from sidebar/KPI
        const dashFiles     = uploadedFiles.filter(f => f.type !== 'levantamento');
        let cyberFiles      = dashFiles.filter(f => f.type === 'cyberthon');
        let handsFiles      = dashFiles.filter(f => f.type === 'hands-on');
        let mulheresFiles   = dashFiles.filter(f => f.type === 'mulheres');
        let summerFiles     = dashFiles.filter(f => f.type === 'summer-job');
        let masterFiles     = dashFiles.filter(f => f.type === 'masterclass');
        let cissaLabFiles   = dashFiles.filter(f => f.type === 'cissa-lab');
        let cissaJourneyFiles = dashFiles.filter(f => f.type === 'cissa-journey');
        let sbsegFiles      = dashFiles.filter(f => f.type === 'sbseg');
        let html = '';

        const buildMenu = (files, typeKey, title) => {
            if (files.length === 0) return '';
            let menuHtml = `<button class="accordion-btn" onclick="toggleAccordion('acc-${typeKey}', this)">${title} <span class="arrow">▼</span></button>
                     <div class="accordion-content" id="acc-${typeKey}">
                         <button class="sub-btn" id="btn-${typeKey}_all" onclick="switchScope('${typeKey}_all')">Visão Geral (${title})</button>`;

            let uniqueYears = [...new Set(files.map(f => f.year).filter(y => y !== "Desconhecido"))].sort((a,b)=>b-a);
            if (uniqueYears.length > 0) {
                menuHtml += `<div class="sub-group-title">Por Ano</div>`;
                uniqueYears.forEach(y => { menuHtml += `<button class="sub-btn" id="btn-${typeKey}_year_${y}" onclick="switchScope('${typeKey}_year_${y}')">• Geral ${y}</button>`; });
            }

            let uniqueMonths = [...new Set(files.map(f => f.monthKey).filter(m => m !== "Desconhecido"))].sort((a,b) => {
                let [m1, y1] = a.split('_'); let [m2, y2] = b.split('_');
                if (y1 !== y2) return y2 - y1;
                return m2 - m1;
            });
            if (uniqueMonths.length > 0) {
                menuHtml += `<div class="sub-group-title">Por Mês</div>`;
                uniqueMonths.forEach(mKey => {
                    let [m, y] = mKey.split('_');
                    menuHtml += `<button class="sub-btn" id="btn-${typeKey}_month_${mKey}" onclick="switchScope('${typeKey}_month_${mKey}')">• ${monthNames[m]} de ${y}</button>`;
                });
            }

            menuHtml += `<div class="sub-group-title">Edições</div>`;
            const sortKey = f => (parseInt(f.year)||0)*10000 + (parseInt(f.month)||0)*100 + (parseInt(f.day)||0);
            // Numerar em ordem cronológica (1ª = mais antiga), exibir mais recente no topo
            const chronoFiles = [...files].sort((a, b) => sortKey(a) - sortKey(b));
            const editionNum  = new Map(chronoFiles.map((f, i) => [f.id, i + 1]));
            [...files].sort((a, b) => sortKey(b) - sortKey(a)).forEach(f => {
                const ord  = editionNum.get(f.id) + 'ª Ed.';
                const tema = f.type === 'cyberthon'
                    ? `Cyberthon ${f.year}`
                    : extractTitle(f.name) || f.name;
                const label = `${ord} — ${tema}`;
                menuHtml += `<button class="sub-btn" id="btn-${f.id}" onclick="switchScope('${f.id}')" title="${f.name}">- ${label}</button>`;
            });
            menuHtml += `</div>`;
            return menuHtml;
        };

        // ── Accordion Geral (todos os eventos) ──────────────────────────────
        const allFiles = dashFiles;
        if (allFiles.length > 0) {
            let geralHtml = `<button class="accordion-btn" onclick="toggleAccordion('acc-all', this)">Geral <span class="arrow">▼</span></button>
                     <div class="accordion-content" id="acc-all">
                         <button class="sub-btn" id="btn-all" onclick="switchScope('all')">Visão Geral (Todos)</button>`;

            const allYears = [...new Set(allFiles.map(f => f.year).filter(y => y !== 'Desconhecido'))].sort((a,b) => b - a);
            if (allYears.length > 0) {
                geralHtml += `<div class="sub-group-title">Por Ano</div>`;
                allYears.forEach(y => { geralHtml += `<button class="sub-btn" id="btn-all_year_${y}" onclick="switchScope('all_year_${y}')">• Geral ${y}</button>`; });
            }

            const allMonths = [...new Set(allFiles.map(f => f.monthKey).filter(m => m !== 'Desconhecido'))].sort((a,b) => {
                let [m1,y1] = a.split('_'); let [m2,y2] = b.split('_');
                if (y1 !== y2) return y2 - y1; return m2 - m1;
            });
            if (allMonths.length > 0) {
                geralHtml += `<div class="sub-group-title">Por Mês</div>`;
                allMonths.forEach(mKey => {
                    let [m, y] = mKey.split('_');
                    geralHtml += `<button class="sub-btn" id="btn-all_month_${mKey}" onclick="switchScope('all_month_${mKey}')">• ${monthNames[m]} de ${y}</button>`;
                });
            }
            geralHtml += `</div>`;
            html += geralHtml;
        }

        html += buildMenu(cyberFiles,       'cyberthon',    'Cyberthon');
        html += buildMenu(handsFiles,       'handson',      'Hands On');
        html += buildMenu(mulheresFiles,    'mulheres',     'Mulheres em Cibersegurança');
        html += buildMenu(summerFiles,      'summerjob',    'Summer Job');
        html += buildMenu(masterFiles,      'masterclass',  'Masterclass');
        html += buildMenu(cissaLabFiles,    'cissalab',     'CISSA Lab');
        html += buildMenu(cissaJourneyFiles,'cissajourney', 'CISSA Journey');
        html += buildMenu(sbsegFiles,       'sbseg',        'SBSeg');

        container.innerHTML = html;
        document.querySelectorAll('.project-btn.general').forEach(b => { if(!['btn-page-dash','btn-page-portfolio','btn-page-embrapii','btn-page-certificados'].includes(b.id)) b.classList.remove('active'); });
        document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
        let activeBtn = document.getElementById('btn-' + currentScope);
        if (activeBtn) {
            activeBtn.classList.add('active');
            let parentAcc = activeBtn.closest('.accordion-content');
            if (parentAcc) { parentAcc.classList.add('show'); parentAcc.previousElementSibling.classList.add('open'); }
        }
    }

    // Retorna o número de edição (ordem cronológica) de um arquivo entre os do mesmo tipo
    function getEditionNumber(file) {
        const sortKey = f => (parseInt(f.year)||0)*10000 + (parseInt(f.month)||0)*100 + (parseInt(f.day)||0);
        const sorted = uploadedFiles
            .filter(f => f.type === file.type)
            .sort((a, b) => sortKey(a) - sortKey(b));
        return sorted.findIndex(f => f.id === file.id) + 1;
    }

    function switchScope(scope) {
        switchPage('dash');
        currentScope = scope;
        document.querySelectorAll('.project-btn.general').forEach(b => { if(!['btn-page-dash','btn-page-portfolio','btn-page-embrapii','btn-page-certificados'].includes(b.id)) b.classList.remove('active'); });
        document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
        let activeBtn = document.getElementById('btn-' + scope);
        if (activeBtn) activeBtn.classList.add('active');

        let filesToProcess = [];
        if (scope === 'all') Object.assign(filesToProcess, uploadedFiles);
        else if (scope.startsWith('all_year_'))    filesToProcess = uploadedFiles.filter(f => f.year === scope.replace('all_year_', ''));
        else if (scope.startsWith('all_month_'))   filesToProcess = uploadedFiles.filter(f => f.monthKey === scope.replace('all_month_', ''));
        else if (scope === 'cyberthon_all')   filesToProcess = uploadedFiles.filter(f => f.type === 'cyberthon');
        else if (scope === 'handson_all')     filesToProcess = uploadedFiles.filter(f => f.type === 'hands-on');
        else if (scope === 'mulheres_all')    filesToProcess = uploadedFiles.filter(f => f.type === 'mulheres');
        else if (scope === 'summerjob_all')     filesToProcess = uploadedFiles.filter(f => f.type === 'summer-job');
        else if (scope === 'masterclass_all')    filesToProcess = uploadedFiles.filter(f => f.type === 'masterclass');
        else if (scope === 'cissalab_all')       filesToProcess = uploadedFiles.filter(f => f.type === 'cissa-lab');
        else if (scope === 'cissajourney_all')   filesToProcess = uploadedFiles.filter(f => f.type === 'cissa-journey');
        else if (scope === 'sbseg_all')          filesToProcess = uploadedFiles.filter(f => f.type === 'sbseg');
        else if (scope.startsWith('cyberthon_year_'))      filesToProcess = uploadedFiles.filter(f => f.type === 'cyberthon'     && f.year === scope.replace('cyberthon_year_', ''));
        else if (scope.startsWith('cyberthon_month_'))     filesToProcess = uploadedFiles.filter(f => f.type === 'cyberthon'     && f.monthKey === scope.replace('cyberthon_month_', ''));
        else if (scope.startsWith('handson_year_'))        filesToProcess = uploadedFiles.filter(f => f.type === 'hands-on'      && f.year === scope.replace('handson_year_', ''));
        else if (scope.startsWith('handson_month_'))       filesToProcess = uploadedFiles.filter(f => f.type === 'hands-on'      && f.monthKey === scope.replace('handson_month_', ''));
        else if (scope.startsWith('mulheres_year_'))       filesToProcess = uploadedFiles.filter(f => f.type === 'mulheres'      && f.year === scope.replace('mulheres_year_', ''));
        else if (scope.startsWith('mulheres_month_'))      filesToProcess = uploadedFiles.filter(f => f.type === 'mulheres'      && f.monthKey === scope.replace('mulheres_month_', ''));
        else if (scope.startsWith('summerjob_year_'))      filesToProcess = uploadedFiles.filter(f => f.type === 'summer-job'    && f.year === scope.replace('summerjob_year_', ''));
        else if (scope.startsWith('summerjob_month_'))     filesToProcess = uploadedFiles.filter(f => f.type === 'summer-job'    && f.monthKey === scope.replace('summerjob_month_', ''));
        else if (scope.startsWith('masterclass_year_'))    filesToProcess = uploadedFiles.filter(f => f.type === 'masterclass'   && f.year === scope.replace('masterclass_year_', ''));
        else if (scope.startsWith('masterclass_month_'))   filesToProcess = uploadedFiles.filter(f => f.type === 'masterclass'   && f.monthKey === scope.replace('masterclass_month_', ''));
        else if (scope.startsWith('cissalab_year_'))       filesToProcess = uploadedFiles.filter(f => f.type === 'cissa-lab'     && f.year === scope.replace('cissalab_year_', ''));
        else if (scope.startsWith('cissalab_month_'))      filesToProcess = uploadedFiles.filter(f => f.type === 'cissa-lab'     && f.monthKey === scope.replace('cissalab_month_', ''));
        else if (scope.startsWith('cissajourney_year_'))   filesToProcess = uploadedFiles.filter(f => f.type === 'cissa-journey' && f.year === scope.replace('cissajourney_year_', ''));
        else if (scope.startsWith('cissajourney_month_'))  filesToProcess = uploadedFiles.filter(f => f.type === 'cissa-journey' && f.monthKey === scope.replace('cissajourney_month_', ''));
        else if (scope.startsWith('sbseg_year_'))          filesToProcess = uploadedFiles.filter(f => f.type === 'sbseg'         && f.year === scope.replace('sbseg_year_', ''));
        else if (scope.startsWith('sbseg_month_'))         filesToProcess = uploadedFiles.filter(f => f.type === 'sbseg'         && f.monthKey === scope.replace('sbseg_month_', ''));
        else filesToProcess = uploadedFiles.filter(f => f.id === scope);

        // Levantamento files are cert-only — exclude from KPI/chart processing
        filesToProcess = filesToProcess.filter(f => f.type !== 'levantamento');

        let uniqueTypes = [...new Set(filesToProcess.map(f => f.type))];
        pTypeGlobal = uniqueTypes.length === 1 ? uniqueTypes[0] : 'unified';

        let title = "VISÃO GERAL (TODOS OS EVENTOS)";
        if      (scope === 'cyberthon_all')    title = "GERAL (CYBERTHON)";
        else if (scope === 'handson_all')    title = "GERAL (HANDS ON)";
        else if (scope === 'mulheres_all')   title = "GERAL (MULHERES EM CIBERSEGURANÇA)";
        else if (scope === 'summerjob_all')  title = "GERAL (SUMMER JOB)";
        else if (scope === 'cissalab_all')   title = "GERAL (CISSA LAB)";
        else if (scope === 'cissajourney_all') title = "GERAL (CISSA JOURNEY)";
        else if (scope === 'sbseg_all')        title = "GERAL (SBSEG)";
        else if (scope.startsWith('all_year_'))    title = "GERAL " + scope.replace('all_year_', '');
        else if (scope.startsWith('all_month_'))   { let [mm,yy]=scope.replace('all_month_','').split('_'); title="GERAL — "+monthNames[mm].toUpperCase()+" DE "+yy; }
        else if (scope.startsWith('cyberthon_year_'))  title = "CYBERTHON ANO: " + scope.replace('cyberthon_year_', '');
        else if (scope.startsWith('handson_year_'))    title = "HANDS ON ANO: " + scope.replace('handson_year_', '');
        else if (scope.startsWith('mulheres_year_'))   title = "MULHERES EM CIBERSEG. ANO: " + scope.replace('mulheres_year_', '');
        else if (scope.startsWith('summerjob_year_'))  title = "SUMMER JOB ANO: " + scope.replace('summerjob_year_', '');
        else if (scope.startsWith('cyberthon_month_')) { let [mm,yy]=scope.replace('cyberthon_month_','').split('_'); title="CYBERTHON MÊS: "+monthNames[mm].toUpperCase()+" DE "+yy; }
        else if (scope.startsWith('handson_month_'))   { let [mm,yy]=scope.replace('handson_month_','').split('_');   title="HANDS ON MÊS: "+monthNames[mm].toUpperCase()+" DE "+yy; }
        else if (scope.startsWith('mulheres_month_'))  { let [mm,yy]=scope.replace('mulheres_month_','').split('_');  title="MULHERES EM CIBERSEG. MÊS: "+monthNames[mm].toUpperCase()+" DE "+yy; }
        else if (scope.startsWith('summerjob_month_')) { let [mm,yy]=scope.replace('summerjob_month_','').split('_'); title="SUMMER JOB MÊS: "+monthNames[mm].toUpperCase()+" DE "+yy; }
        else if (scope.startsWith('sbseg_year_'))      title = "SBSEG ANO: " + scope.replace('sbseg_year_', '');
        else if (scope.startsWith('sbseg_month_'))     { let [mm,yy]=scope.replace('sbseg_month_','').split('_'); title="SBSEG MÊS: "+monthNames[mm].toUpperCase()+" DE "+yy; }
        else if (scope !== 'all') {
            let f = uploadedFiles.find(x => x.id === scope);
            if (f) {
                const n   = getEditionNumber(f);
                const ord = n + 'ª Edição';
                if (f.type === 'hands-on') {
                    title = extractTitle(f.name).toUpperCase() + ' — ' + ord.toUpperCase();
                } else if (f.type === 'cyberthon') {
                    title = 'CYBERTHON ' + f.year + ' — ' + ord.toUpperCase();
                } else {
                    title = extractTitle(f.name).toUpperCase() + ' — ' + ord.toUpperCase();
                }
            }
        }

        document.getElementById('top-title').innerText = title;
        const showBanca = pTypeGlobal === 'cyberthon';
        document.getElementById('tab-banca').classList.toggle('hidden', !showBanca);
        if (currentView === 'banca' && !showBanca) switchView('geral');
        else if (pTypeGlobal === 'summer-job' || pTypeGlobal === 'masterclass') switchView('ativos');
        else switchView('geral');
    }

    function switchView(view) {
        currentView = view;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const tabId = view === 'avaliacao' ? 'eval' : view === 'abandono' ? 'abandon' : view;
        document.getElementById('tab-' + tabId).classList.add('active');

        document.getElementById('dashboard-content').classList.toggle('hidden',    view !== 'geral');
        document.getElementById('engagement-content').classList.toggle('hidden',   view !== 'ativos');
        document.getElementById('abandon-content').classList.toggle('hidden',      view !== 'abandono');
        document.getElementById('evaluation-content').classList.toggle('hidden',   view !== 'avaliacao');
        document.getElementById('banca-content').classList.toggle('hidden',        view !== 'banca');
        document.getElementById('mc-perm-content').classList.toggle('hidden',      view !== 'mc-perm');
        document.getElementById('mc-cert-content').classList.toggle('hidden',      view !== 'mc-cert');
        document.getElementById('kpi-grid').classList.toggle('hidden', view !== 'ativos');

        renderDashboard();
    }

    function getChartType(dataObj) {
        let countKeys = Object.keys(dataObj).filter(k => k !== 'Não Informado' && dataObj[k] > 0).length;
        return countKeys <= 2 ? 'pie' : 'bar';
    }

    function clearDashboardState() {
        document.getElementById('kpi-grid').innerHTML = `<div class="kpi-card" style="grid-column: span 3;"><span>Aviso</span><div style="font-size: 1.1rem; color: var(--text-muted);">Nenhum dado de inscrição encontrado para esta seleção.</div></div>`;
        Object.keys(charts).forEach(id => { charts[id].destroy(); delete charts[id]; });
        document.getElementById('comment-list').innerHTML = '';
        document.getElementById('banca-comment-list').innerHTML = '';
        document.getElementById('banca-criteria-grid').innerHTML = '';
        document.getElementById('data-warning').classList.add('hidden');
    }
