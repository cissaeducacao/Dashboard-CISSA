    // ── Auditoria de dados ───────────────────────────────────────────────────
    function buildAuditData() {
        const PRESENCA_VALS = new Set(['TRUE','SIM','VERDADEIRO','V','1','X','S']);
        const isPresCol = k => {
            const nk = normalize(k);
            return /presen|compare/i.test(nk) || /\bdia\b/i.test(nk) || /^\d{1,2}[\/\-\.]\d{1,2}/.test(k.trim());
        };

        return uploadedFiles.map(fObj => {
            const data = fObj.data;
            const sheetNames = Object.keys(data);

            // ── Detecção de abas ───────────────────────────────────────────
            const findSheet = (regexps) => {
                const key = sheetNames.find(k => regexps.some(r => r.test(normalize(k))));
                return key ? { nome: key, linhas: data[key].length } : { nome: '— não encontrada —', linhas: 0 };
            };

            const abaInsc  = fObj.type === 'summer-job'
                ? findSheet([/indicad/])
                : findSheet([/estudantes/, /alunos/, /inscri/, /respostas/, /^form/]);

            const abaPres  = findSheet([/presen/]);
            const abaCertF = findSheet([/certificados facilitadores/, /certificados fac/]);
            const abaCertM = findSheet([/certificados mentores/, /certificados men/]);

            // ── Contagem de participações ──────────────────────────────────
            const presData = abaPres.nome !== '— não encontrada —' ? data[abaPres.nome] : [];
            let ativos = 0;

            if (fObj.type === 'summer-job') {
                ativos = presData.filter(r => {
                    const fk = Object.keys(r).find(k => /frequ[eê]ncia|frequencia/i.test(normalize(k)));
                    const tk = Object.keys(r).find(k => /total.*pres|pres.*total/i.test(normalize(k)));
                    if (fk) { const p = parseFloat(String(r[fk]).replace('%','').replace(',','.')); return !isNaN(p) && p > 0; }
                    if (tk) { const t = parseFloat(String(r[tk]).replace(',','.')); return !isNaN(t) && t > 0; }
                    return true;
                }).length;
            } else if (fObj.type === 'mulheres') {
                const certS = findSheet([/participante.*certif|certif.*participante|participante|certifi/]);
                const cpfSet = new Set();
                if (certS.nome !== '— não encontrada —') {
                    data[certS.nome].forEach(r => {
                        const k = Object.keys(r).find(k => /cpf/i.test(normalize(k)));
                        if (k && r[k]) cpfSet.add(String(r[k]).replace(/\D/,'').trim());
                    });
                }
                ativos = cpfSet.size;
            } else if (fObj.type === 'hands-on') {
                ativos = presData.length;
            } else {
                presData.forEach(r => {
                    if (Object.keys(r).some(k => isPresCol(k) && PRESENCA_VALS.has(String(r[k]).toUpperCase().trim())))
                        ativos++;
                });
                if (ativos === 0 && !presData.some(r => Object.keys(r).some(isPresCol)))
                    ativos = presData.length;
            }

            // ── Contagem de certificados ───────────────────────────────────
            const hasLink = row => rowHasCertLink(row);

            const idOf = row => { const ids = getIdsFromRow(row); return ids.cpfs[0]||ids.emails[0]||ids.nomes[0]; };

            let certsAlunos = 0;
            if (fObj.type === 'mulheres') {
                const cs = findSheet([/participante.*certif|certif.*participante|participante|certifi/]);
                const cpfSet = new Set();
                if (cs.nome !== '— não encontrada —')
                    data[cs.nome].forEach(r => { const k = Object.keys(r).find(k => /cpf/i.test(normalize(k))); if (k && r[k]) cpfSet.add(String(r[k]).replace(/\D/,'').trim()); });
                certsAlunos = cpfSet.size;
            } else if (fObj.type === 'summer-job') {
                // Summer Job: conta links APENAS na LISTA DE PRESENÇA
                const linked = new Set();
                presData.forEach(r => { if (hasLink(r)) { const id = idOf(r); if (id) linked.add(id); } });
                certsAlunos = linked.size;
            } else {
                const linked = new Set();
                [...(abaInsc.nome !== '— não encontrada —' ? data[abaInsc.nome] : []),
                 ...presData].forEach(r => { if (hasLink(r)) { const id = idOf(r); if (id) linked.add(id); } });
                certsAlunos = fObj.type === 'cyberthon' ? Math.min(linked.size, presData.length) : linked.size;
            }
            const certsFacil = countLinks(abaCertF.nome !== '— não encontrada —' ? data[abaCertF.nome] : []);
            const certsMent  = countLinks(abaCertM.nome !== '— não encontrada —' ? data[abaCertM.nome] : []);
            const certsTotal = certsAlunos + certsFacil + certsMent;

            // ── Alertas de consistência ────────────────────────────────────
            const alertas = [];
            if (certsAlunos > ativos && ativos > 0) alertas.push('Certificados alunos > Participações');
            if (abaInsc.nome === '— não encontrada —') alertas.push('Aba de inscrições não detectada');
            if (abaPres.nome === '— não encontrada —') alertas.push('Aba de presença não detectada');
            if (abaInsc.linhas === 0) alertas.push('Inscrições: 0 linhas');
            if (abaPres.linhas === 0) alertas.push('Presença: 0 linhas');

            return {
                arquivo:      fObj.name,
                tipo:         fObj.type,
                abaInsc:      abaInsc.nome,
                linhasInsc:   abaInsc.linhas,
                abaPres:      abaPres.nome,
                linhasPres:   abaPres.linhas,
                abaCertF:     abaCertF.nome,
                linhasCertF:  abaCertF.linhas,
                abaCertM:     abaCertM.nome,
                linhasCertM:  abaCertM.linhas,
                ativos,
                certsAlunos,
                certsFacil,
                certsMent,
                certsTotal,
                alertas:      alertas.join(' | ') || 'OK'
            };
        });
    }

    function exportAuditCSV() {
        if (!uploadedFiles || uploadedFiles.length === 0) {
            alert('Nenhum dado carregado. Faça login primeiro.'); return;
        }
        const rows = buildAuditData();
        const header = [
            'Arquivo', 'Tipo',
            'Aba Inscrições', 'Linhas Inscrições',
            'Aba Presença', 'Linhas Presença',
            'Aba Cert. Facilitadores', 'Linhas Cert. Fac.',
            'Aba Cert. Mentores', 'Linhas Cert. Ment.',
            'Participações Detectadas',
            'Certificados Alunos', 'Certificados Facilitadores', 'Certificados Mentores', 'Total Certificados',
            'Alertas'
        ];
        const escape = v => '"' + String(v).replace(/"/g, '""') + '"';
        const lines = [
            header.join(';'),
            ...rows.map(r => [
                escape(r.arquivo), r.tipo,
                escape(r.abaInsc), r.linhasInsc,
                escape(r.abaPres), r.linhasPres,
                escape(r.abaCertF), r.linhasCertF,
                escape(r.abaCertM), r.linhasCertM,
                r.ativos,
                r.certsAlunos, r.certsFacil, r.certsMent, r.certsTotal,
                escape(r.alertas)
            ].join(';'))
        ];
        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(blob),
            download: 'auditoria_cissa_' + new Date().toISOString().slice(0,10) + '.csv'
        });
        a.click(); URL.revokeObjectURL(a.href);
    }
