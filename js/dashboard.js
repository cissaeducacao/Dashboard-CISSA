    function renderDashboard() {
        if (uploadedFiles.length === 0) return;

        let filesToProcess = [];
        if (currentScope === 'all') Object.assign(filesToProcess, uploadedFiles);
        else if (currentScope.startsWith('all_year_'))    filesToProcess = uploadedFiles.filter(f => f.year === currentScope.replace('all_year_', ''));
        else if (currentScope.startsWith('all_month_'))   filesToProcess = uploadedFiles.filter(f => f.monthKey === currentScope.replace('all_month_', ''));
        else if (currentScope === 'cyberthon_all')   filesToProcess = uploadedFiles.filter(f => f.type === 'cyberthon');
        else if (currentScope === 'handson_all')     filesToProcess = uploadedFiles.filter(f => f.type === 'hands-on');
        else if (currentScope === 'mulheres_all')    filesToProcess = uploadedFiles.filter(f => f.type === 'mulheres');
        else if (currentScope === 'summerjob_all')     filesToProcess = uploadedFiles.filter(f => f.type === 'summer-job');
        else if (currentScope === 'masterclass_all')    filesToProcess = uploadedFiles.filter(f => f.type === 'masterclass');
        else if (currentScope === 'cissalab_all')       filesToProcess = uploadedFiles.filter(f => f.type === 'cissa-lab');
        else if (currentScope === 'cissajourney_all')   filesToProcess = uploadedFiles.filter(f => f.type === 'cissa-journey');
        else if (currentScope === 'sbseg_all')          filesToProcess = uploadedFiles.filter(f => f.type === 'sbseg');
        else if (currentScope.startsWith('cyberthon_year_'))      filesToProcess = uploadedFiles.filter(f => f.type === 'cyberthon'     && f.year === currentScope.replace('cyberthon_year_', ''));
        else if (currentScope.startsWith('cyberthon_month_'))     filesToProcess = uploadedFiles.filter(f => f.type === 'cyberthon'     && f.monthKey === currentScope.replace('cyberthon_month_', ''));
        else if (currentScope.startsWith('handson_year_'))        filesToProcess = uploadedFiles.filter(f => f.type === 'hands-on'      && f.year === currentScope.replace('handson_year_', ''));
        else if (currentScope.startsWith('handson_month_'))       filesToProcess = uploadedFiles.filter(f => f.type === 'hands-on'      && f.monthKey === currentScope.replace('handson_month_', ''));
        else if (currentScope.startsWith('mulheres_year_'))       filesToProcess = uploadedFiles.filter(f => f.type === 'mulheres'      && f.year === currentScope.replace('mulheres_year_', ''));
        else if (currentScope.startsWith('mulheres_month_'))      filesToProcess = uploadedFiles.filter(f => f.type === 'mulheres'      && f.monthKey === currentScope.replace('mulheres_month_', ''));
        else if (currentScope.startsWith('summerjob_year_'))      filesToProcess = uploadedFiles.filter(f => f.type === 'summer-job'    && f.year === currentScope.replace('summerjob_year_', ''));
        else if (currentScope.startsWith('summerjob_month_'))     filesToProcess = uploadedFiles.filter(f => f.type === 'summer-job'    && f.monthKey === currentScope.replace('summerjob_month_', ''));
        else if (currentScope.startsWith('masterclass_year_'))    filesToProcess = uploadedFiles.filter(f => f.type === 'masterclass'   && f.year === currentScope.replace('masterclass_year_', ''));
        else if (currentScope.startsWith('masterclass_month_'))   filesToProcess = uploadedFiles.filter(f => f.type === 'masterclass'   && f.monthKey === currentScope.replace('masterclass_month_', ''));
        else if (currentScope.startsWith('cissalab_year_'))       filesToProcess = uploadedFiles.filter(f => f.type === 'cissa-lab'     && f.year === currentScope.replace('cissalab_year_', ''));
        else if (currentScope.startsWith('cissalab_month_'))      filesToProcess = uploadedFiles.filter(f => f.type === 'cissa-lab'     && f.monthKey === currentScope.replace('cissalab_month_', ''));
        else if (currentScope.startsWith('cissajourney_year_'))   filesToProcess = uploadedFiles.filter(f => f.type === 'cissa-journey' && f.year === currentScope.replace('cissajourney_year_', ''));
        else if (currentScope.startsWith('cissajourney_month_'))  filesToProcess = uploadedFiles.filter(f => f.type === 'cissa-journey' && f.monthKey === currentScope.replace('cissajourney_month_', ''));
        else if (currentScope.startsWith('sbseg_year_'))          filesToProcess = uploadedFiles.filter(f => f.type === 'sbseg'         && f.year === currentScope.replace('sbseg_year_', ''));
        else if (currentScope.startsWith('sbseg_month_'))         filesToProcess = uploadedFiles.filter(f => f.type === 'sbseg'         && f.monthKey === currentScope.replace('sbseg_month_', ''));
        else filesToProcess = uploadedFiles.filter(f => f.id === currentScope);

        // getSheetData agora é global (definida acima de renderDashboard)

        let globalStudentPresence = {};
        uploadedFiles.forEach(fObj => {
            let pres = getSheetData(fObj.data, [/presen/i, /frequen/i]) || [];
            pres.forEach(row => {
                let ids = getIdsFromRow(row), isActive = false;
                if (fObj.type === 'hands-on') isActive = true;
                else if (fObj.type === 'cissa-journey') {
                    const totalPresKey = Object.keys(row).find(k => /total.*presen/i.test(normalize(k)));
                    if (totalPresKey !== undefined) isActive = parseInt(row[totalPresKey]) > 0;
                    else isActive = Object.values(row).some(v => ['TRUE','SIM','VERDADEIRO','V','1','X'].includes(String(v).toUpperCase().trim()));
                }
                else {
                    let hasPresenceCol = Object.keys(row).some(k => /presen|dia /i.test(normalize(k)));
                    if (hasPresenceCol) {
                        Object.keys(row).forEach(k => {
                            if (/presen|dia /i.test(normalize(k))) {
                                if (['TRUE','SIM','VERDADEIRO','V','1','X'].includes(String(row[k]).toUpperCase().trim())) isActive = true;
                            }
                        });
                    } else isActive = true;
                }
                if (isActive) {
                    let mainId = ids.emails[0] || ids.cpfs[0] || ids.baseNomes[0];
                    if (mainId) {
                        if (!globalStudentPresence[mainId]) globalStudentPresence[mainId] = new Set();
                        globalStudentPresence[mainId].add(fObj.id);
                    }
                }
            });
        });

        let combinedInscricoes = [], combinedPresenca = [], combinedReacao = [], combinedDiag = [], combinedBanca = [];
        let combinedCertFacil = [], combinedCertMent = [];
        let totalRealizados = 0;
        let totalAtivosCPFs = new Set(), totalAtivosEmails = new Set(), totalAtivosNomes = new Set(), totalAtivosBase = new Set();
        let currentViewStudents = new Set();

        filesToProcess.forEach(fObj => {
            let data = fObj.data, pType = fObj.type;
            if (pType === 'masterclass') {
                const mc = getMasterclassMetrics(fObj);
                totalRealizados += mc.partic;
                return;
            }
            let insc = getSheetData(data, [/estudantes/, /inscri/, /respostas/, /form/]);
            // CISSA Lab: always use "DADOS PARTICIPANTES" (DADOS ESTUDANTES is empty/irrelevant)
            if (pType === 'cissa-lab') insc = getSheetData(data, [/dados.*participante/i]) || getSheetData(data, [/indicad/]) || insc;
            if (!insc) {
                 let sortedSheets = Object.keys(data).sort((a,b) => data[b].length - data[a].length);
                 insc = sortedSheets.length > 0 ? data[sortedSheets[0]] : [];
            }
            if (insc) {
                insc.forEach(r => {
                    r._fType = fObj.type;
                    r._fYear = String(fObj.year);
                    r._fName = String(fObj.name);
                });
            }
            let pres  = getSheetData(data, [/presen/, /frequen/]) || [];
            let reac  = getSheetData(data, [/reac/, /reaç/, /avaliação de re/, /feedback/, /satisf/]) || [];
            // Summer Job: substitui inscrições pela lista de indicados
            //             e agrega TODAS as abas de avaliação (reação + NPS)
            if (pType === 'summer-job') {
                const indicSheet = getSheetData(data, [/indicad/]);
                if (indicSheet && indicSheet.length > 0) insc = indicSheet;
                // Combina todas as abas de avaliação (pode haver reação E nps separadas)
                reac = [];
                Object.keys(data).forEach(sheetName => {
                    const nk = normalize(sheetName);
                    if (/reac|avalia|feedback|satisf|nps/i.test(nk) && !/presen|indicad|certif|mentor|facilit/i.test(nk)) {
                        reac = reac.concat(data[sheetName]);
                    }
                });
            }
            let diag = getSheetData(data, [/diagn/]) || [];
            let banca = getSheetData(data, [/banca/]) || [];

            let certF = getSheetData(data, [/certificados facilitadores/, /certificados fac/]) || [];
            let certM = getSheetData(data, [/certificados mentores/, /certificados men/]) || [];

            combinedInscricoes = combinedInscricoes.concat(insc);
            combinedPresenca = combinedPresenca.concat(pres);
            combinedReacao = combinedReacao.concat(reac);
            combinedDiag = combinedDiag.concat(diag);
            combinedBanca = combinedBanca.concat(banca);

            if (pType === 'cyberthon') {
                combinedCertFacil = combinedCertFacil.concat(certF);
                combinedCertMent = combinedCertMent.concat(certM);
            }

            const activeRows = pres;

            activeRows.forEach(row => {
                let ids = getIdsFromRow(row), isActive = false;
                if (pType === 'hands-on') isActive = true;
                else if (pType === 'summer-job') {
                    const freqKey  = Object.keys(row).find(k => /frequ[eê]ncia|frequencia/i.test(normalize(k)));
                    const totalKey = Object.keys(row).find(k => /total.*pres|pres.*total/i.test(normalize(k)));
                    if (freqKey) { const pct = parseFloat(String(row[freqKey]).replace('%','').replace(',','.')); isActive = !isNaN(pct) && pct > 0; }
                    else if (totalKey) { const t = parseFloat(String(row[totalKey]).replace(',','.')); isActive = !isNaN(t) && t > 0; }
                    else isActive = true;
                }
                else if (pType === 'cissa-journey') {
                    const totalPresKey = Object.keys(row).find(k => /total.*presen/i.test(normalize(k)));
                    if (totalPresKey !== undefined) isActive = parseInt(row[totalPresKey]) > 0;
                    else isActive = Object.values(row).some(v => ['TRUE','SIM','VERDADEIRO','V','1','X'].includes(String(v).toUpperCase().trim()));
                }
                else {
                    let hasPresenceCol = Object.keys(row).some(k => /presen|dia /i.test(normalize(k)));
                    if (hasPresenceCol) {
                        Object.keys(row).forEach(k => {
                            if (/presen|dia /i.test(normalize(k))) {
                                if (['TRUE','SIM','VERDADEIRO','V','1','X'].includes(String(row[k]).toUpperCase().trim())) isActive = true;
                            }
                        });
                    } else isActive = true;
                }

                if (isActive && (ids.cpfs.length || ids.emails.length || ids.nomes.length || ids.baseNomes.length)) {
                    totalRealizados++;
                    ids.cpfs.forEach(c => totalAtivosCPFs.add(c));
                    ids.emails.forEach(e => totalAtivosEmails.add(e));
                    ids.nomes.forEach(n => totalAtivosNomes.add(n));
                    ids.baseNomes.forEach(bn => totalAtivosBase.add(bn));

                    let mainId = ids.emails[0] || ids.cpfs[0] || ids.baseNomes[0];
                    if (mainId) currentViewStudents.add(mainId);
                }
            });
        });

        const hasMasterclassFiles = filesToProcess.some(f => f.type === 'masterclass');
        if (combinedInscricoes.length === 0 && !hasMasterclassFiles) { clearDashboardState(); return; }

        let filteredData = combinedInscricoes;
        if (currentView === 'ativos' || currentView === 'avaliacao') {
            filteredData = combinedInscricoes.filter(i => {
                let ids = getIdsFromRow(i);
                return ids.cpfs.some(c => totalAtivosCPFs.has(c)) || ids.emails.some(e => totalAtivosEmails.has(e)) || ids.nomes.some(n => totalAtivosNomes.has(n)) || ids.baseNomes.some(b => totalAtivosBase.has(b));
            });
        }

        let warningBox = document.getElementById('data-warning');
        if (warningBox) {
            if (currentView === 'ativos' && totalRealizados > 0 && !hasMasterclassFiles) {
                let matchRate = filteredData.length / totalRealizados;
                if (matchRate <= 0.3) {
                    warningBox.classList.remove('hidden');
                    document.getElementById('warn-realizados').innerText = totalRealizados;
                    document.getElementById('warn-encontrados').innerText = filteredData.length;
                } else warningBox.classList.add('hidden');
            } else warningBox.classList.add('hidden');
        }

        // ── KPIs e charts de engajamento (só na aba "ativos") ───────────────
        let certsCyberthon = 0, certsHandsOn = 0, certsMulheres = 0, certsSummer = 0, certsMasterclass = 0, certsCissaLab = 0, certsCissaJourney = 0, certsSbseg = 0, cFacil = 0, cMent = 0;
        let recorrentes = 0;
        currentViewStudents.forEach(id => { if (globalStudentPresence[id] && globalStudentPresence[id].size > 1) recorrentes++; });
        let esperados = combinedInscricoes.length;
        filesToProcess.filter(f => f.type === 'masterclass').forEach(f => { esperados += getMasterclassMetrics(f).insc; });
        let engajamento = esperados > 0 ? ((totalRealizados/esperados)*100).toFixed(1) + "%" : "0%";

        filesToProcess.forEach(fObj => {
            let pType = fObj.type;
            let insc = getSheetData(fObj.data, [/estudantes/, /inscri/, /respostas/, /form/]) || [];
            let pres = getSheetData(fObj.data, [/presen/]) || [];
            let certF = getSheetData(fObj.data, [/certificados facilitadores/, /certificados fac/]) || [];
            let certM = getSheetData(fObj.data, [/certificados mentores/, /certificados men/]) || [];
            let alunosLinked = new Set();
            [insc, pres].forEach(sheet => {
                if(!sheet) return;
                sheet.forEach(row => {
                    if (rowHasCertLink(row)) {
                        let ids = getIdsFromRow(row);
                        if (ids.cpfs.length) alunosLinked.add(ids.cpfs[0]);
                        else if (ids.emails.length) alunosLinked.add(ids.emails[0]);
                        else if (ids.nomes.length) alunosLinked.add(ids.nomes[0]);
                    }
                });
            });
            if (pType === 'cyberthon') { certsCyberthon += alunosLinked.size; cFacil += countLinks(certF); cMent += countLinks(certM); }
            else if (pType === 'mulheres') {
                // Certificados: conta CPFs únicos da aba de participantes/certificados
                const certSheet = getSheetData(fObj.data, [/participante.*certif|certif.*participante|participante|certifi/]) || [];
                const cpfSet = new Set();
                certSheet.forEach(row => {
                    const cpfKey = Object.keys(row).find(k => /cpf/i.test(normalize(k)));
                    if (cpfKey && row[cpfKey] && String(row[cpfKey]).trim() !== '') {
                        cpfSet.add(String(row[cpfKey]).replace(/\D/g, '').trim());
                    }
                });
                certsMulheres += cpfSet.size;
            }
            else if (pType === 'summer-job') {
                // Certificados alunos: links na LISTA DE PRESENÇA
                let summerLinked = new Set();
                pres.forEach(row => {
                    if (rowHasCertLink(row)) {
                        let ids = getIdsFromRow(row);
                        if (ids.cpfs.length) summerLinked.add(ids.cpfs[0]);
                        else if (ids.emails.length) summerLinked.add(ids.emails[0]);
                        else if (ids.nomes.length) summerLinked.add(ids.nomes[0]);
                    }
                });
                certsSummer += summerLinked.size;
                // Certificados facilitadores e mentores das abas específicas
                cFacil += countLinks(certF);
                cMent  += countLinks(certM);
            }
            else if (pType === 'masterclass') certsMasterclass += getMasterclassMetrics(fObj).certs;
            else if (pType === 'cissa-lab') {
                certsCissaLab += alunosLinked.size;
                cFacil += countLinks(certF);
                cMent  += countLinks(certM);
            }
            else if (pType === 'cissa-journey') {
                // Journey: certificados = quem tem DIREITO A CERTIFICADO? = Sim
                const presJ = getSheetData(fObj.data, [/presen/]) || [];
                const certSet = new Set();
                presJ.forEach(row => {
                    const dirKey = Object.keys(row).find(k => /direito.*certif/i.test(normalize(k)));
                    if (dirKey && /sim/i.test(String(row[dirKey]||''))) {
                        const ids = getIdsFromRow(row);
                        const id = ids.cpfs[0] || ids.emails[0] || ids.nomes[0];
                        if (id) certSet.add(id);
                    }
                });
                certsCissaJourney += certSet.size;
            }
            else if (pType === 'sbseg') certsSbseg += alunosLinked.size;
            else certsHandsOn += alunosLinked.size;
        });
        let totalCerts = certsCyberthon + certsHandsOn + certsMulheres + certsSummer + certsMasterclass + certsCissaLab + certsCissaJourney + certsSbseg + cFacil + cMent;

        // ── Carga horária total (abas gerais) ───────────────────────────────
        const isGeralHoras = currentScope === 'all' || currentScope.endsWith('_all');
        let horasCardHtml = '';
        if (isGeralHoras) {
            const totalHoras = filesToProcess.reduce((acc, f) => acc + horasArquivo(f), 0);
            if (totalHoras > 0) {
                const typeLabels = {
                    'cyberthon':'Cyberthon','hands-on':'Hands On','mulheres':'Mulheres em Ciber',
                    'summer-job':'Summer Job','masterclass':'Masterclass',
                    'cissa-lab':'CISSA Lab','cissa-journey':'CISSA Journey','sbseg':'SBSeg'
                };
                const uTypes = [...new Set(filesToProcess.map(f => f.type))];
                let breakdown = '';
                if (uTypes.length > 1) {
                    const byType = {};
                    filesToProcess.forEach(f => { const h = horasArquivo(f); if (h > 0) byType[f.type] = (byType[f.type] || 0) + h; });
                    breakdown = '<div class="cert-breakdown">' + Object.entries(byType).map(([t, h]) => `<span>${typeLabels[t]||t} <b>${formatHoras(h)}</b></span>`).join('') + '</div>';
                } else if (uTypes[0] === 'summer-job') {
                    const nAk = filesToProcess.filter(f => (f.name||'').toLowerCase().includes('akcit')).length;
                    const nPr = filesToProcess.length - nAk;
                    const parts = [];
                    if (nAk) parts.push(`${nAk > 1 ? nAk + ' × ' : ''}54h (AKCIT)`);
                    if (nPr) parts.push(`${nPr > 1 ? nPr + ' × ' : ''}180h`);
                    if (parts.length) breakdown = `<div class="cert-breakdown">${parts.map(p=>`<span>${p}</span>`).join('')}</div>`;
                } else if (filesToProcess.length > 1) {
                    const hPer = horasArquivo(filesToProcess[0]);
                    breakdown = `<div class="cert-breakdown"><span>${filesToProcess.length} edições × ${formatHoras(hPer)}</span></div>`;
                }
                horasCardHtml = `<div class="kpi-card highlight" style="background:var(--blue-dark);border-color:var(--blue-dark);" title="Carga horária total somando todas as edições desta seleção."><span style="color:white;">Carga Horária Total</span><div style="color:var(--orange);">${formatHoras(totalHoras)}</div>${breakdown}</div>`;
            }
        }

        if (currentView === 'ativos') {
            let grid = document.getElementById('kpi-grid');
            grid.innerHTML = `
                <div class="kpi-card" title="Total de formulários de inscrição recebidos."><span>Inscrições</span><div style="color:var(--blue-dark);">${esperados}</div></div>
                <div class="kpi-card" title="Taxa de pessoas que se inscreveram e compareceram."><span>Taxa de Engajamento</span><div style="color:var(--blue-dark);">${engajamento}</div></div>
                <div class="kpi-card highlight" style="background:var(--blue-dark);border-color:var(--blue-dark);" title="Detalhamento dos certificados emitidos por tipo.">
                    <span style="color:white;">Total de Certificados</span>
                    <div style="color:var(--orange);">${totalCerts}</div>
                    <div class="cert-breakdown">
                        ${(certsCyberthon + certsHandsOn + certsMulheres + certsSummer + certsMasterclass) > 0 ? `<span>👨‍🎓 Alunos <b>${certsCyberthon + certsHandsOn + certsMulheres + certsSummer + certsMasterclass}</b></span>` : ''}
                        ${cFacil > 0 ? `<span>🎓 Facilitadores <b>${cFacil}</b></span>` : ''}
                        ${cMent  > 0 ? `<span>🧑‍💼 Mentores <b>${cMent}</b></span>`       : ''}
                    </div>
                </div>
                ${horasCardHtml}`;
            renderEngagement(filesToProcess, totalRealizados, recorrentes, certsCyberthon, certsHandsOn, certsMulheres, certsSummer, cFacil, cMent, certsMasterclass, certsCissaLab, certsCissaJourney, certsSbseg);
        }

        let isCyber = pTypeGlobal === 'cyberthon';
        document.getElementById('card-edu').classList.toggle('hidden', isCyber);
        document.getElementById('card-ativ').classList.toggle('hidden', isCyber);
        document.getElementById('card-cargos').classList.toggle('hidden', isCyber);

        // ── Visibilidade dinâmica das abas ──────────────────────────────────
        const isMasterclass = pTypeGlobal === 'masterclass';
        const hasPresenca = combinedPresenca.length > 0 || pTypeGlobal === 'hands-on' || pTypeGlobal === 'summer-job' || isMasterclass || pTypeGlobal === 'cissa-lab' || pTypeGlobal === 'cissa-journey' || pTypeGlobal === 'sbseg';
        const isSummer    = pTypeGlobal === 'summer-job' || isMasterclass;
        document.getElementById('tab-geral').classList.toggle('hidden', isSummer);
        const hasReacao   = combinedReacao.length > 0;
        const hasAbandono = (combinedPresenca.length > 0 || pTypeGlobal === 'summer-job') && combinedInscricoes.length > 0;
        const hasMcPerm   = isMasterclass && filesToProcess.some(f => f.type === 'masterclass' && getMasterclassMetrics(f).permRows.length > 0);
        const hasMcCert   = isMasterclass && filesToProcess.some(f => f.type === 'masterclass' && getMasterclassMetrics(f).certRows.length > 0);

        document.getElementById('kpi-grid').classList.toggle('hidden', currentView !== 'ativos');
        document.getElementById('tab-ativos')  .classList.toggle('hidden', !hasPresenca);
        document.getElementById('tab-abandon') .classList.toggle('hidden', !hasAbandono);
        document.getElementById('tab-eval')    .classList.toggle('hidden', !hasReacao);
        document.getElementById('tab-mc-perm') .classList.toggle('hidden', !hasMcPerm);
        document.getElementById('tab-mc-cert') .classList.toggle('hidden', !hasMcCert);

        // Se a view atual ficou escondida, voltar para ativos (masterclass) ou geral
        if ((currentView === 'ativos'    && !hasPresenca)  ||
            (currentView === 'abandono'  && !hasAbandono)  ||
            (currentView === 'avaliacao' && !hasReacao)    ||
            (currentView === 'mc-perm'   && !hasMcPerm)    ||
            (currentView === 'mc-cert'   && !hasMcCert)) {
            currentView = isMasterclass ? 'ativos' : 'geral';
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(isMasterclass ? 'tab-ativos' : 'tab-geral').classList.add('active');
            document.getElementById('engagement-content').classList.toggle('hidden', !isMasterclass);
            document.getElementById('dashboard-content').classList.toggle('hidden', isMasterclass);
            document.getElementById('mc-perm-content').classList.add('hidden');
            document.getElementById('mc-cert-content').classList.add('hidden');
        }
        // ────────────────────────────────────────────────────────────────────

        if (currentView === 'abandono')  renderAbandonment(combinedInscricoes, combinedPresenca, totalAtivosCPFs, totalAtivosEmails, totalAtivosNomes, totalAtivosBase);
        else if (currentView === 'avaliacao') renderEvaluation(combinedReacao, filesToProcess);
        else if (currentView === 'banca' && pTypeGlobal === 'cyberthon') renderBanca(combinedBanca, filesToProcess);
        else if (currentView === 'ativos') renderEngagement(filesToProcess, totalRealizados, recorrentes, certsCyberthon, certsHandsOn, certsMulheres, certsSummer, cFacil, cMent, certsMasterclass, certsCissaLab, certsCissaJourney, certsSbseg);
        else if (currentView === 'mc-perm') renderMasterclassPermanencia(filesToProcess);
        else if (currentView === 'mc-cert') renderMasterclassCertificacao(filesToProcess);
        else if (currentView === 'geral' && !isSummer) renderDemographics(filteredData);
    }
