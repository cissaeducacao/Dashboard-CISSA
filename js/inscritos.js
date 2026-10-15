    // ── Base de Inscritos ──────────────────────────────────────────────
    let _inscritosDB  = [];
    let _inscFiltrado = [];
    let _inscPage     = 0;
    const _INSC_PER_PAGE = 1000;

    const _INSC_TIPO_LABEL = {
        'cyberthon':'Cyberthon','hands-on':'Hands On','mulheres':'Mulheres em Ciber',
        'summer-job':'Summer Job','masterclass':'Masterclass','cissa-lab':'CISSA Lab',
        'cissa-journey':'CISSA Journey','sbseg':'SBSeg'
    };

    const _MES_BR = {
        '01':'Janeiro','02':'Fevereiro','03':'Março','04':'Abril','05':'Maio','06':'Junho',
        '07':'Julho','08':'Agosto','09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro'
    };

    function _inscFindVal(row, patterns) {
        const key = Object.keys(row).find(k => patterns.some(p => p.test(normalize(k))));
        return key !== undefined ? String(row[key] ?? '').trim() : '';
    }

    function _calcIdade(dataNasc) {
        if (!dataNasc) return '';
        const m = String(dataNasc).match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (!m) return '';
        let y = parseInt(m[3]);
        if (y < 100) y += y < 30 ? 2000 : 1900;
        const birth = new Date(y, parseInt(m[2])-1, parseInt(m[1]));
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        if (today.getMonth() - birth.getMonth() < 0 ||
           (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
        return (age > 4 && age < 120) ? String(age) : '';
    }

    function _inscDateKey(fObj) {
        return (parseInt(fObj.year) || 0) * 10000 + (parseInt(fObj.month) || 0) * 100 + (parseInt(fObj.day) || 0);
    }

    // Tipos onde estar na lista de inscrição = participou (sem aba de presença cruzável)
    // summer-job: INDICADOS usa e-mail pessoal, LISTA DE PRESENÇA usa e-mail institucional → impossível casar
    const _ALWAYS_PARTICIPATED = new Set(['mulheres', 'masterclass', 'summer-job']);

    function _getParticipantSet(fObj) {
        // Para tipos sem aba de presença, retorna sentinela especial (Set vazio com flag)
        if (_ALWAYS_PARTICIPATED.has(fObj.type)) {
            const s = new Set(); s.__allParticipated = true; return s;
        }

        const data = fObj.data;
        const PRESENT = new Set(['1','TRUE','SIM','VERDADEIRO','V','X','S','PRESENT','P']);

        // Acha todas as abas com "presença" ou "frequência"
        const presSheets = Object.keys(data).filter(k => /presen|frequen/i.test(normalize(k)));
        if (!presSheets.length) return null;

        // Prefere aba com coluna CPF (aba estruturada) sobre resposta de Form (timestamp)
        let presKey = presSheets.find(k => {
            const rows = data[k];
            if (!rows || !rows.length) return false;
            return Object.keys(rows[0] || {}).some(col => /^cpf$/i.test(normalize(col)));
        }) || presSheets[0];

        if (!data[presKey] || !data[presKey].length) return null;
        const presRows = data[presKey];
        const firstRow = presRows[0] || {};
        const allCols = Object.keys(firstRow);

        const participants = new Set();
        const addRow = row => {
            const ids = getIdsFromRow(row);
            ids.cpfs.forEach(v => participants.add('cpf:' + v));
            ids.emails.forEach(v => participants.add('email:' + v));
            ids.nomes.forEach(v => participants.add('nome:' + v));
            ids.baseNomes.forEach(v => participants.add('bn:' + v));
        };

        // Resposta de Form (tem "Carimbo de data/hora" ou "Timestamp"): todos os respondentes = presentes
        const isFormResponse = allCols.some(c => /carimbo|timestamp/i.test(normalize(c)));
        if (isFormResponse) {
            presRows.forEach(addRow);
            return participants;
        }

        let dayCols = fObj.type === 'cissa-journey'
            ? allCols.filter(k => /^\d{2}\/\d{2}$/.test(k))
            : allCols.filter(_isDateCol);

        // Quando não há colunas de data: busca TODAS colunas de presença (inclui PRESENÇA DO PARTICIP_1/2/3)
        const presCols = dayCols.length === 0
            ? allCols.filter(k => { const nk = normalize(k); return /presen/i.test(nk) && !/nome|cpf|email|matricula|certif/i.test(nk); })
            : [];

        // Apenas booleanos e inteiros puros (exclui strings de data como "2026-01-15" e datas seriais Excel)
        const isPresent = val => {
            const s = String(val || '').toUpperCase().trim();
            if (PRESENT.has(s)) return true;
            return /^\d+(\.\d+)?$/.test(s) && parseFloat(s) > 0;
        };

        presRows.forEach(row => {
            let participated = false;
            if (dayCols.length > 0) {
                participated = dayCols.some(dk => isPresent(row[dk]));
            } else if (presCols.length > 0) {
                participated = presCols.some(pc => isPresent(row[pc]));
            } else {
                participated = true; // aba estruturada sem colunas detectáveis → todos presentes
            }
            if (!participated) return;
            addRow(row);
        });
        return participants;
    }

    function _matchParticipou(inscRow, partSet) {
        if (!partSet) return '';
        if (partSet.__allParticipated) return 'Sim';
        // Usa cleanId para todos — igual à forma que getIdsFromRow armazena no Set
        const cpf   = cleanId(inscRow.cpf);
        const email = cleanId(inscRow.email);
        const nome  = cleanId(inscRow.nome);
        if (cpf && partSet.has('cpf:' + cpf)) return 'Sim';
        if (email && partSet.has('email:' + email)) return 'Sim';
        if (nome && partSet.has('nome:' + nome)) return 'Sim';
        const nParts = normalize(inscRow.nome).replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).filter(x => x.length > 2);
        if (nParts.length >= 2 && partSet.has('bn:' + nParts[0] + nParts[1])) return 'Sim';
        return 'Não';
    }

    function buildInscritosDB(allFiles) {
        const sorted = [...allFiles].sort((a, b) => _inscDateKey(b) - _inscDateKey(a));
        const rows = [];
        sorted.forEach(fObj => {
            const sheet = getInscritosSheet(fObj);
            if (!sheet.length) return;
            const tipoLabel = _INSC_TIPO_LABEL[fObj.type] || fObj.type;
            const edicao    = getDisplayName(fObj) || fObj.name;
            const partSet   = _getParticipantSet(fObj);

            sheet.forEach(r => {
                const nome  = _inscFindVal(r, [/^nome/i, /nome.completo/i, /nome.estudante/i]);
                const email = _inscFindVal(r, [/^e-?mail/i, /^email/i, /endere[cç]o.*mail/i]);
                const cpf   = _inscFindVal(r, [/^cpf/i]);
                if (!nome && !email && !cpf) return;

                // PCD: may be a single column or split bool + type
                const pcdRaw  = _inscFindVal(r, [/^pcd$/i, /\bpcd\b/i, /portador.*defic/i, /defici[eê]ncia/i, /pessoa.*defic/i]);
                const tipoPcd = _inscFindVal(r, [/tipo.*pcd/i, /tipo.*defic/i, /qual.*defic/i, /especif.*defic/i, /descr.*defic/i]);

                // Normalize PCD boolean display
                let pcdDisplay = '';
                if (pcdRaw) {
                    const pn = normalize(pcdRaw);
                    if (pn === 'sim' || pn === 's' || pn === 'yes' || pn === '1' || pn === 'true') pcdDisplay = 'Sim';
                    else if (pn === 'nao' || pn === 'n' || pn === 'no' || pn === '0' || pn === 'false' || pn === 'nenhuma') pcdDisplay = 'Não';
                    else pcdDisplay = pcdRaw; // may already be a type description
                }

                const idadeDireto = _inscFindVal(r, [/^idade$/i]);
                const dataNasc    = _inscFindVal(r, [/data.*nasc/i, /nasc.*data/i, /^nasc/i]);
                const idade = idadeDireto || _calcIdade(dataNasc);

                const partial = {
                    nome, cpf, email,
                    genero:       _inscFindVal(r, [/^g[eê]nero$/i, /^sexo$/i, /g[eê]nero/i, /sexo/i]),
                    etnia:        _inscFindVal(r, [/ra[cç]a/i, /etnia/i, /cor.*pele/i, /cor.ra[cç]a/i]),
                    escolaridade: _inscFindVal(r, [/escolaridade/i, /instruca/i, /grau.*estudo/i, /forma[cç][aã]o.*acad/i]),
                    idade,
                    estado:       _inscFindVal(r, [/^(uf|estado)$/i, /\bestado\b/i, /\buf\b/i]),
                    cidade:       _inscFindVal(r, [/^cidade$/i, /munic[ií]pio/i, /\bcidade\b/i]),
                    pcd:          pcdDisplay,
                    tipoPcd,
                    projeto:      tipoLabel,
                    tipo:         fObj.type,
                    edicao,
                    ano:          fObj.year  || '',
                    mes:          fObj.month || '',
                    fileId:       fObj.id
                };
                partial.participou = _matchParticipou(partial, partSet);
                rows.push(partial);
            });
        });
        return rows;
    }

    function renderInscritos(allFiles) {
        _inscritosDB = buildInscritosDB(allFiles);

        const projSel = document.getElementById('inscritos-filter-proj');
        const anoSel  = document.getElementById('inscritos-filter-ano');
        const mesSel  = document.getElementById('inscritos-filter-mes');
        if (!projSel) return;

        const projAtual = projSel.value;
        const anoAtual  = anoSel.value;
        const mesAtual  = mesSel.value;

        const projetos = [...new Set(_inscritosDB.map(r => r.projeto))].sort();
        const anos     = [...new Set(_inscritosDB.map(r => r.ano).filter(Boolean))].sort((a,b)=>b-a);
        const meses    = [...new Set(_inscritosDB.map(r => r.mes).filter(Boolean))].sort((a,b)=>parseInt(a)-parseInt(b));

        projSel.innerHTML = '<option value="">Todos os Projetos</option>' +
            projetos.map(p => `<option value="${p}"${p===projAtual?' selected':''}>${p}</option>`).join('');
        anoSel.innerHTML  = '<option value="">Todos os Anos</option>' +
            anos.map(a => `<option value="${a}"${a===anoAtual?' selected':''}>${a}</option>`).join('');
        mesSel.innerHTML  = '<option value="">Todos os Meses</option>' +
            meses.map(m => `<option value="${m}"${m===mesAtual?' selected':''}>${_MES_BR[m]||m}</option>`).join('');

        _applyInscritosFilters();
    }

    function _applyInscritosFilters() {
        const proj = document.getElementById('inscritos-filter-proj')?.value || '';
        const ano  = document.getElementById('inscritos-filter-ano')?.value  || '';
        const mes  = document.getElementById('inscritos-filter-mes')?.value  || '';
        const part = document.getElementById('inscritos-filter-part')?.value || '';

        _inscFiltrado = _inscritosDB.filter(r => {
            if (proj && r.projeto    !== proj) return false;
            if (ano  && r.ano        !== ano)  return false;
            if (mes  && r.mes        !== mes)  return false;
            if (part && r.participou !== part) return false;
            return true;
        });

        _inscPage = 0;
        _renderInscritosTable();
    }

    function _renderInscritosTable() {
        const tbody = document.getElementById('inscritos-tbody');
        const count = document.getElementById('inscritos-count');
        if (!tbody) return;

        const total  = _inscFiltrado.length;
        const pages  = Math.max(1, Math.ceil(total / _INSC_PER_PAGE));
        if (_inscPage >= pages) _inscPage = pages - 1;

        const start = _inscPage * _INSC_PER_PAGE;
        const end   = Math.min(start + _INSC_PER_PAGE, total);
        const shown = _inscFiltrado.slice(start, end);

        const isDark = document.body.classList.contains('dark-mode');
        const rowOdd = isDark ? 'background:rgba(255,255,255,0.04)' : 'background:rgba(55,91,149,0.04)';
        tbody.innerHTML = shown.map((r, i) => {
            const partColor = r.participou === 'Sim' ? 'color:#2e7d32;font-weight:600;'
                : r.participou === 'Não' ? 'color:#b71c1c;font-weight:600;' : '';
            return `<tr style="${i%2===0?rowOdd:''}">
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;color:var(--text-muted);font-size:0.75rem;white-space:nowrap;">${start + i + 1}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);white-space:nowrap;">${esc(r.nome)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);white-space:nowrap;">${esc(r.cpf)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);white-space:nowrap;">${esc(r.email)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);">${esc(r.genero)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);">${esc(r.etnia)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);">${esc(r.escolaridade)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;">${esc(r.idade)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);">${esc(r.estado)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);">${esc(r.cidade)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;">${esc(r.pcd)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);">${esc(r.tipoPcd)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);white-space:nowrap;">${esc(r.projeto)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);white-space:nowrap;">${esc(r.edicao)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;${partColor}">${esc(r.participou)}</td>
        </tr>`;
        }).join('');

        const btnStyle = 'padding:4px 12px;border:1px solid var(--border);border-radius:5px;background:var(--card);color:var(--text-main);font-family:"DM Sans",sans-serif;font-size:0.82rem;cursor:pointer;';
        const info = total === 0 ? 'Nenhum registro encontrado'
            : `${start + 1}–${end} de ${total} registro${total !== 1 ? 's' : ''}`;

        count.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="color:var(--text-muted);">${info}</span>
            ${pages > 1 ? `
            <button style="${btnStyle}opacity:${_inscPage===0?0.35:1}" ${_inscPage===0?'disabled':''} onclick="_inscGoPage(${_inscPage-1})">← Anterior</button>
            <span style="font-size:0.82rem;color:var(--text-muted);">Pág. ${_inscPage+1} / ${pages}</span>
            <button style="${btnStyle}opacity:${_inscPage>=pages-1?0.35:1}" ${_inscPage>=pages-1?'disabled':''} onclick="_inscGoPage(${_inscPage+1})">Próxima →</button>
            ` : ''}
        </div>`;
    }

    function _inscGoPage(p) {
        _inscPage = p;
        _renderInscritosTable();
        document.getElementById('inscritos-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function esc(s) {
        return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function exportInscritosCSV() {
        if (!_inscFiltrado.length) { alert('Nenhum dado para exportar.'); return; }
        const headers = ['Nome','CPF','Email','Gênero','Etnia','Escolaridade','Idade','Estado','Cidade','PCD','Tipo PCD','Projeto','Edição','Participou'];
        const fields  = ['nome','cpf','email','genero','etnia','escolaridade','idade','estado','cidade','pcd','tipoPcd','projeto','edicao','participou'];
        const csvVal  = v => '"' + String(v||'').replace(/"/g,'""') + '"';
        const lines   = [headers.map(csvVal).join(',')];
        _inscFiltrado.forEach(r => lines.push(fields.map(f => csvVal(r[f])).join(',')));
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'base-inscritos.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    function _showInscToast(msg) {
        let t = document.getElementById('inscritos-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'inscritos-toast';
            t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#232323;color:#E8E8E8;padding:10px 22px;border-radius:8px;font-family:"DM Sans",sans-serif;font-size:0.9rem;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.25);pointer-events:none;transition:opacity 0.3s;';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.opacity = '1';
        clearTimeout(t._to);
        t._to = setTimeout(() => { t.style.opacity = '0'; }, 2800);
    }

    function copyInscritosEmails() {
        const emails = [...new Set(_inscFiltrado.map(r => r.email).filter(Boolean))];
        if (!emails.length) { _showInscToast('Nenhum e-mail encontrado nos registros filtrados.'); return; }
        const done = () => _showInscToast(`✓ ${emails.length} e-mail${emails.length !== 1 ? 's' : ''} copiado${emails.length !== 1 ? 's' : ''}!`);
        navigator.clipboard.writeText(emails.join('\n')).then(done).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = emails.join('\n');
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            done();
        });
    }
