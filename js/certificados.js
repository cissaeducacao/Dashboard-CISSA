    // ── Certificados ────────────────────────────────────────────────────────────

    function getCertLinkFromRow(row) {
        if (row.__certLink__) return row.__certLink__;
        for (const k of Object.keys(row)) {
            const val = String(row[k] || '').trim();
            if (val.includes('https://drive.google.com/file/d/')) return val;
            const nk = normalize(k);
            if ((nk.includes('link') || nk.includes('url')) && /^https?:\/\//i.test(val)) return val;
        }
        return null;
    }

    function getPersonFromRow(row) {
        let nome = '', cpf = '', email = '', codigo = '', vinculo = '', certEmitido = '', obs = '';
        Object.keys(row).forEach(k => {
            const nk = normalize(k);
            const val = String(row[k] || '').trim();
            if (!val || val === 'undefined' || val === 'null') return;
            if (nk.includes('cpf')) { if (!cpf) cpf = val; }
            else if (nk.includes('mail')) { if (!email) email = val; }
            else if (nk.includes('observ')) { if (!obs) obs = val; }
            else if (nk.includes('vinculo')) { if (!vinculo) vinculo = val; }
            else if ((nk.includes('codigo') || nk.includes('code')) && nk.includes('proj')) { if (!codigo) codigo = val; }
            else if (nk.includes('certif') && nk.includes('emitid')) { if (!certEmitido) certEmitido = val; }
            else if (nk.includes('nome') && !nk.includes('mae') && !nk.includes('pai') && !nk.includes('responsavel') && !nk.includes('certif')) {
                if (!nome) nome = val;
            }
        });
        if (!nome) {
            const firstKey = Object.keys(row).find(k => !k.startsWith('__') && !normalize(k).includes('cpf') && !normalize(k).includes('mail'));
            if (firstKey) nome = String(row[firstKey] || '').trim();
        }
        return { nome, cpf, email, codigo, vinculo, certEmitido, obs };
    }

    function getCertRows(fObj) {
        const data = fObj.data;
        const sheetNames = Object.keys(data);
        const groups = { Participante: [], Facilitador: [], Mentor: [] };
        const seen = {};
        Object.keys(groups).forEach(g => seen[g] = new Set());

        const addRow = (tipo, row) => {
            const link = getCertLinkFromRow(row);
            const info = getPersonFromRow(row);
            const id = (info.cpf || info.email || info.nome || '').toLowerCase().replace(/\s/g,'');
            if (!info.nome && !info.cpf && !link) return;
            if (id && seen[tipo].has(id)) return;
            if (id) seen[tipo].add(id);
            groups[tipo].push({ ...info, link, tipo });
        };

        if (fObj.type === 'levantamento') {
            sheetNames.forEach(k => (data[k] || []).forEach(row => addRow('Participante', row)));
            return groups;
        }

        if (fObj.type === 'cissa-lab') {
            const presKey = sheetNames.find(k => /lista.*presen|presen/i.test(normalize(k)));
            if (presKey) (data[presKey] || []).forEach(row => { if (rowHasCertLink(row)) addRow('Participante', row); });
            const facKey = sheetNames.find(k => /certificados facilitadores|certificados fac/i.test(normalize(k)));
            if (facKey) (data[facKey] || []).forEach(row => { if (rowHasCertLink(row)) addRow('Facilitador', row); });
            const menKey = sheetNames.find(k => /certificados mentores|certificados men/i.test(normalize(k)));
            if (menKey) (data[menKey] || []).forEach(row => { if (rowHasCertLink(row)) addRow('Mentor', row); });
            return groups;
        }

        if (fObj.type === 'cissa-journey') {
            const presKey = sheetNames.find(k => /controle.*presen|presen/i.test(normalize(k)));
            if (presKey) {
                (data[presKey] || []).forEach(row => {
                    const dirKey = Object.keys(row).find(k => /direito.*certif/i.test(normalize(k)));
                    if (!dirKey || /sim/i.test(String(row[dirKey]||''))) addRow('Participante', row);
                });
            }
            return groups;
        }

        if (fObj.type === 'mulheres') {
            const key = sheetNames.find(k => /participante.*certif|certif.*participante|participante|certifi/i.test(normalize(k)));
            if (key) (data[key] || []).forEach(row => addRow('Participante', row));
            return groups;
        }

        const presKey  = sheetNames.find(k => /presen/i.test(normalize(k)));
        const presData = presKey ? data[presKey] : [];
        const inscKey  = fObj.type === 'summer-job'
            ? sheetNames.find(k => /indicad/i.test(normalize(k)))
            : sheetNames.find(k => /estudantes|alunos|inscri|respostas|form/i.test(normalize(k)));
        const inscData = inscKey ? data[inscKey] : [];

        [...presData, ...inscData].forEach(row => {
            if (rowHasCertLink(row)) addRow('Participante', row);
        });

        const facKey = sheetNames.find(k => /certificados facilitadores|certificados fac/i.test(normalize(k)));
        if (facKey) (data[facKey] || []).forEach(row => { if (rowHasCertLink(row)) addRow('Facilitador', row); });

        const menKey = sheetNames.find(k => /certificados mentores|certificados men/i.test(normalize(k)));
        if (menKey) (data[menKey] || []).forEach(row => { if (rowHasCertLink(row)) addRow('Mentor', row); });

        return groups;
    }

    function fmtEventDate(fObj) {
        const d = fObj.day   !== 'Desconhecido' ? String(fObj.day).padStart(2,'0') : '';
        const m = fObj.month !== 'Desconhecido' ? fObj.month : '';
        const y = fObj.year  !== 'Desconhecido' ? fObj.year  : '';
        if (d && m && y) return `${d}/${m}/${y}`;
        if (m && y) return `${m}/${y}`;
        return y || '—';
    }

    const CERT_MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    function renderCertificadosPage() {
        const sel       = document.getElementById('cert-file-select');
        const yearSel   = document.getElementById('cert-filter-year');
        const monthSel  = document.getElementById('cert-filter-month');
        if (!sel) return;

        const skFn = f => (parseInt(f.year)||0)*10000 + (parseInt(f.month)||0)*100 + (parseInt(f.day)||0);
        const allFiles = [...uploadedFiles]
            .filter(f => f.type !== 'masterclass')
            .sort((a,b) => skFn(b) - skFn(a));

        // Populate year filter (preserve selection)
        const prevYear  = yearSel.value;
        const prevMonth = monthSel.value;
        const years  = [...new Set(allFiles.map(f => f.year).filter(y => y && y !== 'Desconhecido'))].sort((a,b) => b-a);
        const months = [...new Set(allFiles.map(f => parseInt(f.month)).filter(m => m > 0))].sort((a,b) => a-b);

        yearSel.innerHTML = '<option value="">Todos</option>';
        years.forEach(y => {
            const o = document.createElement('option');
            o.value = y; o.textContent = y; if (y === prevYear) o.selected = true;
            yearSel.appendChild(o);
        });
        monthSel.innerHTML = '<option value="">Todos</option>';
        months.forEach(m => {
            const o = document.createElement('option');
            o.value = m; o.textContent = CERT_MONTH_NAMES[m-1] || m; if (String(m) === prevMonth) o.selected = true;
            monthSel.appendChild(o);
        });

        // Filter files by selected year/month
        const selYear  = yearSel.value;
        const selMonth = monthSel.value;
        const sorted = allFiles.filter(f => {
            if (selYear  && String(f.year)             !== selYear)  return false;
            if (selMonth && String(parseInt(f.month))  !== selMonth) return false;
            return true;
        });

        const prev = sel.value;
        sel.innerHTML = '<option value="">— Selecione um projeto —</option>';
        sorted.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = getDisplayName(f) || f.name;
            sel.appendChild(opt);
        });
        if (prev && sorted.find(f => f.id === prev)) {
            sel.value = prev;
            switchCertFile(prev);
        } else {
            document.getElementById('cert-content').innerHTML =
                '<p style="color:var(--text-muted);font-size:0.95rem;">Selecione um projeto acima para visualizar os certificados.</p>';
        }
    }

    function buildCertTable(rows, dataConclusao) {
        if (!rows.length) return '';
        const rowsHtml = rows.map((r, i) => {
            const linkHtml = r.link
                ? `<a href="${r.link}" target="_blank" class="cert-link-btn">Abrir</a>`
                : '<span style="color:var(--text-muted);">—</span>';
            return `<tr>
                <td style="text-align:center;color:var(--text-muted);font-size:0.8rem;">${i+1}</td>
                <td>${r.nome || '—'}</td>
                <td>${r.cpf  || '—'}</td>
                <td>${r.email || '—'}</td>
                <td style="text-align:center;">${dataConclusao}</td>
                <td>${r.codigo || '—'}</td>
                <td>${r.vinculo || '—'}</td>
                <td style="text-align:center;">${r.certEmitido || '—'}</td>
                <td>${r.obs || '—'}</td>
                <td style="text-align:center;">${linkHtml}</td>
            </tr>`;
        }).join('');
        return `<div class="cert-table-wrap">
            <table class="embrapii-table" style="margin-top:8px;">
                <thead><tr>
                    <th style="text-align:center;width:48px;">#</th>
                    <th>Nome Completo</th>
                    <th>CPF</th>
                    <th>Email</th>
                    <th style="text-align:center;">Data de Conclusão</th>
                    <th>Código do Projeto</th>
                    <th>Vínculo</th>
                    <th style="text-align:center;">Cert. Emitido?</th>
                    <th>Observação</th>
                    <th style="text-align:center;">Certificado</th>
                </tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>`;
    }

    function switchCertFile(fileId) {
        const el = document.getElementById('cert-content');
        if (!fileId) { el.innerHTML = '<p style="color:var(--text-muted);font-size:0.95rem;">Selecione um projeto acima para visualizar os certificados.</p>'; return; }
        const fObj = uploadedFiles.find(f => f.id === fileId);
        if (!fObj) return;

        const groups = getCertRows(fObj);
        const dataConclusao = fmtEventDate(fObj);
        const total = Object.values(groups).reduce((s, a) => s + a.length, 0);

        if (!total) {
            el.innerHTML = `<div class="chart-card full-width" style="padding:20px;">
                <p style="color:var(--text-muted);">Nenhum certificado com link encontrado neste projeto.</p>
            </div>`;
            return;
        }

        const LABELS = { Participante: 'Participantes', Facilitador: 'Facilitadores', Mentor: 'Mentores' };
        const COLORS = { Participante: 'var(--blue-dark)', Facilitador: '#2d8a4e', Mentor: '#b55e00' };

        const sectionsHtml = Object.entries(LABELS).map(([tipo, label]) => {
            const rows = groups[tipo] || [];
            if (!rows.length) return '';
            return `<div style="margin-top:28px;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                    <span style="font-weight:700;font-size:1rem;color:${COLORS[tipo]};">${label}</span>
                    <span style="font-size:0.82rem;color:var(--text-muted);background:var(--border);border-radius:20px;padding:1px 10px;">${rows.length}</span>
                </div>
                ${buildCertTable(rows, dataConclusao)}
            </div>`;
        }).join('');

        el.innerHTML = `
            <div class="chart-card full-width" style="padding:20px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <h3 style="margin:0;padding:0;border:none;">${getDisplayName(fObj) || fObj.name} — ${total} certificado(s)</h3>
                    <button class="embrapii-export" onclick="exportCertCSV('${fileId}')">↓ Exportar CSV</button>
                </div>
                ${sectionsHtml}
            </div>`;
    }

    function exportCertCSV(fileId) {
        const fObj = uploadedFiles.find(f => f.id === fileId);
        if (!fObj) return;
        const groups = getCertRows(fObj);
        const dataConclusao = fmtEventDate(fObj);
        const allRows = ['Participante','Facilitador','Mentor'].flatMap(tipo => (groups[tipo] || []).map(r => ({ ...r, tipo })));
        const header = ['#','Tipo','Nome Completo','CPF','Email','Data de Conclusão',
            'Código do Projeto','Vínculo','Cert. Emitido?','Observação','Link Certificado'];
        const lines = [header];
        allRows.forEach((r, i) => {
            lines.push([i+1, r.tipo, r.nome||'', r.cpf||'', r.email||'', dataConclusao,
                r.codigo||'', r.vinculo||'', r.certEmitido||'', r.obs||'', r.link||'']);
        });
        const csv = lines.map(l => l.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = (getDisplayName(fObj) || fObj.name).replace(/[^\w\s-]/g,'') + ' — Certificados.csv';
        a.click(); URL.revokeObjectURL(url);
    }

    function exportAllCertXLSX() {
        const yearSel  = document.getElementById('cert-filter-year');
        const monthSel = document.getElementById('cert-filter-month');
        const selYear  = yearSel  ? yearSel.value  : '';
        const selMonth = monthSel ? monthSel.value : '';

        const skFn = f => (parseInt(f.year)||0)*10000 + (parseInt(f.month)||0)*100 + (parseInt(f.day)||0);
        const files = [...uploadedFiles]
            .filter(f => f.type !== 'masterclass')
            .filter(f => {
                if (selYear  && String(f.year)            !== selYear)  return false;
                if (selMonth && String(parseInt(f.month)) !== selMonth) return false;
                return true;
            })
            .sort((a,b) => skFn(b) - skFn(a));

        if (!files.length) { alert('Nenhum projeto no período selecionado.'); return; }

        const HEADER = ['#','Tipo','Nome Completo','CPF','Email','Data de Conclusão',
                        'Código do Projeto','Vínculo','Cert. Emitido?','Observação','Link Certificado'];

        const wb = XLSX.utils.book_new();

        files.forEach(fObj => {
            const groups = getCertRows(fObj);
            const dataConclusao = fmtEventDate(fObj);
            const allRows = ['Participante','Facilitador','Mentor']
                .flatMap(tipo => (groups[tipo] || []).map(r => ({ ...r, tipo })));

            const aoa = [HEADER, ...allRows.map((r, i) => [
                i+1, r.tipo, r.nome||'', r.cpf||'', r.email||'', dataConclusao,
                r.codigo||'', r.vinculo||'', r.certEmitido||'', r.obs||'', r.link||''
            ])];

            const ws = XLSX.utils.aoa_to_sheet(aoa);

            // Larguras de coluna
            ws['!cols'] = [
                {wch:4},{wch:13},{wch:30},{wch:16},{wch:30},{wch:18},
                {wch:20},{wch:20},{wch:14},{wch:30},{wch:60}
            ];

            // Nome da aba: até 31 chars, sem chars proibidos
            let tabName = (getDisplayName(fObj) || fObj.name)
                .replace(/[:\\\/\?\*\[\]]/g, '')
                .substring(0, 31)
                .trim();
            // Garante nome único
            let base = tabName, n = 2;
            while (wb.SheetNames.includes(tabName)) tabName = (base).substring(0, 28) + ' ' + n++;

            XLSX.utils.book_append_sheet(wb, ws, tabName);
        });

        // Período para o nome do arquivo
        let periodoLabel = '';
        if (selYear && selMonth) periodoLabel = ` — ${CERT_MONTH_NAMES[parseInt(selMonth)-1]} ${selYear}`;
        else if (selYear)  periodoLabel = ` — ${selYear}`;
        else if (selMonth) periodoLabel = ` — ${CERT_MONTH_NAMES[parseInt(selMonth)-1]}`;

        const fileName = `Certificados${periodoLabel}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }
