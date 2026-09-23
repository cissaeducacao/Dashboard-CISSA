    // ── Itens fixos "Em Formação" ────────────────────────────────────────────
    const EMBRAPII_EM_FORMACAO = [
        { nome: 'Especialização OpenRan',         categoria: 'Especialização', inicio: '2024' },
        { nome: 'EAD Cyber para Executivos',      categoria: 'Curta Duração',  inicio: '2024' }
    ];

    const _EBAR_TIPO_COLORS = {
        'cyberthon':    '#375B95',
        'hands-on':     '#D25600',
        'mulheres':     'rgba(55,91,149,0.52)',
        'summer-job':   'rgba(210,86,0,0.52)',
        'masterclass':  '#232323',
        'cissa-lab':    '#888888',
        'cissa-journey':'rgba(55,91,149,0.78)',
        'sbseg':        'rgba(210,86,0,0.78)'
    };
    const _EBAR_TIPO_LABELS = {
        'cyberthon':'Cyberthon','hands-on':'Hands On','mulheres':'Mulheres em Ciber',
        'summer-job':'Summer Job','masterclass':'Masterclass','cissa-lab':'CISSA Lab',
        'cissa-journey':'CISSA Journey','sbseg':'SBSeg'
    };

    function _buildEmbrapiiBarChart(filtered) {
        if (charts['c-embrapii-bar']) { charts['c-embrapii-bar'].destroy(); delete charts['c-embrapii-bar']; }
        if (!filtered.length) return;
        const isDark  = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#E8E8E8' : '#232323';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        const barLabels = filtered.map(c => c.label);
        const typesInBar = [...new Set(filtered.map(c => c.tipo))].filter(t => _EBAR_TIPO_LABELS[t]);
        const barDatasets = typesInBar.map(tipo => ({
            label: _EBAR_TIPO_LABELS[tipo] || tipo,
            data: filtered.map(c => c.tipo === tipo ? c.certs : NaN),
            backgroundColor: _EBAR_TIPO_COLORS[tipo] || '#375B95',
            borderRadius: 4,
            barThickness: 'flex'
        }));
        const rowH   = 28;
        const chartH = Math.max(200, filtered.length * rowH + 60);
        const barCanvas = document.getElementById('c-embrapii-bar');
        const barScroll = document.getElementById('embrapii-bar-scroll');
        if (barCanvas) { barCanvas.style.height = chartH + 'px'; barCanvas.style.width = '100%'; barCanvas.height = chartH; }
        if (barScroll) barScroll.style.height = Math.min(chartH, 520) + 'px';
        charts['c-embrapii-bar'] = new Chart(barCanvas, {
            type: 'bar',
            data: { labels: barLabels, datasets: barDatasets },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: textColor, boxWidth: 12, font: { size: 11, family: "'DM Sans',sans-serif" }, padding: 14 } },
                    tooltip: { callbacks: { label: c => ` ${isNaN(c.raw) ? '' : c.raw + ' certificados'}` } },
                    datalabels: { color: textColor, font: { weight: 'bold', size: 10, family: "'DM Sans',sans-serif" }, anchor: 'end', align: 'end', offset: 3, formatter: v => (v > 0 && !isNaN(v)) ? v : '' }
                },
                scales: {
                    y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
                    x: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
                }
            }
        });
    }

    function _applyEmbrapiiFilters() {
        const d = window._embrapiiBarData;
        if (!d) return;
        const filtered = d.allCursos.filter(c => {
            const typeOk = d.typeFilter === 'all' || c.tipo === d.typeFilter;
            const yearOk = d.yearFilter === 'all' || String(c.ano) === String(d.yearFilter);
            return typeOk && yearOk;
        });
        _buildEmbrapiiBarChart(filtered);
    }

    function applyEmbrapiiTypeFilter(type, btn) {
        document.querySelectorAll('.ebar-type-chip').forEach(c => c.classList.remove('active'));
        if (btn) btn.classList.add('active');
        if (window._embrapiiBarData) window._embrapiiBarData.typeFilter = type;
        _applyEmbrapiiFilters();
    }

    function applyEmbrapiiYearFilter(year, btn) {
        document.querySelectorAll('.ebar-year-chip').forEach(c => c.classList.remove('active'));
        if (btn) btn.classList.add('active');
        if (window._embrapiiBarData) window._embrapiiBarData.yearFilter = year;
        _applyEmbrapiiFilters();
    }

    function renderEmbrapii(allFiles) {
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#E8E8E8' : '#232323';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        ['c-embrapii-pizza','c-embrapii-bar'].forEach(id => { if(charts[id]) { charts[id].destroy(); delete charts[id]; } });

        // ── Calcula certs por arquivo ───────────────────────────────────────
        const cursos = []; // { label, categoria, ano, mes, certs }

        allFiles.forEach(fObj => {
            const pres  = getSheetData(fObj.data, [/presen/]) || [];
            const certF = getSheetData(fObj.data, [/certificados facilitadores/, /certificados fac/]) || [];
            const certM = getSheetData(fObj.data, [/certificados mentores/, /certificados men/]) || [];

            let alunosCerts = 0;
            if (fObj.type === 'mulheres') {
                const certSheet = getSheetData(fObj.data, [/participante.*certif|certif.*participante|participante|certifi/]) || [];
                const cpfSet = new Set();
                certSheet.forEach(r => {
                    const k = Object.keys(r).find(k => /cpf/i.test(normalize(k)));
                    if (k && r[k]) cpfSet.add(String(r[k]).replace(/\D/g,'').trim());
                });
                alunosCerts = cpfSet.size;
            } else if (fObj.type === 'summer-job') {
                const linked = new Set();
                pres.forEach(r => {
                    if (rowHasCertLink(r)) {
                        const ids = getIdsFromRow(r);
                        const id = ids.cpfs[0] || ids.emails[0] || ids.nomes[0];
                        if (id) linked.add(id);
                    }
                });
                alunosCerts = linked.size;
            } else if (fObj.type === 'masterclass') {
                alunosCerts = getMasterclassMetrics(fObj).certs;
            } else {
                const linked = new Set();
                pres.forEach(r => {
                    if (rowHasCertLink(r)) {
                        const ids = getIdsFromRow(r);
                        const id = ids.cpfs[0] || ids.emails[0] || ids.nomes[0];
                        if (id) linked.add(id);
                    }
                });
                if (fObj.type === 'cyberthon') {
                    alunosCerts = Math.min(linked.size, pres.length);
                } else {
                    alunosCerts = linked.size;
                }
            }

            const facil = countLinks(certF);
            const ment  = countLinks(certM);
            const totalFile = alunosCerts + facil + ment;

            const categoria = fObj.type === 'cyberthon'      ? 'Curta Duração'
                            : fObj.type === 'hands-on'       ? 'Curta Duração'
                            : fObj.type === 'mulheres'       ? 'Curta Duração'
                            : fObj.type === 'summer-job'     ? 'Curta Duração'
                            : fObj.type === 'masterclass'    ? 'Curta Duração'
                            : fObj.type === 'cissa-lab'      ? 'Curta Duração'
                            : fObj.type === 'cissa-journey'  ? 'Curta Duração'
                            : fObj.type === 'sbseg'          ? 'Curta Duração'
                            : 'Outros';

            cursos.push({
                label:       getDisplayName(fObj) || fObj.name,
                tipo:        fObj.type,
                tipoLabel:   fObj.type === 'cyberthon'      ? 'Cyberthon'
                           : fObj.type === 'hands-on'       ? 'Hands On'
                           : fObj.type === 'mulheres'       ? 'Mulheres em Ciber'
                           : fObj.type === 'summer-job'     ? 'Summer Job'
                           : fObj.type === 'masterclass'    ? 'Masterclass'
                           : fObj.type === 'cissa-lab'      ? 'CISSA Lab'
                           : fObj.type === 'cissa-journey'  ? 'CISSA Journey'
                           : fObj.type === 'sbseg'          ? 'SBSeg'
                           : 'Outros',
                categoria,
                ano:         fObj.year   || '—',
                mes:         fObj.month  || '—',
                certs:       totalFile,
                certsAlunos: alunosCerts,
                certsFacil:  facil,
                certsMent:   ment
            });
        });

        // ── Totais por categoria ────────────────────────────────────────────
        const totalCurtaDuracao  = cursos.filter(c => c.categoria === 'Curta Duração').reduce((s,c) => s + c.certs, 0);
        const totalFormados      = 0; // sem dados ainda (School)
        const totalEmFormacao    = EMBRAPII_EM_FORMACAO.length;
        const totalGeral         = totalCurtaDuracao + totalFormados;

        // ── KPI cards ───────────────────────────────────────────────────────
        const kpiEl = document.getElementById('embrapii-kpi');
        if (kpiEl) kpiEl.innerHTML = `
            <div class="kpi-card" style="background:var(--blue-dark);border-color:var(--blue-dark);">
                <span style="color:#fff;opacity:.8;">TOTAL DE CERTIFICADOS</span>
                <div style="color:var(--orange);font-size:2rem;">${totalGeral}</div>
            </div>
            <div class="kpi-card">
                <span>CURTA DURAÇÃO</span>
                <div style="color:var(--blue-dark);">${totalCurtaDuracao}</div>
                <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">Cyberthon · Hands On · Mulheres em Ciber · Summer Job · Masterclass · CISSA Lab · CISSA Journey · SBSeg</div>
            </div>
            <div class="kpi-card">
                <span>EM FORMAÇÃO</span>
                <div style="color:var(--blue-dark);">${totalEmFormacao}</div>
                <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">Programas em andamento</div>
            </div>
            <div class="kpi-card" style="opacity:.6;">
                <span>FORMADOS (GRADUAÇÃO + ESPECIALIZAÇÃO)</span>
                <div style="color:var(--text-muted);">—</div>
                <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">Dados da School em breve</div>
            </div>`;

        // ── Lista "Em Formação" ──────────────────────────────────────────────
        const formacaoList = document.getElementById('embrapii-formacao-list');
        if (formacaoList) formacaoList.innerHTML = EMBRAPII_EM_FORMACAO.map(item => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-radius:8px;background:rgba(0,0,0,0.04);border-left:3px solid var(--blue-dark);">
                <div>
                    <div style="font-weight:600;font-size:0.95rem;">${item.nome}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">${item.categoria} · Início ${item.inicio}</div>
                </div>
                <span style="font-size:0.7rem;color:var(--orange);font-weight:700;background:rgba(210,86,0,0.1);padding:3px 8px;border-radius:20px;">EM ANDAMENTO</span>
            </div>`).join('');

        // ── Pizza: proporção por categoria ──────────────────────────────────
        const pieLabels = [], pieData = [], pieColors = [];
        if (totalCurtaDuracao > 0) { pieLabels.push('Curta Duração'); pieData.push(totalCurtaDuracao); pieColors.push('#375B95'); }
        if (totalFormados > 0)     { pieLabels.push('Formados');      pieData.push(totalFormados);     pieColors.push('#D25600'); }

        if (pieData.length > 0) {
            const total = pieData.reduce((a,b) => a+b, 0);
            charts['c-embrapii-pizza'] = new Chart(document.getElementById('c-embrapii-pizza'), {
                type: 'pie',
                data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: pieColors, borderColor: isDark ? '#1e1e1e' : '#fff', borderWidth: 2 }] },
                options: {
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    plugins: {
                        legend: { display: true, position: 'right', labels: { color: textColor, boxWidth: 12, font: { size: 11, family: "'DM Sans',sans-serif" } } },
                        tooltip: { callbacks: { label: c => ` ${c.raw} (${total > 0 ? ((c.raw/total)*100).toFixed(1) : 0}%)` } },
                        datalabels: { color: '#fff', font: { weight: 'bold', size: 12 }, formatter: v => total > 0 && v > 0 ? ((v/total)*100).toFixed(1)+'%' : '' }
                    }
                }
            });
        }

        // ── Barras horizontais: mais recente → mais antigo, com filtros ──────
        const barSorted = [...cursos].sort((a, b) => {
            const ya = parseInt(a.ano)||0, yb = parseInt(b.ano)||0;
            if (ya !== yb) return yb - ya;
            return (parseInt(b.mes)||0) - (parseInt(a.mes)||0);
        });

        window._embrapiiBarData = { allCursos: barSorted, typeFilter: 'all', yearFilter: 'all' };

        const filtersBarEl = document.getElementById('embrapii-bar-filters');
        if (filtersBarEl) {
            const typesPresent = [...new Set(barSorted.map(c => c.tipo))].filter(t => _EBAR_TIPO_LABELS[t]);
            const yearsPresent = [...new Set(barSorted.map(c => c.ano).filter(y => y && y !== '—' && y !== 'Desconhecido'))].sort((a,b) => b-a);
            const chipB = 'style="background:#375B95;color:#fff;"';
            const chipD = 'style="background:#232323;color:#fff;"';
            let html = '';
            if (typesPresent.length > 1) {
                html += `<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">`;
                html += `<span style="font-size:0.68rem;color:var(--text-muted);margin-right:2px;">Tipo</span>`;
                html += `<button class="funnel-chip ebar-type-chip active" ${chipB} onclick="applyEmbrapiiTypeFilter('all',this)">Todos</button>`;
                html += typesPresent.map(t => `<button class="funnel-chip ebar-type-chip" ${chipB} onclick="applyEmbrapiiTypeFilter('${t}',this)">${_EBAR_TIPO_LABELS[t]}</button>`).join('');
                html += `</div>`;
            }
            if (yearsPresent.length > 1) {
                html += `<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">`;
                html += `<span style="font-size:0.68rem;color:var(--text-muted);margin-right:2px;">Ano</span>`;
                html += `<button class="funnel-chip ebar-year-chip active" ${chipD} onclick="applyEmbrapiiYearFilter('all',this)">Todos</button>`;
                html += yearsPresent.map(y => `<button class="funnel-chip ebar-year-chip" ${chipD} onclick="applyEmbrapiiYearFilter('${y}',this)">${y}</button>`).join('');
                html += `</div>`;
            }
            filtersBarEl.style.display = html ? 'flex' : 'none';
            filtersBarEl.innerHTML = html;
        }

        _buildEmbrapiiBarChart(barSorted);

        // ── Tabela de detalhamento ───────────────────────────────────────────
        const monthNamesShort = { '01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun','07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez' };
        const badgeClass = cat => cat === 'Curta Duração' ? 'curta' : cat === 'Em Formação' ? 'form' : 'outros';
        const fmtAnoMes  = c => (c.mes && c.mes !== '00' && c.mes !== '—' && c.mes !== 'Desconhecido')
            ? (monthNamesShort[c.mes] || c.mes) + '/' + c.ano : c.ano;

        // Agrupa por tipo para linhas de subtotal
        const tiposOrder = ['Cyberthon', 'Hands On', 'Mulheres em Ciber', 'Summer Job', 'Masterclass', 'CISSA Lab', 'CISSA Journey', 'SBSeg'];
        const grupos = {};
        cursos.forEach(c => {
            const t = c.tipoLabel;
            if (!grupos[t]) grupos[t] = { alunos: 0, facil: 0, ment: 0, total: 0, edições: [] };
            grupos[t].alunos += c.certsAlunos;
            grupos[t].facil  += c.certsFacil;
            grupos[t].ment   += c.certsMent;
            grupos[t].total  += c.certs;
            grupos[t].edições.push(c);
        });

        const tbody = document.getElementById('embrapii-table-body');
        if (tbody) {
            let html = '';
            const totAlunos = cursos.reduce((s,c) => s + c.certsAlunos, 0);
            const totFacil  = cursos.reduce((s,c) => s + c.certsFacil, 0);
            const totMent   = cursos.reduce((s,c) => s + c.certsMent, 0);
            const totGeral  = cursos.reduce((s,c) => s + c.certs, 0);

            // ── TOTAIS no topo ─────────────────────────────────────────────
            html += `<tr style="background:var(--blue-dark);color:#fff;font-weight:700;">
                <td style="color:#fff;">TOTAL GERAL</td>
                <td>—</td>
                <td style="text-align:center;color:var(--orange);">${totGeral}</td>
                <td style="text-align:center;color:#fff;">${totAlunos}</td>
                <td style="text-align:center;color:#fff;">${totMent > 0 ? totMent : '—'}</td>
                <td style="text-align:center;color:#fff;">${totFacil > 0 ? totFacil : '—'}</td>
                <td></td>
            </tr>`;
            tiposOrder.forEach(tipo => {
                const g = grupos[tipo];
                if (!g) return;
                html += `<tr style="background:rgba(55,91,149,0.08);font-weight:700;">
                    <td style="color:var(--blue-dark);padding-left:20px;">↳ ${tipo}</td>
                    <td>—</td>
                    <td style="text-align:center;color:var(--blue-dark);">${g.total}</td>
                    <td style="text-align:center;color:var(--blue-dark);">${g.alunos}</td>
                    <td style="text-align:center;color:var(--blue-dark);">${g.ment > 0 ? g.ment : '—'}</td>
                    <td style="text-align:center;color:var(--blue-dark);">${g.facil > 0 ? g.facil : '—'}</td>
                    <td><span class="embrapii-badge curta">Curta Duração</span></td>
                </tr>`;
            });
            EMBRAPII_EM_FORMACAO.forEach(item => {
                html += `<tr style="background:rgba(210,86,0,0.05);font-weight:600;">
                    <td style="color:var(--orange);padding-left:20px;">↳ ${item.nome}</td>
                    <td>${item.inicio}</td>
                    <td style="text-align:center;">—</td>
                    <td style="text-align:center;">—</td>
                    <td style="text-align:center;">—</td>
                    <td style="text-align:center;">—</td>
                    <td><span class="embrapii-badge form">Em Formação</span></td>
                </tr>`;
            });

            // ── Separador ──────────────────────────────────────────────────
            html += `<tr><td colspan="7" style="padding:6px;background:transparent;border-bottom:2px solid var(--border);"></td></tr>`;

            // ── Edições individuais por tipo ───────────────────────────────
            tiposOrder.forEach(tipo => {
                const g = grupos[tipo];
                if (!g) return;
                g.edições.forEach(c => {
                    html += `<tr>
                        <td style="padding-left:20px;">${c.label}</td>
                        <td>${fmtAnoMes(c)}</td>
                        <td style="text-align:center;">${c.certs}</td>
                        <td style="text-align:center;">${c.certsAlunos}</td>
                        <td style="text-align:center;">${c.certsMent > 0 ? c.certsMent : '—'}</td>
                        <td style="text-align:center;">${c.certsFacil > 0 ? c.certsFacil : '—'}</td>
                        <td><span class="embrapii-badge curta">${c.categoria}</span></td>
                    </tr>`;
                });
            });
            // Em Formação (detalhes)
            EMBRAPII_EM_FORMACAO.forEach(item => {
                html += `<tr>
                    <td style="padding-left:20px;">${item.nome}</td>
                    <td>${item.inicio}</td>
                    <td style="text-align:center;">—</td>
                    <td style="text-align:center;">—</td>
                    <td style="text-align:center;">—</td>
                    <td style="text-align:center;">—</td>
                    <td><span class="embrapii-badge form">Em Formação</span></td>
                </tr>`;
            });
            tbody.innerHTML = html;
        }


        // Guarda para export CSV
        window._embrapiiTableRows = [
            ...cursos.map(c => ({ nome: c.label, anoMes: fmtAnoMes(c), certs: c.certs, alunos: c.certsAlunos, ment: c.certsMent, facil: c.certsFacil, categoria: c.categoria, tipo: c.tipoLabel })),
            ...EMBRAPII_EM_FORMACAO.map(i => ({ nome: i.nome, anoMes: i.inicio, certs: '—', alunos: '—', ment: '—', facil: '—', categoria: 'Em Formação', tipo: i.categoria }))
        ];
    }

    function exportEmbrapiiCSV() {
        const rows = window._embrapiiTableRows || [];
        const header = ['Ação/Curso', 'Tipo', 'Ano/Mês', 'Total Certificados', 'Certificados Alunos', 'Certificados Mentores', 'Certificados Facilitadores', 'Categoria'];
        const lines  = [header.join(';'), ...rows.map(r => [
            '"' + String(r.nome).replace(/"/g, '""') + '"',
            r.tipo, r.anoMes, r.certs, r.alunos, r.ment, r.facil, r.categoria
        ].join(';'))];
        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'embrapii_formacoes.csv' });
        a.click(); URL.revokeObjectURL(a.href);
    }
