    function normalize(str) { return String(str || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
    function cleanId(v) { return normalize(v).replace(/[^a-z0-9]/g, ""); }
    function getSheetData(dataObj, regexps) {
        const found = Object.keys(dataObj).find(k => regexps.some(r => r.test(normalize(k))));
        return found ? dataObj[found] : null;
    }

    function rowHasCertLink(row) {
        // Formato antigo: coluna nomeada "link" ou "url"
        if (Object.keys(row).some(k => {
            const nk = normalize(k);
            const val = String(row[k] || '').trim();
            return (nk.includes('link') || nk.includes('url')) && val !== '' && val !== 'undefined' && val !== 'null';
        })) return true;
        // Formato novo: colunas sem cabeçalho (ex: __EMPTY_3) com URL do Drive como valor
        return Object.values(row).some(v => String(v || '').includes('https://drive.google.com/file/d/'));
    }

    function countLinks(sheetData) {
        if (!sheetData) return 0;
        return sheetData.filter(row => rowHasCertLink(row)).length;
    }

    function getIdsFromRow(row) {
        let cpfs = [], emails = [], nomes = [], baseNomes = [];
        Object.keys(row).forEach(k => {
            let n = normalize(k), rawVal = String(row[k]), v = cleanId(rawVal);
            if (!v || ['nao','sim','true','false'].includes(v)) return;
            if (n.includes('cpf')) cpfs.push(v);
            else if (n.includes('mail')) emails.push(v);
            else if (n.includes('nome') && !n.includes('certificado') && !n.includes('mae') && !n.includes('pai') && !n.includes('responsavel')) {
                nomes.push(v);
                let parts = normalize(rawVal).replace(/[^a-z0-9 ]/g, "").trim().split(/\s+/).filter(x => x.length > 2);
                if (parts.length >= 2) baseNomes.push(parts[0] + parts[1]);
            }
        });
        return { cpfs, emails, nomes, baseNomes };
    }

    function processFileBuffer(arrayBuffer, fileName) {
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        let sheets = {};
        let sheetNamesLower = [];
        workbook.SheetNames.forEach(n => {
            const ws = workbook.Sheets[n];
            const jsonRows = XLSX.utils.sheet_to_json(ws);
            // Colunas sem cabeçalho (novo formato Summer Job) ficam fora do sheet_to_json
            // padrão. Relemos como array raw para capturar Drive URLs nessas colunas.
            try {
                const raw = XLSX.utils.sheet_to_json(ws, {header: 1});
                const urlMap = new Map();
                raw.slice(1).forEach(r => {
                    const url = r.find(c => typeof c === 'string' && c.includes('https://drive.google.com/file/d/'));
                    if (url && r[0]) urlMap.set(String(r[0]).trim().toLowerCase(), url);
                });
                if (urlMap.size > 0) {
                    jsonRows.forEach(row => {
                        const nome = row[Object.keys(row)[0]];
                        if (nome) {
                            const key = String(nome).trim().toLowerCase();
                            if (urlMap.has(key)) row.__certLink__ = urlMap.get(key);
                        }
                    });
                }
            } catch(e) {}
            sheets[n] = jsonRows;
            sheetNamesLower.push(n.toLowerCase());
        });

        let type = 'cyberthon';
        if (fileName.toLowerCase().includes('cissa lab') || sheetNamesLower.some(s => s.includes('dados participantes') && sheetNamesLower.includes('indicados'))) {
            type = 'cissa-lab';
        } else if (fileName.toLowerCase().includes('journey') || sheetNamesLower.some(s => /controle.*presen/.test(s))) {
            type = 'cissa-journey';
            // Re-parse "Controle de Presença": combine row2+row3 as merged header, data from row4+
            workbook.SheetNames.forEach(sheetName => {
                if (!/controle.*presen/i.test(normalize(sheetName))) return;
                const ws  = workbook.Sheets[sheetName];
                const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
                const r2  = raw[1] || [];  // month group labels + summary labels
                const r3  = raw[2] || [];  // NOME, EMAIL, CPF, date columns
                const maxCols = Math.max(r2.length, r3.length);
                const MONTH_NUM = { 'janeiro':'01','fevereiro':'02','marco':'03','abril':'04','maio':'05',
                    'junho':'06','julho':'07','agosto':'08','setembro':'09','outubro':'10','novembro':'11','dezembro':'12' };
                const headers = [];
                let curMonth = '';
                for (let i = 0; i < maxCols; i++) {
                    const mStr = normalize(String(r2[i] || ''));
                    if (MONTH_NUM[mStr]) curMonth = MONTH_NUM[mStr];
                    const dayRaw = String(r3[i] === undefined ? '' : r3[i]).trim();
                    const dayNum = parseFloat(dayRaw);
                    if (!isNaN(dayNum) && dayRaw !== '' && !/[a-z]/i.test(dayRaw) && curMonth) {
                        headers[i] = String(Math.round(dayNum)).padStart(2,'0') + '/' + curMonth;
                    } else {
                        headers[i] = (r3[i] !== undefined && r3[i] !== '' && r3[i] !== null) ? r3[i] : (r2[i] || '');
                    }
                }
                sheets[sheetName] = raw.slice(3)
                    .map(r => {
                        const obj = {};
                        headers.forEach((h, i) => {
                            if (h !== '' && h !== null && h !== undefined)
                                obj[String(h)] = r[i] !== undefined ? r[i] : '';
                        });
                        return obj;
                    })
                    .filter(r => r['NOME COMPLETO (de acordo com o RG)'] || r['E-MAIL'] || r['CPF']);
            });
        } else if (fileName.toLowerCase().includes('levantamento') || fileName.toLowerCase().includes('alunos formados')) {
            type = 'levantamento';
            // Re-parse each sheet: find the real header row (first row that has "Nome" or "CPF")
            workbook.SheetNames.forEach(sheetName => {
                const ws = workbook.Sheets[sheetName];
                const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
                const headerIdx = raw.findIndex(r =>
                    r.some(c => { const n = normalize(String(c||'')); return n.includes('nome') || n.includes('cpf'); })
                );
                if (headerIdx < 0) return;
                const headers = raw[headerIdx];
                sheets[sheetName] = raw.slice(headerIdx + 1)
                    .map(r => {
                        const obj = {};
                        headers.forEach((h, i) => { if (h && r[i] !== undefined && r[i] !== '') obj[String(h)] = r[i]; });
                        return obj;
                    })
                    .filter(r => Object.values(r).some(v => v !== '' && v !== undefined));
            });
        } else if (fileName.toLowerCase().includes('masterclass') || sheetNamesLower.some(s => s.includes('masterclass'))) type = 'masterclass';
        else if (sheetNamesLower.some(s => s.includes('mulher')) || fileName.toLowerCase().includes('mulher')) type = 'mulheres';
        else if (fileName.toLowerCase().includes('summer') || sheetNamesLower.some(s => s.includes('summer'))) type = 'summer-job';
        else if (sheetNamesLower.some(s => s.includes('diagn')) || fileName.toLowerCase().includes('hand')) type = 'hands-on';
        else if (fileName.toLowerCase().includes('sbseg') || sheetNamesLower.some(s => s.includes('dados inscritos'))) type = 'sbseg';
        else if (sheetNamesLower.some(s => s.includes('banca') || s.includes('estudantes')) || fileName.toLowerCase().includes('cybe')) type = 'cyberthon';

        let year = "Desconhecido", month = "Desconhecido", day = "00", monthKey = "Desconhecido";
        // Tenta extrair dia + mês + ano (ex: "08 09_04_2026" ou "08_04_2026")
        const fullDate = fileName.match(/(\d{1,2})(?:\s+\d{1,2})?\s*[_\/](\d{2})[_\/](20\d{2})/);
        if (fullDate) {
            day = fullDate[1].padStart(2, '0');
            month = fullDate[2];
            year = fullDate[3];
        } else {
            const nameMatch = fileName.match(/(\d{2})_(\d{4})/);
            if (nameMatch) { month = nameMatch[1]; year = nameMatch[2]; }
            else { const yMatch = fileName.match(/(20\d{2})/); if (yMatch) year = yMatch[1]; }
        }
        if (month !== "Desconhecido" && year !== "Desconhecido") monthKey = month + "_" + year;

        let fileId = 'file_' + Date.now() + Math.floor(Math.random() * 1000);
        let fileDisplayName = fileName.replace(/\.[^/.]+$/, "").replace(/Cybethon/g, 'Cyberthon');

        uploadedFiles.push({ id: fileId, name: fileDisplayName, type: type, data: sheets, year, month, day, monthKey });
    }

    // ── Carga horária por arquivo (1 arquivo = 1 edição) ────────────────────
    function horasArquivo(f) {
        const n = (f.name || '').toLowerCase();
        switch (f.type) {
            case 'cyberthon':     return 16;
            case 'hands-on':     return 10;
            case 'mulheres':     return 4;
            case 'summer-job':   return n.includes('akcit') ? 54 : 180;
            case 'masterclass':  return 2;
            case 'cissa-lab':    return 4;
            case 'cissa-journey':return 40;
            case 'sbseg':        return 1.5;
            default: return 0;
        }
    }
    function formatHoras(h) {
        if (h % 1 === 0) return h + 'h';
        const int = Math.floor(h);
        const min = Math.round((h - int) * 60);
        return int > 0 ? `${int}h${min}min` : `${min}min`;
    }

    // ── Nome de exibição por tipo de arquivo ────────────────────────────────
    function extractTitle(fullName) {
        // Hands On: mantém só o tema, remove datas e sufixos
        return fullName
            .replace(/^[^\/]+\//, '')  // remove prefixo de pasta (ex: "Hands On/")
            .replace(/\d{1,2}[,\se]+\d{1,2}([,\se]+\d{1,2})*\s*[_\/]\s*\d{2}[_\/]?\s*\d{4}/gi, '')
            .replace(/\d{2}\s*e\s*\d{2}[_\/]\d{2}[_\/]\d{4}/gi, '')
            .replace(/[-–]\s*Hands\s*On\s*CISSA/gi, '')
            .replace(/[-–]\s*Cyberthon\s*CISSA/gi, '')
            .replace(/Hands\s*On\s*CISSA/gi, '')
            .replace(/Cyberthon\s*CISSA/gi, '')
            .replace(/CISSA/gi, '')
            .replace(/\s{2,}/g, ' ')
            .replace(/^[-–,\s]+|[-–,\s]+$/g, '')
            .trim();
    }

    function getDisplayName(fObj) {
        if (fObj.type === 'cissa-lab')     return fObj.name.replace(/^[^\/]+\//, '').replace(/\s*CISSA\s*/gi, ' CISSA ').trim();
        if (fObj.type === 'cissa-journey') return fObj.name.replace(/^[^\/]+\//, '').trim();
        if (fObj.type === 'hands-on') return extractTitle(fObj.name);
        if (fObj.type === 'mulheres') {
            // Remove prefixo de pasta, boilerplate do Form e mantém só a edição
            let n = fObj.name
                .replace(/^[^\/]+\//, '')                              // remove pasta "Mulheres em Cibersegurança/"
                .replace(/requerimento.*?certificado[-–\s]*/gi, '')    // remove "Requerimento de Emissão do Certificado –"
                .replace(/\(respostas\)/gi, '')
                .replace(/\bde mulheres em ciberseguran[cç]a\b/gi, '') // "de Mulheres em Ciber"
                .replace(/mulheres em ciberseguran[cç]a/gi, '')
                .replace(/\s{2,}/g, ' ')
                .replace(/^[-–,\s]+|[-–,\s]+$/g, '')
                .trim();
            return 'Mulheres em Ciber';
        }
        // Cyberthon: remove prefixo de pasta (ex: "Cyberthon/"), "CISSA" e formata data
        return fObj.name
            .replace(/^[^\/]+\//, '')       // remove "Cyberthon/" ou qualquer prefixo de pasta
            .replace(/\s*CISSA\s*/gi, ' ')
            .replace(/_(\d{2})_(\d{4})/g, '/$1/$2')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }
    // ────────────────────────────────────────────────────────────────────────
