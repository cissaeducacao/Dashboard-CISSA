    function renderAbandonment(inscritos, presenca, ativosCPFs, ativosEmails, ativosNomes, ativosBaseNomes) {
        let participaram = 0, cemPorcento = 0, boaFreq = 0, menosMetade = 0, naoApareceram = 0;

        if (pTypeGlobal === 'summer-job') {
            // ── Summer Job: lê TOTAL DE PRESENÇA e % FREQUÊNCIA ────────────
            presenca.forEach(p => {
                const freqKey  = Object.keys(p).find(k => /frequ[eê]ncia|frequencia/i.test(normalize(k)));
                const totalKey = Object.keys(p).find(k => /total.*pres|pres.*total/i.test(normalize(k)));
                let pct = null;
                if (freqKey) {
                    const raw = String(p[freqKey]).replace('%','').replace(',','.').trim();
                    pct = parseFloat(raw);
                    if (pct > 1) pct = pct / 100; // normaliza 0-1
                } else if (totalKey) {
                    pct = parseFloat(String(p[totalKey]).replace(',','.')) > 0 ? 1 : 0;
                }
                if (pct === null) return;
                if (pct === 0)        naoApareceram++;
                else {
                    participaram++;
                    if (pct >= 0.999)     cemPorcento++;
                    else if (pct > 0.5)   boaFreq++;
                    else                  menosMetade++;
                }
            });
        } else {
            // ── Cyberthon / Hands On / outros: lê colunas de dias marcados ──
            const PRESENCA_VALS_AB = new Set(['TRUE','SIM','VERDADEIRO','V','1','X','S','PRESENTE','P','YES','Y']);
            const isPresColAb = k => {
                const nk = normalize(k);
                return (/presen|compare/i.test(nk) && !/certif|link|url/i.test(nk))
                    || /\bdia[\s_]*\d/i.test(nk)                     // "DIA 1", "DIA_2", "Dia 08/04"
                    || /^\d{1,2}[\/\-\.]\d{1,2}(\/\d{2,4})?$/.test(k.trim()); // "08/04", "08/04/2025"
            };
            presenca.forEach(p => {
                let diasMarcados = 0, totalDias = 0;
                Object.keys(p).forEach(k => {
                    if (isPresColAb(k)) {
                        totalDias++;
                        if (PRESENCA_VALS_AB.has(String(p[k]).toUpperCase().trim())) diasMarcados++;
                    }
                });
                if (totalDias > 0) {
                    if (diasMarcados === 0)                  naoApareceram++;
                    else {
                        participaram++;
                        if (diasMarcados === totalDias)      cemPorcento++;
                        else if (diasMarcados > totalDias/2) boaFreq++;
                        else                                 menosMetade++;
                    }
                } else {
                    // Fallback: presença como coluna booleana única (ex: coluna "PRESENÇA" = TRUE/FALSE)
                    const boolKey = Object.keys(p).find(k => /presen/i.test(normalize(k)) && !/certif|link|url|nome|cpf|email/i.test(normalize(k)));
                    if (boolKey) {
                        const val = String(p[boolKey]).toUpperCase().trim();
                        if (PRESENCA_VALS_AB.has(val)) { participaram++; cemPorcento++; }
                        else naoApareceram++;
                    }
                }
            });
        }

        const total           = inscritos.length;
        const naoParticiparam = Math.max(0, total - participaram);
        const taxaPartic = total > 0 ? ((participaram    / total) * 100).toFixed(1) : '0.0';
        const taxaEvasao = total > 0 ? ((naoParticiparam / total) * 100).toFixed(1) : '0.0';
        const taxaBaixa  = total > 0 ? ((menosMetade   / total) * 100).toFixed(1) : '0.0';
        const taxaCem    = total > 0 ? ((cemPorcento   / total) * 100).toFixed(1) : '0.0';
        const taxaBoa    = total > 0 ? ((boaFreq       / total) * 100).toFixed(1) : '0.0';

        // ── KPI cards ────────────────────────────────────────────────────────
        const kpiGrid = document.getElementById('abandon-kpi-grid');
        if (kpiGrid) {
            const card = (label, value, extra, highlight, bg, fg) => {
                const style = bg ? `background:${bg};border-color:${bg};` : '';
                const valStyle = fg ? `color:${fg};` : '';
                const cls = highlight ? 'kpi-card highlight' : 'kpi-card';
                return `<div class="${cls}" style="${style}">
                    <span style="${fg ? `color:${fg};opacity:0.75;` : ''}">${label}</span>
                    <div style="${valStyle}">${value}</div>
                    ${extra ? `<div style="font-size:0.72rem;color:${fg || 'var(--text-muted)'};opacity:0.8;margin-top:4px;">${extra}</div>` : ''}
                </div>`;
            };
            kpiGrid.innerHTML =
                card('TOTAL INSCRITOS',          total,          '',                                false, 'var(--blue-dark)', '#fff') +
                card('PARTICIPARAM',             participaram,   `Taxa: ${taxaPartic}%`,             false, '', '') +
                card('PRESENÇA 100%',            cemPorcento,    `${taxaCem}% dos inscritos`,        false, '', '') +
                (boaFreq > 0
                    ? card('BOA FREQUÊNCIA (50–99%)', boaFreq,   `${taxaBoa}% dos inscritos`,        false, '', '')
                    : '') +
                (menosMetade > 0
                    ? card('BAIXA FREQUÊNCIA (≤ 50%)', menosMetade, `${taxaBaixa}% dos inscritos`,   true,  '', '')
                    : '') +
                card('NÃO PARTICIPARAM',         naoParticiparam, `Taxa de evasão: ${taxaEvasao}%`,  false,
                    naoParticiparam > participaram ? 'var(--orange)' : '', naoParticiparam > participaram ? '#fff' : '');
        }

        // ── Pie chart com cores fixas por categoria ───────────────────────────
        // azul escuro = 100% | azul claro = boa freq | laranja = baixa | preto = não participaram
        const ABANDON_COLORS = {
            '100%':   '#375B95',
            'boa':    '#888888',
            'baixa':  '#D25600',
            'nao':    '#232323'
        };
        if (charts['c-abandon-bar']) charts['c-abandon-bar'].destroy();
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#e0e0e0' : '#232323';
        const pieLabels = [], pieValues = [], pieColors2 = [];
        pieLabels.push('Presença 100%');       pieValues.push(cemPorcento);  pieColors2.push(ABANDON_COLORS['100%']);
        if (boaFreq > 0) {
            pieLabels.push('Boa frequência (50–99%)'); pieValues.push(boaFreq);    pieColors2.push(ABANDON_COLORS['boa']);
        }
        if (menosMetade > 0) {
            pieLabels.push('Baixa frequência (≤ 50%)'); pieValues.push(menosMetade); pieColors2.push(ABANDON_COLORS['baixa']);
        }
        pieLabels.push('Não participaram');    pieValues.push(naoParticiparam); pieColors2.push(ABANDON_COLORS['nao']);

        charts['c-abandon-bar'] = new Chart(document.getElementById('c-abandon-bar'), {
            type: 'pie',
            data: { labels: pieLabels, datasets: [{ data: pieValues, backgroundColor: pieColors2, borderColor: isDark ? '#1e1e1e' : '#fff', borderWidth: 2 }] },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'right', labels: { color: textColor, boxWidth: 12, font: { size: 11, family: "'DM Sans', sans-serif" } } },
                    tooltip: {
                        titleFont: { family: "'DM Sans', sans-serif" },
                        bodyFont:  { family: "'DM Sans', sans-serif", size: 13 },
                        callbacks: { label: c => ` ${c.raw} (${total > 0 ? ((c.raw*100)/total).toFixed(1) : 0}%)` }
                    },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 11, family: "'DM Sans', sans-serif" },
                        formatter: (v) => total > 0 && v > 0 ? ((v*100)/total).toFixed(1) + '%' : ''
                    }
                }
            },
        });
    }

    function renderDemographics(data) {
        // Columns that must NEVER be matched for any demographic field
        const GEO_BLOCK = /cidade|estado|municipio|endereco|\buf\b|local|internet.*cidade|ssh|docker|terraform|ansible|kubernetes|servidor|pipeline|protocolo|principal.*stack|area.*atuacao.*ex\./i;

        // getColByRegex: find first column in a row matching regex, skipping geo/technical columns
        const getColByRegex = (row, regex, extraBlock) => {
            return Object.keys(row).find(k => {
                let nk = normalize(k);
                if (GEO_BLOCK.test(nk)) return false;
                if (extraBlock && extraBlock.test(nk)) return false;
                return regex.test(nk);
            });
        };

        // countColRegex: count values by column regex; skips rows where column is absent/empty
        const countColRegex = (dataArr, regex, unifyFn, extraBlock) => {
            let o = {};
            dataArr.forEach(row => {
                let k = getColByRegex(row, regex, extraBlock);
                if (!k || row[k] === undefined || row[k] === null) return;
                let val = String(row[k]).trim();
                if (val === '' || val === '-' || val === 'undefined') return;
                if (unifyFn) {
                    val = unifyFn(val.toLowerCase().trim());
                    if (!val) return;
                } else {
                    if (val.length > 40) val = val.substring(0, 37) + '...';
                    val = val.charAt(0).toUpperCase() + val.slice(1);
                }
                if (val) o[val] = (o[val] || 0) + 1;
            });
            if (Object.keys(o).length === 1 && o['Não Informado']) return {};
            return Object.fromEntries(Object.entries(o).sort((a,b) => b[1]-a[1]));
        };

        let isCyber = pTypeGlobal === 'cyberthon';

        // --- IDADE ---
        let idadeCounts = { '15 a 17 anos': 0, '18 a 20 anos': 0, '21 a 29 anos': 0, '30 a 39 anos': 0, '40 a 49 anos': 0, 'Acima de 49 anos': 0 };
        data.forEach(row => {
            let k = getColByRegex(row, /\bidade\b|\bfaixa et[aá]ria\b|\bnascimento\b/i);
            if (!k || !row[k]) return;
            let v = String(row[k]).trim().toLowerCase();
            if (v.includes('15') || v.includes('16') || v.includes('17')) idadeCounts['15 a 17 anos']++;
            else if (v.includes('18') || v.includes('19') || v.includes('20')) idadeCounts['18 a 20 anos']++;
            else if (['21','22','23','24','25','26','27','28','29'].some(n => v.includes(n))) idadeCounts['21 a 29 anos']++;
            else if (['30','31','32','33','34','35','36','37','38','39'].some(n => v.includes(n))) idadeCounts['30 a 39 anos']++;
            else if (['40','41','42','43','44','45','46','47','48','49'].some(n => v.includes(n))) idadeCounts['40 a 49 anos']++;
            else if (v.includes('acima') || v.includes('50') || v.includes('51+')) idadeCounts['Acima de 49 anos']++;
        });
        Object.keys(idadeCounts).forEach(k => { if (idadeCounts[k] === 0) delete idadeCounts[k]; });
        document.getElementById('card-idade').classList.toggle('hidden', Object.keys(idadeCounts).length === 0);
        renderChart('c-idade', 'bar', idadeCounts, false, null, 'Quantidade', 'Faixas Etárias');

        // --- RAÇA / COR / ETNIA ---
        // Block technical/SSH columns from being matched; prefer "etnia/raca" phrasing
        const RACA_COL_BLOCK = /ssh|protocolo|servidor|stack|configuracao|manutencao|familiaridade|docker|kubernetes|terraform|ansible/i;
        let rData = countColRegex(data, /etnia.*raca|raca.*etnia|auto.?declara|raca\s*\/\s*cor|\braca\b|\betnia\b/i, (vLower) => {
            // Skip state abbreviations and very short noise
            if (/^(pe|sp|pb|rj|rn|mg|ba|ce|go|pa|pr|rs|sc|df|es|to|pi|ma|al|se|ro|rr|ap|am|mt|ms|ac)$/.test(vLower.trim())) return null;
            if (vLower.trim().length <= 2) return null;
            // Skip obvious technical free-text leaked from adjacent columns
            if (/ssh|docker|terraform|ansible|kubernetes|manualmente|automatiz|terminal|script|servidor|pipeline|iniciante|intermediar|avan[cç]|basico|nulo/.test(vLower)) return null;
            if (vLower.includes('branc')) return 'Branca';
            if (vLower.includes('pard') || vLower.includes('pret') || vLower.includes('negr')) return 'Preta / Parda';
            if (vLower.includes('amarel') || vLower.includes('asiatic')) return 'Amarela / Asiática';
            if (vLower.includes('indigen')) return 'Indígena';
            if (vLower.includes('prefiro') || vLower.includes('informado') || vLower.includes('n/a')) return null;
            return vLower.charAt(0).toUpperCase() + vLower.slice(1);
        }, RACA_COL_BLOCK);
        document.getElementById('card-raca').classList.toggle('hidden', Object.keys(rData).length === 0);
        renderChart('c-raca', getChartType(rData), rData, true, null, 'Etnias', 'Quantidade');

        // --- RENDA ---
        let renData = countColRegex(data, /\brenda\b/i, (vLower) => {
            if (vLower.trim().length <= 2) return null;
            return vLower.charAt(0).toUpperCase() + vLower.slice(1);
        });
        document.getElementById('card-renda').classList.toggle('hidden', Object.keys(renData).length === 0);
        renderChart('c-renda', getChartType(renData), renData, true, null, 'Renda', 'Quantidade');

        // --- PCD (Geral e Tipos) ---
        let pcdBin = { 'Sim': 0, 'Não': 0, 'Prefiro não responder': 0 };
        let pcdTypes = {};
        const PCD_COL_BLOCK = /cidade|estado|municipio|\buf\b|internet.*cidade/i;

        data.forEach(row => {
            let k = Object.keys(row).find(kk => {
                let nk = normalize(kk);
                if (GEO_BLOCK.test(nk)) return false;
                if (PCD_COL_BLOCK.test(nk)) return false;
                return /defici[eê]ncia|pessoa com deficiencia|\bpcd\b/.test(nk);
            });
            if (!k || row[k] === undefined || row[k] === null) return;
            let val = String(row[k]).toLowerCase().trim();
            if (val === '' || val === '-' || val === 'undefined') return;
            // Skip state abbreviations and city names that leaked from adjacent column
            if (/^(pe|sp|pb|rj|rn|mg|ba|ce|go|pa|pr|rs|sc|df|es|to|pi|ma|al|se|ro|rr|ap|am|mt|ms|ac)$/.test(val)) return;
            if (/recife|olinda|joao pessoa|sao paulo|cupira|sao caitano|fortaleza|salvador|belo horizonte/.test(val)) return;

            const VALID_PCD = ['sim', 'nao', 'não', 'nenhum', 'nenhuma', 'fisica', 'motora', 'visual', 'visao', 'auditiva', 'surd', 'intelectual', 'cognitiva', 'autista', 'tea', 'multipla', 'outra', 'prefiro', 'n/a'];
            if (!VALID_PCD.some(vp => val.includes(vp))) return;

            if (val.startsWith('não') || val.startsWith('nao') || val.includes('nenhuma') || val.includes('nenhum')) {
                pcdBin['Não']++;
            } else if (val.includes('prefiro') || val.includes('n/a')) {
                pcdBin['Prefiro não responder']++;
            } else {
                pcdBin['Sim']++;
                let t = 'Outras';
                if (val.includes('fisica') || val.includes('física') || val.includes('motora')) t = 'Física / Motora';
                else if (val.includes('visual') || val.includes('visao') || val.includes('visão')) t = 'Visual';
                else if (val.includes('auditiva') || val.includes('surd')) t = 'Auditiva';
                else if (val.includes('intelectual') || val.includes('cognitiva')) t = 'Intelectual';
                else if (val.includes('autista') || val.includes('tea')) t = 'TEA / Autismo';
                else if (val.includes('multipla') || val.includes('múltipla')) t = 'Múltipla';
                pcdTypes[t] = (pcdTypes[t] || 0) + 1;
            }
        });

        pcdBin = Object.fromEntries(Object.entries(pcdBin).filter(([k,v]) => v > 0));
        pcdTypes = Object.fromEntries(Object.entries(pcdTypes).filter(([k,v]) => v > 0).sort((a,b) => b[1]-a[1]));

        document.getElementById('card-pcd-bin').classList.toggle('hidden', Object.keys(pcdBin).length === 0);
        if (isCyber) {
            document.getElementById('card-pcd-type').classList.add('hidden');
        } else {
            document.getElementById('card-pcd-type').classList.toggle('hidden', Object.keys(pcdTypes).length === 0);
        }
        renderChart('c-pcd-bin', 'pie', pcdBin, false, null, 'Possui Deficiência', 'Quantidade');
        renderChart('c-pcd-type', 'bar', pcdTypes, true, null, 'Tipos de Deficiência', 'Quantidade');

        // --- APOIO SOCIAL ---
        let socData = countColRegex(data, /\bsocial\b|\bbenefici[aá]rio\b|\bprograma social\b/i, (vLower) => {
            if (vLower.trim().length <= 2) return null;
            return vLower.charAt(0).toUpperCase() + vLower.slice(1);
        });
        document.getElementById('card-soc').classList.toggle('hidden', Object.keys(socData).length === 0);
        renderChart('c-soc', getChartType(socData), socData, true, null, 'Beneficiário', 'Quantidade');

        // --- GÊNERO ---
        let genData = countColRegex(data, /\bg[eê]nero\b|\bsexo\b|\bidentifica\b/i, (vLower) => {
            if (vLower.trim().length <= 2) return null;
            if (vLower.includes('masculin') || vLower === 'homem') return 'Masculino';
            if (vLower.includes('feminin') || vLower === 'mulher') return 'Feminino';
            if (vLower.includes('trans') || vLower.includes('binari') || vLower.includes('outro')) return 'Outros / Diversidade';
            if (vLower.includes('prefiro') || vLower.includes('informado')) return null;
            return 'Outros / Diversidade';
        });
        document.getElementById('card-genero').classList.toggle('hidden', Object.keys(genData).length === 0);
        renderChart('c-genero', getChartType(genData), genData, true, null, 'Gênero', 'Quantidade');

        // --- ESCOLARIDADE, ATIVIDADE, CARGOS (Hands-On only) ---
        document.getElementById('card-edu').classList.toggle('hidden', isCyber);
        document.getElementById('card-ativ').classList.toggle('hidden', isCyber);
        document.getElementById('card-cargos').classList.toggle('hidden', isCyber);

        if (!isCyber) {
            let eduData = countColRegex(data, /\bescolaridade\b|\bs[eé]rie\b|\bensino\b|\bforma[cç][aã]o\b/i, (vLower) => {
                if (vLower.trim().length <= 2) return null;
                if (vLower.includes('médio incompleto') || vLower.includes('medio incompleto') || /[123][ºª]/.test(vLower)) return 'Ensino Médio Incompleto';
                if (vLower.includes('médio') || vLower.includes('medio')) return 'Ensino Médio Completo';
                if (vLower.includes('superior incomp') || vLower.includes('graduação incomp') || vLower.includes('graduacao incomp')) return 'Superior Incompleto';
                if (vLower.includes('superior comp') || vLower.includes('graduação comp') || vLower.includes('graduacao comp') || vLower.includes('bacharel')) return 'Superior Completo';
                if (vLower.includes('pós') || vLower.includes('pos') || vLower.includes('especialização') || vLower.includes('mba')) return 'Pós-graduação';
                if (vLower.includes('mestra')) return 'Mestrado';
                if (vLower.includes('doutora')) return 'Doutorado';
                if (vLower.includes('fundamental')) return 'Ensino Fundamental';
                if (vLower.includes('prefiro') || vLower.includes('informado')) return null;
                return vLower.charAt(0).toUpperCase() + vLower.slice(1);
            });
            document.getElementById('card-edu').classList.toggle('hidden', Object.keys(eduData).length === 0);
            renderChart('c-edu', getChartType(eduData), eduData, true, null, 'Nível de Escolaridade', 'Quantidade');

            // Atividade profissional — only match demographic column, NOT technical "stack/atuação" columns
            let ativData = countColRegex(data, /\batividade profissional\b|\bstatus profissional\b|\bvinculo profissional\b/i, (vLower) => {
                if (vLower.trim().length <= 2) return null;
                return vLower.charAt(0).toUpperCase() + vLower.slice(1);
            });
            document.getElementById('card-ativ').classList.toggle('hidden', Object.keys(ativData).length === 0);
            renderChart('c-ativ', getChartType(ativData), ativData, true, null, 'Atividade / Vínculo', 'Quantidade');

            let cgData = countColRegex(data, /\bcargo\b|\bfun[cç][aã]o\b|\bsetor\b/i, (vLower) => {
                if (vLower.trim().length <= 2) return null;
                return vLower.charAt(0).toUpperCase() + vLower.slice(1);
            });
            document.getElementById('card-cargos').classList.toggle('hidden', Object.keys(cgData).length === 0);
            renderChart('c-cargos', getChartType(cgData), Object.fromEntries(Object.entries(cgData).slice(0, 10)), true, null, 'Cargos / Setor', 'Quantidade');
        }
    }

    function renderEvaluation(data, filesToProcess) {
        // Spinner de loading para sinalizar ao browser enquanto processa
        const evalContent = document.getElementById('evaluation-content');
        if (evalContent) {
            const spinner = document.createElement('div');
            spinner.id = '_eval-spinner';
            spinner.style.cssText = 'text-align:center;padding:30px;color:var(--text-muted);font-size:0.95rem;';
            spinner.textContent = 'Carregando avaliações…';
            evalContent.insertBefore(spinner, evalContent.firstChild);
        }

        setTimeout(() => {
            const spinnerEl = document.getElementById('_eval-spinner');
            if (spinnerEl) spinnerEl.remove();

            // Sempre destrói chart anterior para evitar dados antigos em cache
            if (charts['c-notas-bar']) { charts['c-notas-bar'].destroy(); delete charts['c-notas-bar']; }

            if (!data || data.length === 0) {
                document.getElementById('v-conc-geral').innerText = "0.0";
                document.getElementById('box-nps').classList.add('hidden');
                document.getElementById('comment-list').innerHTML = "<div class='comment-item'>Nenhum feedback.</div>";
                return;
            }

            let allKeys = new Set();
            data.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
            allKeys = Array.from(allKeys);

            let evalKeys = allKeys.filter(k => {
                const nk = normalize(k);
                return (nk.includes('avalia') || nk.includes('escala'))
                    && !nk.includes('0 a 10')
                    && !nk.includes('recomendar')
                    && !nk.includes('nps')
                    && !nk.includes('workshop')
                    && !nk.includes('indicar')
                    && !nk.includes('sugest');
            });
            let npsKey = allKeys.find(k => {
                const nk = normalize(k);
                return nk.includes('0 a 10') || nk.includes('recomendar') || nk.includes('nps');
            });

            let notasMap = {};
            evalKeys.forEach(k => {
                let nk = normalize(k);
                let shortName = "Avaliação";
                if (nk.includes('facilitador')) shortName = "Facilitadores";
                else if (nk.includes('monitor')) shortName = "Monitores";
                else if (nk.includes('metodologia')) shortName = "Metodologia";
                else if (nk.includes('relevância') || nk.includes('relevancia')) shortName = "Relevância";
                else if (nk.includes('engajamento')) shortName = "Engajamento";
                else shortName = k.split(' ').slice(0,3).join(' ') + "...";

                let values = data.map(r => parseFloat(r[k])).filter(n => !isNaN(n) && n <= 5);
                if (values.length > 0) notasMap[shortName] = (values.reduce((a,b) => a+b, 0) / values.length).toFixed(2);
            });

            let allNotas = Object.values(notasMap).map(n => parseFloat(n));
            document.getElementById('v-conc-geral').innerText = allNotas.length ? (allNotas.reduce((a,b) => a+b, 0) / allNotas.length).toFixed(1) : "0.0";

            if (npsKey) {
                let npsValues = data.map(r => parseFloat(r[npsKey])).filter(n => !isNaN(n) && n >= 0 && n <= 10);
                if (npsValues.length > 0) {
                    const total      = npsValues.length;
                    const promoters  = npsValues.filter(n => n >= 9).length;
                    const detractors = npsValues.filter(n => n <= 6).length;
                    const nps        = ((promoters - detractors) / total * 100).toFixed(1);
                    const boxNps = document.getElementById('box-nps');
                    document.getElementById('v-nps').innerText = nps;
                    boxNps.querySelector('span').textContent = 'NPS';
                    const oldSub = boxNps.querySelector('.nps-sub');
                    if (oldSub) oldSub.remove();
                    // legenda compacta: promotores / passivos / detratores
                    const passives = total - promoters - detractors;
                    const sub = document.createElement('div');
                    sub.className = 'nps-sub';
                    sub.style.cssText = 'font-size:0.68rem;color:var(--text-muted);margin-top:4px;line-height:1.5;';
                    sub.innerHTML = `😊 ${promoters} prom. &nbsp;😐 ${passives} pass. &nbsp;😞 ${detractors} detr.<br><span style="opacity:.7;">${total} respostas</span>`;
                    boxNps.appendChild(sub);
                    boxNps.classList.remove('hidden');
                } else document.getElementById('box-nps').classList.add('hidden');
            } else document.getElementById('box-nps').classList.add('hidden');

            if(Object.keys(notasMap).length > 0) renderChart('c-notas-bar', 'bar', notasMap, false, null, 'Nota Média', 'Aspectos Avaliativos');

            const cL = document.getElementById('comment-list');
            cL.innerHTML = "";
            let commentKeys = allKeys.filter(k => normalize(k).includes('sugest') || normalize(k).includes('coment') || normalize(k).includes('que bom') || normalize(k).includes('que pena') || normalize(k).includes('que tal') || normalize(k).includes('espaço'));

            data.forEach(r => {
                commentKeys.forEach(ck => {
                    const txt = String(r[ck] || "").trim();
                    if(txt && txt.length > 4 && txt !== "--" && txt !== "undefined") {
                        let label = ck.split('-')[0].trim();
                        if(label.length > 25) label = "Feedback / Comentário";
                        cL.innerHTML += `<div class="comment-item"><strong>${label}:</strong> "${txt}"</div>`;
                    }
                });
            });
        }, 0);
    }

    function processBancaSheet(banca) {
        const getNum = str => { str = String(str).toUpperCase().trim(); if(str.includes('N1')||str.includes('0-3'))return 3; if(str.includes('N2')||str.includes('BÁSICO')||str.includes('4-7'))return 7; if(str.includes('N3')||str.includes('BOM')||str.includes('8-11'))return 11; if(str.includes('N4')||str.includes('EXCELENTE')||str.includes('12-14'))return 14; let n=parseFloat(str); return !isNaN(n)&&n>0?n:0; };
        const getBon = str => { str=String(str).toLowerCase().trim(); if(str.includes('+2')||str==='2'||str==='sim')return 2; if(str.includes('-2')||str.includes('estourou'))return -2; let n=parseFloat(str); return !isNaN(n)&&n>=-10&&n<=2?n:0; };
        let sumScores = {}, count = {}, commentsHtml = '';
        banca.forEach(b => {
            let rowKeys = Object.keys(b);
            let commentKeys = rowKeys.filter(k => normalize(k).includes('coment'));
            commentKeys.forEach(ck => { let t=String(b[ck]||'').trim(); if(t&&t.length>3&&t!=='-'&&t.toLowerCase()!=='undefined') commentsHtml+=`<div class="comment-item">"${t}"</div>`; });
            let isNewFmt = rowKeys.some(k => /\[g\d+\]/i.test(normalize(k)));
            if (isNewFmt) {
                let groups = new Set(); rowKeys.forEach(k => { let m=normalize(k).match(/\[g\d+\]/i); if(m) groups.add(m[0].toUpperCase()); });
                groups.forEach(g => {
                    let gKeys = rowKeys.filter(k => normalize(k).includes(g.toLowerCase()));
                    let cKeys = gKeys.filter(k => !normalize(k).match(/bônus|bonus|tempo|pontos|\+2/));
                    let bKeys = gKeys.filter(k => normalize(k).match(/tempo|pontos|\+2|bonus|bônus/));
                    if (!cKeys.some(ck => b[ck]&&String(b[ck]).trim())) return;
                    let dName = g; let score = 0;
                    cKeys.forEach(ck => { if(b[ck]) score += getNum(b[ck]); });
                    bKeys.forEach(bk => { if(b[bk]) score += getBon(b[bk]); });
                    score = Math.min(100, Math.max(0, score));
                    sumScores[dName] = (sumScores[dName]||0) + score; count[dName] = (count[dName]||0) + 1;
                });
            } else {
                let cKeys = rowKeys.filter(k => normalize(k).match(/avalie|critério|nota /));
                let bKeys = rowKeys.filter(k => normalize(k).match(/tempo|pontos|\+2|bonus/));
                let dKey = rowKeys.find(k => normalize(k).match(/desafio|equipe/) && b[k] && String(b[k]).trim());
                if (!dKey||!b[dKey]) return;
                let dName = String(b[dKey]).trim(); if(dName.length>35) dName=dName.substring(0,32)+'…';
                let score = 0;
                cKeys.forEach(ck => { if(b[ck]) score += getNum(b[ck]); });
                bKeys.forEach(bk => { if(b[bk]) score += getBon(b[bk]); });
                score = Math.min(100, Math.max(0, score));
                sumScores[dName] = (sumScores[dName]||0) + score; count[dName] = (count[dName]||0) + 1;
            }
        });
        let avg = {};
        Object.keys(count).forEach(d => avg[d] = parseFloat((sumScores[d]/count[d]).toFixed(1)));
        return { avg, commentsHtml };
    }

    function renderBanca(combinedBanca, filesToProcess) {
        // Limpar charts antigos
        Object.keys(charts).forEach(id => { if(id.startsWith('c-banca-')) { charts[id].destroy(); delete charts[id]; } });
        const grid = document.getElementById('banca-editions-grid');
        grid.innerHTML = '';
        document.getElementById('banca-comment-list').innerHTML = '';

        const cyberFiles = (filesToProcess || []).filter(f => f.type === 'cyberthon');
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#E8E8E8' : '#232323';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        let allComments = '';

        if (cyberFiles.length === 0) {
            grid.innerHTML = '<div class="chart-card full-width" style="padding:30px;text-align:center;color:var(--text-muted);">Nenhuma edição do Cyberthon selecionada.</div>';
            return;
        }

        cyberFiles.forEach((fObj, idx) => {
            const bancaSheet = Object.keys(fObj.data).find(k => /banca/i.test(normalize(k)));
            if (!bancaSheet) return;
            const bancaData = fObj.data[bancaSheet];
            if (!bancaData || bancaData.length === 0) return;

            const { avg, commentsHtml } = processBancaSheet(bancaData);
            allComments += commentsHtml;

            if (Object.keys(avg).length === 0) return;

            const title = getDisplayName(fObj) || fObj.name;
            const chartId = `c-banca-edition-${idx}`;
            const nTeams = Object.keys(avg).length;
            const cardH = Math.max(320, nTeams * 52 + 80);

            const cardEl = document.createElement('div');
            cardEl.className = 'chart-card full-width';
            cardEl.style.height = cardH + 'px';
            cardEl.innerHTML = `<h3>📊 ${title}</h3><div class="canvas-wrapper"><canvas id="${chartId}"></canvas></div>`;
            grid.appendChild(cardEl);

            // Ordenar por nota decrescente
            const sorted = Object.entries(avg).sort((a,b) => b[1]-a[1]);
            const labels = sorted.map(([k]) => k);
            const values = sorted.map(([,v]) => v);
            const maxVal = Math.max(...values);
            const bgColors = values.map(v => v === maxVal ? '#D25600' : '#375B95');

            setTimeout(() => {
                charts[chartId] = new Chart(document.getElementById(chartId), {
                    type: 'bar',
                    data: { labels, datasets: [{ data: values, backgroundColor: bgColors, borderRadius: 4 }] },
                    options: {
                        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            datalabels: { color: '#fff', font: { weight: 'bold', size: 11 }, anchor: 'end', align: 'end', offset: 4, formatter: v => v }
                        },
                        scales: {
                            x: { min: 0, max: 100, ticks: { color: textColor }, grid: { color: gridColor }, title: { display: true, text: 'Nota Média (0–100)', color: textColor } },
                            y: { ticks: { color: textColor, font: { size: 12 } }, grid: { display: false } }
                        }
                    }
                });
            }, 0);
        });

        document.getElementById('banca-comment-list').innerHTML = allComments || '<div class="comment-item">Nenhum comentário encontrado.</div>';
    }
