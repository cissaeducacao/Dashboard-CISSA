    function getMasterclassMetrics(fObj) {
        const sheet = Object.values(fObj.data)[0] || [];
        let insc = 0, partic = 0, certs = 0, perm0_50 = 0, perm50_75 = 0, perm75plus = 0;
        const permRows = [];  // [{ faixa, participantes, pct }]
        const certRows = [];  // [{ metrica, quantidade, pct, base }]
        sheet.forEach(row => {
            const vals = Object.values(row);
            const first = normalize(String(vals[0] || ''));
            const num = parseFloat(String(vals[1] || '').replace(',','.').replace('%',''));
            // Âncora ^ para não casar linhas da seção "Certificação" (ex: "Certificados / Inscrições únicas")
            if (/^inscri/.test(first) && !isNaN(num) && !insc) insc = num;
            else if (/^(?:pessoas|zoom|acessaram)/.test(first) && !isNaN(num) && !partic) partic = num;
            else if (/^certificados emitidos$/.test(first) && !isNaN(num) && num > 0 && !certs) certs = num;
            else if (/^0.*50|^0%.*50%/.test(first) && !isNaN(num)) { perm0_50 = num; permRows.push({ faixa: String(vals[0]||'').trim(), participantes: num, pct: String(vals[2]||'').trim() }); }
            else if (/^51.*75|^50.*75/.test(first) && !isNaN(num)) { perm50_75 = num; permRows.push({ faixa: String(vals[0]||'').trim(), participantes: num, pct: String(vals[2]||'').trim() }); }
            else if (/^mais.*75|^75.*tempo/.test(first) && !isNaN(num)) { perm75plus = num; permRows.push({ faixa: String(vals[0]||'').trim(), participantes: num, pct: String(vals[2]||'').trim() }); }
            else if (/^total.*acess/.test(first) && !isNaN(num)) { permRows.push({ faixa: String(vals[0]||'').trim(), participantes: num, pct: String(vals[2]||'').trim() }); }
            else if (/^certificados emitidos\s*\//.test(String(vals[0]||'').toLowerCase()) && !isNaN(num)) {
                certRows.push({ metrica: String(vals[0]||'').trim(), quantidade: num, pct: String(vals[2]||'').trim(), base: String(vals[3]||'').trim() });
            }
        });
        // fallback: primeira linha com 'certificad' e valor numérico (caso o label varie)
        if (!certs) sheet.forEach(row => {
            const first = normalize(String(Object.values(row)[0] || ''));
            const num = parseFloat(String(Object.values(row)[1] || '').replace(',','.'));
            if (/^certificad/.test(first) && !isNaN(num) && num > 0 && !certs) certs = num;
        });
        return { insc, partic, certs, perm0_50, perm50_75, perm75plus, permRows, certRows };
    }

    function renderMasterclassPermanencia(filesToProcess) {
        const mcFiles = filesToProcess.filter(f => f.type === 'masterclass');
        const el = document.getElementById('mc-perm-body');
        if (!el) return;
        if (!mcFiles.length) { el.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Nenhum dado de Masterclass carregado.</p>'; return; }

        let html = '';
        mcFiles.forEach(fObj => {
            const mc = getMasterclassMetrics(fObj);
            const nome = getDisplayName(fObj) || fObj.name;
            if (mcFiles.length > 1) html += `<h3 style="margin:20px 0 10px;color:var(--blue-dark);">${nome}</h3>`;
            if (!mc.permRows.length) { html += '<p style="color:var(--text-muted);padding:8px 0;">Dados de permanência não encontrados.</p>'; return; }
            html += `<div class="chart-card full-width" style="padding:20px;">
                <h3>Permanência na Masterclass</h3>
                <table class="embrapii-table" style="margin-top:12px;">
                    <thead><tr>
                        <th>Faixa de Permanência</th>
                        <th style="text-align:center;">Participantes</th>
                        <th style="text-align:center;">% dos Acessos</th>
                    </tr></thead>
                    <tbody>`;
            mc.permRows.forEach(r => {
                const isTotal = /total/i.test(r.faixa);
                const style = isTotal ? 'font-weight:700;background:rgba(55,91,149,0.06);' : '';
                html += `<tr style="${style}">
                    <td>${r.faixa}</td>
                    <td style="text-align:center;">${r.participantes}</td>
                    <td style="text-align:center;">${r.pct}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        });
        el.innerHTML = html;
    }

    function renderMasterclassCertificacao(filesToProcess) {
        const mcFiles = filesToProcess.filter(f => f.type === 'masterclass');
        const el = document.getElementById('mc-cert-body');
        if (!el) return;
        if (!mcFiles.length) { el.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Nenhum dado de Masterclass carregado.</p>'; return; }

        let html = '';
        mcFiles.forEach(fObj => {
            const mc = getMasterclassMetrics(fObj);
            const nome = getDisplayName(fObj) || fObj.name;
            if (mcFiles.length > 1) html += `<h3 style="margin:20px 0 10px;color:var(--blue-dark);">${nome}</h3>`;
            if (!mc.certRows.length) { html += '<p style="color:var(--text-muted);padding:8px 0;">Dados de certificação não encontrados.</p>'; return; }
            html += `<div class="chart-card full-width" style="padding:20px;">
                <h3>Certificação</h3>
                <table class="embrapii-table" style="margin-top:12px;">
                    <thead><tr>
                        <th>Métrica</th>
                        <th style="text-align:center;">Quantidade</th>
                        <th style="text-align:center;">% sobre Base</th>
                        <th>Base de Referência</th>
                    </tr></thead>
                    <tbody>`;
            mc.certRows.forEach(r => {
                html += `<tr>
                    <td>${r.metrica}</td>
                    <td style="text-align:center;">${r.quantidade}</td>
                    <td style="text-align:center;">${r.pct}</td>
                    <td>${r.base}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        });
        el.innerHTML = html;
    }
