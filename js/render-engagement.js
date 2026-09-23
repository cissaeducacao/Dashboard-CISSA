    const _FUNNEL_TYPE_COLORS = {
        'cyberthon':'#375B95','hands-on':'#D25600','mulheres':'#375B95',
        'summer-job':'#D25600','masterclass':'#375B95','cissa-lab':'#D25600',
        'cissa-journey':'#375B95','sbseg':'#232323'
    };
    const _FUNNEL_TYPE_NAMES = {
        'cyberthon':'Cyberthon','hands-on':'Hands On','mulheres':'Mulheres em Ciber',
        'summer-job':'Summer Job','masterclass':'Masterclass','cissa-lab':'CISSA Lab',
        'cissa-journey':'CISSA Journey','sbseg':'SBSeg'
    };

    function _buildFunnelChart(labels, fullLabels, inscritos, participacoes, certificados, bgColors) {
        if (charts['c-engage-funnel']) { charts['c-engage-funnel'].destroy(); delete charts['c-engage-funnel']; }
        if (!labels.length) return;
        const isDark = document.body.classList.contains('dark-mode');
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        const textColor = isDark ? '#E8E8E8' : '#232323';
        const rowH  = Math.max(48, Math.min(72, Math.floor(400 / labels.length)));
        const chartH = labels.length * rowH + 60;
        const funnelInner = document.getElementById('funnel-scroll-inner');
        if (funnelInner) {
            funnelInner.style.height = chartH + 'px';
            funnelInner.parentElement.scrollTop = 0;
        }
        const canvas = document.getElementById('c-engage-funnel');
        if (canvas) { canvas.style.height = chartH + 'px'; canvas.height = chartH; }

        const MAX_LABEL_LEN = 28;
        const truncLabel = s => s.length > MAX_LABEL_LEN ? s.slice(0, MAX_LABEL_LEN - 1) + '…' : s;

        let funnelPinned = null;
        charts['c-engage-funnel'] = new Chart(canvas, {
            type: 'bar',
            data: { labels: labels.map(truncLabel), datasets: [
                { label: 'Inscrições',    data: inscritos,     backgroundColor: 'rgba(55,91,149,0.38)', maxBarThickness: 18 },
                { label: 'Participações', data: participacoes, backgroundColor: '#375B95',              maxBarThickness: 18 },
                { label: 'Certificados',  data: certificados,  backgroundColor: '#D25600',              maxBarThickness: 18 }
            ]},
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                onClick(evt, elements, chart) {
                    const pos = { x: evt.offsetX ?? 0, y: evt.offsetY ?? 0 };
                    if (!elements.length) { funnelPinned = null; chart.tooltip.setActiveElements([], pos); chart.update('none'); return; }
                    const active = elements.map(e => ({ datasetIndex: e.datasetIndex, index: e.index }));
                    const sameIndex = funnelPinned && funnelPinned[0]?.index === active[0]?.index;
                    funnelPinned = sameIndex ? null : active;
                    chart.tooltip.setActiveElements(funnelPinned || [], pos);
                    chart.update('none');
                },
                plugins: {
                    legend: { position: 'top', labels: { color: textColor, boxWidth: 12, font: { size: 11, family: "'DM Sans',sans-serif" } } },
                    datalabels: { color: '#fff', font: { weight: 'bold', size: 9 }, anchor: 'end', align: 'end', offset: 2, formatter: v => v > 0 ? v : '' },
                    tooltip: { mode: 'index', intersect: false,
                        callbacks: { title: (items) => fullLabels[items[0]?.dataIndex] || items[0]?.label || '' }
                    }
                },
                scales: {
                    y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: 'transparent' } },
                    x: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
                }
            },
            plugins: [{
                id: 'pinnedTooltip',
                afterEvent(chart, args) {
                    if (!funnelPinned || !args.event.native) return;
                    if (args.event.type === 'mousemove') {
                        const pts = chart.getElementsAtEventForMode(args.event.native, 'index', { intersect: false }, true);
                        if (!pts.length) {
                            chart.tooltip.setActiveElements(funnelPinned, { x: args.event.x ?? 0, y: args.event.y ?? 0 });
                            chart.update('none');
                        }
                    }
                }
            }]
        });
        // Tooltip ao passar sobre labels truncadas no eixo Y
        (function() {
            const ch = charts['c-engage-funnel'];
            let tip = document.getElementById('_funnelLabelTip');
            if (!tip) {
                tip = document.createElement('div');
                tip.id = '_funnelLabelTip';
                tip.style.cssText = 'position:fixed;background:rgba(30,30,30,.92);color:#fff;padding:5px 10px;border-radius:6px;font-size:12px;pointer-events:none;display:none;z-index:9999;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)';
                document.body.appendChild(tip);
            }
            canvas.addEventListener('mousemove', function(e) {
                const rect = canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left, my = e.clientY - rect.top;
                const yScale = ch.scales.y;
                if (!yScale || mx > ch.chartArea.left) { tip.style.display = 'none'; return; }
                let found = -1;
                for (let i = 0; i < labels.length; i++) {
                    const py = yScale.getPixelForValue(i);
                    if (Math.abs(my - py) < rowH / 1.5) { found = i; break; }
                }
                if (found >= 0 && fullLabels[found] !== labels[found]) {
                    tip.textContent = fullLabels[found];
                    tip.style.left = (e.clientX + 12) + 'px';
                    tip.style.top  = (e.clientY - 34) + 'px';
                    tip.style.display = 'block';
                } else { tip.style.display = 'none'; }
            });
            canvas.addEventListener('mouseleave', () => tip.style.display = 'none');
        })();
    }

    function _applyFunnelFilters() {
        const fd = window._funnelAllData;
        if (!fd) return;
        const typeF = window._funnelTypeFilter || 'all';
        const yearF = window._funnelYearFilter || 'all';
        const idxs = fd.sortedFiles.reduce((acc, f, i) => {
            const typeOk = typeF === 'all' || f.type === typeF;
            const yearOk = yearF === 'all' || String(f.year) === String(yearF);
            if (typeOk && yearOk) acc.push(i);
            return acc;
        }, []);
        _buildFunnelChart(
            idxs.map(i => fd.labels[i]),
            idxs.map(i => fd.fullLabels[i]),
            idxs.map(i => fd.inscritos[i]),
            idxs.map(i => fd.participacoes[i]),
            idxs.map(i => fd.certificados[i]),
            idxs.map(i => fd.bgColors[i])
        );
    }

    function applyFunnelFilter(type, btn) {
        document.querySelectorAll('.funnel-type-chip').forEach(c => c.classList.remove('active'));
        if (btn) btn.classList.add('active');
        window._funnelTypeFilter = type;
        _applyFunnelFilters();
    }

    function applyFunnelYearFilter(year, btn) {
        document.querySelectorAll('.funnel-year-chip').forEach(c => c.classList.remove('active'));
        if (btn) btn.classList.add('active');
        window._funnelYearFilter = year;
        _applyFunnelFilters();
    }

    function getDailyPresenceData(fObj) {
        const data = fObj.data;
        const PRESENT = new Set(['1','TRUE','SIM','VERDADEIRO','V','X','S','PRESENT','P']);
        let presRows = null, dayKeys = [];

        // Detecta colunas de dia: "08/04", "DIA 1", "DIA_2", "DIA (08/04)", "Dia 08/04", "D1"
        const isDateCol = k => {
            const kt = k.trim();
            return /^\d{1,2}[\/\-\.]\d{1,2}(\/\d{2,4})?(\s.*)?$/.test(kt)  // "08/04", "08/04/2025", "09/09 (Seg)"
                || /\bdia[\s_]*[\d\(]/i.test(kt)                              // "DIA 1", "DIA_2", "DIA (08/04)"
                || /^d\d+$/i.test(kt)                                         // "D1", "D2"
                || /\bsemana[\s_]*\d/i.test(kt)                               // "Semana 1", "Semana_2"
                || /\b\d{1,2}[\/\-\.]\d{1,2}(\/\d{2,4})?\b/.test(kt);       // data embutida: "Presença 09/09"
        };

        if (fObj.type === 'cissa-journey') {
            const pk = Object.keys(data).find(k => /controle.*presen|presen/i.test(normalize(k)));
            if (!pk || !data[pk].length) return null;
            presRows = data[pk];
            dayKeys = Object.keys(presRows[0] || {})
                .filter(k => /^\d{2}\/\d{2}$/.test(k))
                .sort((a, b) => {
                    const [da, ma] = a.split('/').map(Number);
                    const [db, mb] = b.split('/').map(Number);
                    return ma !== mb ? ma - mb : da - db;
                });
        } else if (fObj.type === 'hands-on') {
            // Hands On: busca aba de presença, tenta colunas por dia; se não houver, trata como sessão única
            const pk = Object.keys(data).find(k => /presen/i.test(normalize(k)));
            if (!pk || !data[pk].length) return null;
            presRows = data[pk];
            dayKeys = Object.keys(presRows[0] || {}).filter(isDateCol);
            if (dayKeys.length === 0) {
                // Sessão única: conta quem tem coluna de presença marcada como TRUE/SIM
                const presKey = Object.keys(presRows[0] || {}).find(k => {
                    const nk = normalize(k);
                    return /presen/i.test(nk) && !/nome|cpf|email|matricula|certif/i.test(nk);
                });
                const count = presKey
                    ? presRows.filter(r => PRESENT.has(String(r[presKey] || '').toUpperCase().trim())).length
                    : presRows.length;
                return { dayKeys: ['Sessão'], dailyPresent: [count], daily80plus: [count], total: presRows.length, threshold: 1.0, singleSession: true };
            }
        } else {
            // Cyberthon / summer-job / outros: detecta colunas de dia
            const pk = Object.keys(data).find(k => /presen|frequen/i.test(normalize(k)));
            if (!pk || !data[pk].length) return null;
            presRows = data[pk];
            const allCols = Object.keys(presRows[0] || {});

            // 1ª tentativa: padrão de data no nome bruto ("08/04", "DIA 1", "DIA (08/04)")
            dayKeys = allCols.filter(isDateCol);

            // 2ª tentativa: normalizado — colunas com "presença/dia" + dígito ("PRESENÇA DIA 1", "Presença 1")
            if (dayKeys.length === 0) {
                dayKeys = allCols.filter(k => {
                    const nk = normalize(k);
                    return (/presen|compare/i.test(nk) || /\bdia\b/i.test(nk))
                        && /\d/.test(nk)
                        && !/certif|link|url/i.test(nk);
                });
                // Ordena pelo primeiro dígito encontrado no nome normalizado
                if (dayKeys.length > 1) {
                    dayKeys.sort((a, b) => {
                        const da = parseInt((normalize(a).match(/\d+/) || ['0'])[0]);
                        const db = parseInt((normalize(b).match(/\d+/) || ['0'])[0]);
                        return da - db;
                    });
                }
            }

            // Fallback final: coluna booleana ou numérica ("PRESENÇA" = TRUE/FALSE ou número de dias)
            if (dayKeys.length === 0) {
                const presKey = allCols.find(k => {
                    const nk = normalize(k);
                    return /presen/i.test(nk) && !/nome|cpf|email|matricula|certif/i.test(nk);
                });
                if (presKey) {
                    const count = presRows.filter(r => {
                        const val = String(r[presKey] || '').toUpperCase().trim();
                        const num = parseFloat(val);
                        return PRESENT.has(val) || (!isNaN(num) && num > 0);
                    }).length;
                    return { dayKeys: ['Sessão'], dailyPresent: [count], daily80plus: [count], total: presRows.length, threshold: 1.0, singleSession: true };
                }
            }
        }

        if (!presRows || dayKeys.length < 1) return null;

        const threshold = fObj.type === 'cissa-journey' ? 0.8 : 1.0;
        const dailyPresent = [], daily80plus = [];
        dayKeys.forEach((dk, di) => {
            let presentCount = 0, hasThreshold = 0;
            presRows.forEach(row => {
                if (PRESENT.has(String(row[dk] || '').toUpperCase().trim())) presentCount++;
                let att = 0;
                for (let d = 0; d <= di; d++) {
                    if (PRESENT.has(String(row[dayKeys[d]] || '').toUpperCase().trim())) att++;
                }
                if (att / (di + 1) >= threshold) hasThreshold++;
            });
            dailyPresent.push(presentCount);
            daily80plus.push(hasThreshold);
        });

        return { dayKeys, dailyPresent, daily80plus, total: presRows.length, threshold };
    }

    function renderDailyPresenceChart(filesToProcess) {
        const card = document.getElementById('card-daily-presence');
        if (!card) return;
        if (charts['c-daily-presence']) { charts['c-daily-presence'].destroy(); delete charts['c-daily-presence']; }

        // Apenas para eventos individuais de tipos com suporte a presença por dia
        const DAILY_PRESENCE_TYPES = new Set(['cyberthon', 'hands-on', 'cissa-journey']);
        if (filesToProcess.length !== 1 || !DAILY_PRESENCE_TYPES.has(filesToProcess[0].type)) {
            card.classList.add('hidden'); return;
        }

        const d = getDailyPresenceData(filesToProcess[0]);
        if (!d) { card.classList.add('hidden'); return; }

        const allDayKeys = d.dayKeys, allPresent = d.dailyPresent, all80 = d.daily80plus;
        const thresholdPct = Math.round(d.threshold * 100);
        const multiDay = allDayKeys.length > 1 && !d.singleSession;
        card.classList.remove('hidden');

        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#E8E8E8' : '#232323';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        const barW = Math.max(20, Math.min(50, Math.floor(480 / allDayKeys.length)));
        const scrollInner = document.getElementById('daily-presence-scroll');
        if (scrollInner) {
            const outerW = scrollInner.parentElement.clientWidth || 600;
            scrollInner.style.width = Math.max(outerW, allDayKeys.length * 65) + 'px';
        }

        const datasets = [
            {
                type: 'bar',
                label: multiDay ? 'Presentes no dia' : 'Presentes',
                data: allPresent,
                backgroundColor: 'rgba(55,91,149,0.75)',
                borderColor: '#375B95',
                borderWidth: 1,
                barThickness: multiDay ? barW : Math.min(barW * 3, 120),
                yAxisID: 'y'
            }
        ];
        if (multiDay) {
            datasets.push({
                type: 'line',
                label: `Com ${thresholdPct}%+ de presença até o dia`,
                data: all80,
                borderColor: '#D25600',
                backgroundColor: 'rgba(210,86,0,0.12)',
                pointBackgroundColor: '#D25600',
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true,
                tension: 0.3,
                yAxisID: 'y'
            });
        }

        charts['c-daily-presence'] = new Chart(document.getElementById('c-daily-presence'), {
            data: { labels: allDayKeys, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: textColor, font: { family: "'DM Sans',sans-serif" } } },
                    datalabels: {
                        display: ctx => ctx.datasetIndex === 0,
                        color: '#fff', font: { weight: 'bold', size: 10 },
                        formatter: v => v > 0 ? v : ''
                    },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: { ticks: { color: textColor, maxRotation: 35 }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
                }
            }
        });
    }

    function renderEngagement(filesToProcess, totalRealizados, recorrentes, certsCyberthon, certsHandsOn, certsMulheres, certsSummer, cFacil, cMent, certsMasterclass = 0, certsCissaLab = 0, certsCissaJourney = 0, certsSbseg = 0) {
        // Funil — mais recente primeiro
        const skFn = f => (parseInt(f.year)||0)*10000 + (parseInt(f.month)||0)*100 + (parseInt(f.day)||0);
        const sortedFiles = [...filesToProcess].sort((a, b) => skFn(b) - skFn(a));
        const labels = [], fullLabels = [], inscritos = [], participacoes = [], certificados = [], bgColors = [];
        sortedFiles.forEach(fObj => {
            let title = getDisplayName(fObj) || fObj.name;
            const fullTitle = title;
            if (fObj.type === 'hands-on') {
                const words = title.trim().split(/\s+/);
                const short = words.slice(0, 3).join(' ') + (words.length > 3 ? '…' : '');
                const datePart = (fObj.month !== 'Desconhecido' && fObj.year !== 'Desconhecido')
                    ? ' — ' + (monthNames[fObj.month] || fObj.month) + '/' + fObj.year
                    : '';
                title = short + datePart;
            } else if (fObj.type === 'cissa-journey') {
                // Show only last session date: extract last DD_MM before year
                const lastDate = title.match(/(\d{1,2})[_\/](\d{2})[_\/](20\d{2})/);
                if (lastDate) {
                    title = 'CISSA Journey ' + lastDate[1].padStart(2,'0') + '/' + lastDate[2];
                } else {
                    // Fallback: last DD_MM in name
                    const allD = [...title.matchAll(/\b(\d{1,2})[_](\d{2})\b/g)].filter(m => +m[2] >= 1 && +m[2] <= 12);
                    if (allD.length) {
                        const last = allD[allD.length - 1];
                        title = 'CISSA Journey ' + last[1].padStart(2,'0') + '/' + last[2];
                    }
                }
            }
            labels.push(title);
            fullLabels.push(fullTitle);
            bgColors.push('#375B95');

            // ── Mulheres: tudo vem da aba de participantes/certificados ────────
            if (fObj.type === 'mulheres') {
                const mulhSheet = getSheetData(fObj.data, [/participante.*certif|certif.*participante|participante|certifi/]) || [];
                const cpfSetM = new Set();
                mulhSheet.forEach(row => {
                    const cpfKey = Object.keys(row).find(k => /cpf/i.test(normalize(k)));
                    if (cpfKey && row[cpfKey] && String(row[cpfKey]).trim() !== '')
                        cpfSetM.add(String(row[cpfKey]).replace(/\D/g, '').trim());
                });
                const n = cpfSetM.size;
                inscritos.push(n);
                participacoes.push(n);
                certificados.push(n);
                return; // pula detecção genérica abaixo
            }

            // Inscrições: busca aba de estudantes/alunos — exclui abas auxiliares
            const inscSheet = getSheetData(fObj.data, [/estudantes/, /alunos/, /inscri/, /respostas/, /^form/])
                           || Object.entries(fObj.data)
                                .filter(([k, v]) => Array.isArray(v) && v.length > 1
                                    && !/banca|presen|certif|mentor|facilit|reac|avalia|diagn|espera|indicad|pitch|script|autocrat/i.test(normalize(k)))
                                .sort(([,a],[,b]) => b.length - a.length)
                                .map(([,v]) => v)[0]
                           || [];
            inscritos.push(inscSheet.length);

            const pres = Object.keys(fObj.data).find(k => /presen/i.test(k));
            const presData = pres ? fObj.data[pres] : [];

            let ativos = 0, certs = 0;

            // Helper: conta certificados via link/url (mesmo critério do KPI)
            const contarCertsPorLink = (sheets) => {
                const certSet = new Set();
                sheets.forEach(sheet => {
                    (sheet || []).forEach(row => {
                        if (rowHasCertLink(row)) {
                            const cpfKey   = Object.keys(row).find(k => /cpf/i.test(normalize(k)));
                            const emailKey = Object.keys(row).find(k => /email/i.test(normalize(k)));
                            const nomeKey  = Object.keys(row).find(k => /^nome/i.test(normalize(k)));
                            const id = (cpfKey && row[cpfKey]) || (emailKey && row[emailKey]) || (nomeKey && row[nomeKey]) || JSON.stringify(row);
                            certSet.add(String(id).toLowerCase().trim());
                        }
                    });
                });
                return certSet.size;
            };

            if (fObj.type === 'masterclass') {
                const mc = getMasterclassMetrics(fObj);
                inscritos[inscritos.length - 1] = mc.insc;
                ativos = mc.partic;
                certs = mc.certs;
            } else if (fObj.type === 'summer-job') {
                // Inscrições: indicados; Participações: quem tem freq > 0; Certificados: links
                const indicSheet = getSheetData(fObj.data, [/indicad/]) || [];
                inscritos[inscritos.length - 1] = indicSheet.length;
                ativos = presData.filter(r => {
                    const fk = Object.keys(r).find(k => /frequ[eê]ncia|frequencia/i.test(normalize(k)));
                    const tk = Object.keys(r).find(k => /total.*pres|pres.*total/i.test(normalize(k)));
                    if (fk) { const p = parseFloat(String(r[fk]).replace('%','').replace(',','.')); return !isNaN(p) && p > 0; }
                    if (tk) { const t = parseFloat(String(r[tk]).replace(',','.')); return !isNaN(t) && t > 0; }
                    return true;
                }).length;
                certs  = contarCertsPorLink([presData]);
            } else if (fObj.type === 'cissa-lab') {
                const PRESENCA_VALS = new Set(['TRUE','SIM','VERDADEIRO','V','1','X','S']);
                presData.forEach(r => {
                    const presKey = Object.keys(r).find(k => /presenca|presen/i.test(normalize(k)) && !/certif/i.test(normalize(k)));
                    if (presKey && PRESENCA_VALS.has(String(r[presKey]).toUpperCase().trim())) ativos++;
                });
                if (!ativos) ativos = presData.length;
                certs = contarCertsPorLink([presData]);
                // Inscricoes: DADOS PARTICIPANTES ou INDICADOS
                const inscLabSheet = getSheetData(fObj.data, [/dados.*participante/i]) || getSheetData(fObj.data, [/indicad/i]) || [];
                inscritos[inscritos.length - 1] = inscLabSheet.length || presData.length;
            } else if (fObj.type === 'cissa-journey') {
                // Inscrições: Lista de Inscritos
                const inscJSheet = getSheetData(fObj.data, [/inscri/]) || [];
                inscritos[inscritos.length - 1] = inscJSheet.length;
                // Participações: TOTAL DE PRESENÇA > 0
                presData.forEach(r => {
                    const totalPresKey = Object.keys(r).find(k => /total.*presen/i.test(normalize(k)));
                    if (totalPresKey !== undefined && parseInt(r[totalPresKey]) > 0) ativos++;
                });
                if (!ativos) ativos = presData.filter(r => Object.values(r).some(v => ['TRUE','SIM','VERDADEIRO','V','1','X'].includes(String(v).toUpperCase().trim()))).length;
                // Certificados: DIREITO A CERTIFICADO? = Sim
                presData.forEach(r => {
                    const dirKey = Object.keys(r).find(k => /direito.*certif/i.test(normalize(k)));
                    if (dirKey && /sim/i.test(String(r[dirKey]||''))) certs++;
                });
            } else if (fObj.type === 'sbseg') {
                // Inscrições: DADOS INSCRITOS
                const inscSbseg = getSheetData(fObj.data, [/dados.*inscrit/i]) || getSheetData(fObj.data, [/inscrit/i]) || [];
                inscritos[inscritos.length - 1] = inscSbseg.length || presData.length;
                // Participações: coluna "Presença" = true
                const PRES_VALS_SBG = new Set(['TRUE','SIM','VERDADEIRO','V','1','X','S']);
                presData.forEach(r => {
                    const pk = Object.keys(r).find(k => /presenca|presen/i.test(normalize(k)) && !/certif/i.test(normalize(k)));
                    if (pk && PRES_VALS_SBG.has(String(r[pk]).toUpperCase().trim())) ativos++;
                });
                if (!ativos) ativos = presData.length;
                certs = contarCertsPorLink([presData]);
            } else if (fObj.type === 'hands-on') {
                ativos = presData.length;
                // Certificados: links na lista de presença (coluna ao lado)
                certs = contarCertsPorLink([presData]);
            } else {
                // Cyberthon: conta quem tem ao menos 1 dia de presença marcado
                const PRESENCA_VALS = new Set(['TRUE','SIM','VERDADEIRO','V','1','X','S']);
                const isPresCol = k => {
                    const nk = normalize(k);
                    // "PRESENÇA", "DIA 1", "DIA 08/04", "DIA1", "08/04", "09/04" …
                    return /presen|compare/i.test(nk)
                        || /\bdia\b/i.test(nk)
                        || /^\d{1,2}[\/\-\.]\d{1,2}/.test(k.trim());
                };
                presData.forEach(r => {
                    if (Object.keys(r).some(k =>
                        isPresCol(k) && PRESENCA_VALS.has(String(r[k]).toUpperCase().trim())))
                        ativos++;
                });
                // Fallback só se a aba não tiver nenhuma coluna de controle de presença
                if (ativos === 0 && !presData.some(r => Object.keys(r).some(isPresCol))) {
                    ativos = presData.length;
                }
                // Certificados: links na lista de presença, cap em ativos
                certs = Math.min(contarCertsPorLink([presData]), ativos);
            }

            participacoes.push(ativos);
            certificados.push(certs);
        });

        ['c-engage-funnel','c-engage-certs','c-daily-presence'].forEach(id => { if(charts[id]) { charts[id].destroy(); delete charts[id]; } });
        renderDailyPresenceChart(filesToProcess);

        // Armazena dados e reseta estado dos filtros
        window._funnelAllData = { sortedFiles, labels, fullLabels, inscritos, participacoes, certificados, bgColors };
        window._funnelTypeFilter = 'all';
        window._funnelYearFilter = 'all';

        // Chips de filtro por tipo e por ano
        const filtersEl = document.getElementById('funnel-type-filters');
        if (filtersEl) {
            const typesPresent = [...new Set(sortedFiles.map(f => f.type))].filter(t => _FUNNEL_TYPE_NAMES[t]);
            const yearsPresent = [...new Set(sortedFiles.map(f => f.year).filter(y => y && y !== 'Desconhecido' && y !== '—'))].sort((a, b) => b - a);
            const chipBase = 'style="background:#375B95;color:#fff;"';
            const chipDark = 'style="background:#232323;color:#fff;"';
            let html = '';
            if (typesPresent.length > 1) {
                html += `<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-bottom:5px;">`;
                html += `<span style="font-size:0.68rem;color:var(--text-muted);margin-right:2px;">Tipo</span>`;
                html += `<button class="funnel-chip funnel-type-chip active" ${chipBase} onclick="applyFunnelFilter('all',this)">Todos</button>`;
                html += typesPresent.map(t => `<button class="funnel-chip funnel-type-chip" ${chipBase} onclick="applyFunnelFilter('${t}',this)">${_FUNNEL_TYPE_NAMES[t]}</button>`).join('');
                html += `</div>`;
            }
            if (yearsPresent.length > 1) {
                html += `<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">`;
                html += `<span style="font-size:0.68rem;color:var(--text-muted);margin-right:2px;">Ano</span>`;
                html += `<button class="funnel-chip funnel-year-chip active" ${chipDark} onclick="applyFunnelYearFilter('all',this)">Todos</button>`;
                html += yearsPresent.map(y => `<button class="funnel-chip funnel-year-chip" ${chipDark} onclick="applyFunnelYearFilter('${y}',this)">${y}</button>`).join('');
                html += `</div>`;
            }
            filtersEl.style.display = html ? 'flex' : 'none';
            filtersEl.style.flexDirection = 'column';
            filtersEl.style.gap = '0';
            filtersEl.innerHTML = html;
        }

        _buildFunnelChart(labels, fullLabels, inscritos, participacoes, certificados, bgColors);

        // Separa facilitadores/mentores por programa (cyberthon vs summer-job)
        let cFacilCyber = 0, cMentCyber = 0, cFacilSummer = 0, cMentSummer = 0;
        filesToProcess.forEach(fObj => {
            const certF = getSheetData(fObj.data, [/certificados facilitadores/, /certificados fac/]) || [];
            const certM = getSheetData(fObj.data, [/certificados mentores/, /certificados men/]) || [];
            if (fObj.type === 'summer-job') { cFacilSummer += countLinks(certF); cMentSummer += countLinks(certM); }
            else if (fObj.type === 'cyberthon') { cFacilCyber += countLinks(certF); cMentCyber += countLinks(certM); }
        });

        const certsLabels = [], certsData = [], certsColors = [];
        const _CP = ['#375B95','#D25600','#232323','#888888'];
        let _ci = 0;
        if (certsCyberthon > 0)    { certsLabels.push('Alunos — Cyberthon');          certsData.push(certsCyberthon);    certsColors.push(_CP[_ci++ % 4]); }
        if (certsHandsOn > 0)      { certsLabels.push('Alunos — Hands On');           certsData.push(certsHandsOn);      certsColors.push(_CP[_ci++ % 4]); }
        if (certsMulheres > 0)     { certsLabels.push('Mulheres em Ciber');            certsData.push(certsMulheres);     certsColors.push(_CP[_ci++ % 4]); }
        if (certsSummer > 0)       { certsLabels.push('Alunos — Summer Job');          certsData.push(certsSummer);       certsColors.push(_CP[_ci++ % 4]); }
        if (certsMasterclass > 0)  { certsLabels.push('Masterclass');                  certsData.push(certsMasterclass);  certsColors.push(_CP[_ci++ % 4]); }
        if (certsCissaLab > 0)     { certsLabels.push('CISSA Lab');                    certsData.push(certsCissaLab);     certsColors.push(_CP[_ci++ % 4]); }
        if (certsCissaJourney > 0) { certsLabels.push('CISSA Journey');                certsData.push(certsCissaJourney); certsColors.push(_CP[_ci++ % 4]); }
        if (certsSbseg > 0)        { certsLabels.push('SBSeg');                        certsData.push(certsSbseg);        certsColors.push(_CP[_ci++ % 4]); }
        if (cFacilSummer > 0)    { certsLabels.push('Facilitadores — Summer Job');     certsData.push(cFacilSummer);      certsColors.push(_CP[_ci++ % 4]); }
        if (cMentSummer > 0)     { certsLabels.push('Mentores — Summer Job');          certsData.push(cMentSummer);       certsColors.push(_CP[_ci++ % 4]); }
        if (cFacilCyber > 0)     { certsLabels.push('Facilitadores — Cyberthon');      certsData.push(cFacilCyber);       certsColors.push(_CP[_ci++ % 4]); }
        if (cMentCyber > 0)      { certsLabels.push('Mentores — Cyberthon');           certsData.push(cMentCyber);        certsColors.push(_CP[_ci++ % 4]); }
        if (certsData.length > 0) {
            const isDarkC = document.body.classList.contains('dark-mode');
            const textColorC = isDarkC ? '#E8E8E8' : '#232323';
            const totalCertsChart = certsData.reduce((a, b) => a + b, 0);
            charts['c-engage-certs'] = new Chart(document.getElementById('c-engage-certs'), {
                type: 'pie',
                data: { labels: certsLabels, datasets: [{ data: certsData, backgroundColor: certsColors, borderColor: isDarkC ? '#1e1e1e' : '#fff', borderWidth: 2 }] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'right', labels: { color: textColorC, boxWidth: 12, font: { size: 11, family: "'DM Sans', sans-serif" } } },
                        tooltip: { callbacks: { label: c => ` ${c.raw} (${totalCertsChart > 0 ? ((c.raw/totalCertsChart)*100).toFixed(1) : 0}%)` } },
                        datalabels: {
                            color: '#fff',
                            font: { weight: 'bold', size: 11, family: "'DM Sans', sans-serif" },
                            formatter: v => totalCertsChart > 0 && v > 0 ? ((v/totalCertsChart)*100).toFixed(1) + '%' : ''
                        }
                    }
                }
            });
        }
    }
