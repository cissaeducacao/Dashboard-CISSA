    // ── Auth Google ──────────────────────────────────────────────────────────
    function showLoginError(msg) {
        const el = document.getElementById('login-error');
        el.textContent = msg;
        el.style.display = 'block';
        document.getElementById('btn-signin').disabled = false;
        document.getElementById('btn-signin').textContent = 'Entrar com Google';
    }

    function signIn() {
        const btn = document.getElementById('btn-signin');
        btn.disabled = true;
        btn.textContent = 'Aguarde…';
        document.getElementById('login-error').style.display = 'none';
        tokenClient.requestAccessToken({ prompt: 'select_account' });
    }

    // ── Apps Script Proxy (JSONP — evita CORS) ───────────────────────────────
    function gasRequest(params, timeoutMs = 20000) {
        return new Promise((resolve, reject) => {
            const cbName = '_gas_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            const qs = new URLSearchParams({ ...params, token: accessToken, callback: cbName }).toString();

            const script = document.createElement('script');
            let settled = false;

            const cleanup = (noop = false) => {
                settled = true;
                // On timeout keep a no-op so a late GAS response doesn't throw ReferenceError
                if (noop) window[cbName] = () => {};
                else delete window[cbName];
                if (script.parentNode) script.parentNode.removeChild(script);
            };

            const timer = setTimeout(() => {
                if (settled) return;
                cleanup(true);
                reject(new Error('Timeout: o servidor (Apps Script) não respondeu em ' + (timeoutMs/1000) + 's. Verifique se o deploy do GAS está ativo.'));
            }, timeoutMs);

            window[cbName] = (data) => {
                if (settled) return;
                clearTimeout(timer);
                cleanup();
                if (data && data.error) reject(new Error(data.error));
                else resolve(data);
            };

            script.onerror = () => {
                if (settled) return;
                clearTimeout(timer);
                cleanup();
                reject(new Error('Falha ao conectar com o servidor (GAS). Verifique a URL do deploy.'));
            };

            script.src = `${GAS_URL}?${qs}`;
            document.head.appendChild(script);
        });
    }

    // Converte string base64 → ArrayBuffer
    function base64ToBuffer(b64) {
        const bin = atob(b64);
        const buf = new ArrayBuffer(bin.length);
        const u8  = new Uint8Array(buf);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return buf;
    }

    async function loadDriveFiles() {
        document.getElementById('kpi-grid').innerHTML =
            `<div class="kpi-card" style="grid-column:span 3"><span>Status</span>
             <div style="font-size:1.1rem;color:var(--text-muted)">⏳ Carregando dados do Google Drive…</div></div>`;

        try {
            // 1. Listar arquivos via Apps Script
            const { files } = await gasRequest({ action: 'list' });

            if (!files || files.length === 0) {
                document.getElementById('kpi-grid').innerHTML =
                    `<div class="kpi-card" style="grid-column:span 3"><span>Aviso</span>
                     <div style="font-size:1rem;color:var(--text-muted)">Nenhum arquivo encontrado no Google Drive.</div></div>`;
                return;
            }

            // 2. Exportar arquivos via GAS proxy em lotes de 4
            const BATCH = 4;
            for (let i = 0; i < files.length; i += BATCH) {
                const batch = files.slice(i, i + BATCH);
                await Promise.all(batch.map(async ({ id, name }) => {
                    try {
                        const { data } = await gasRequest({ action: 'export', fileId: id }, 120000);
                        const buf = base64ToBuffer(data);
                        processFileBuffer(buf, name);
                    } catch (err) { console.warn('Erro ao processar arquivo:', name, err); }
                }));
            }

            await autoLoadLocalLevantamentos();
            if (uploadedFiles.length > 0) { updateSidebar(); switchScope('all'); }
            else {
                document.getElementById('kpi-grid').innerHTML =
                    `<div class="kpi-card" style="grid-column:span 3"><span>Aviso</span>
                     <div style="font-size:1rem;color:var(--text-muted)">Nenhum dado válido encontrado.</div></div>`;
            }
        } catch (err) {
            console.error(err);
            document.getElementById('kpi-grid').innerHTML =
                `<div class="kpi-card" style="grid-column:span 3"><span>Erro</span>
                 <div style="font-size:1rem;color:var(--text-muted)">Erro ao carregar arquivos: ${err.message}</div></div>`;
        }
    }

    // Inicializa assim que a biblioteca do Google carregar (resolve timing com async)
    window.onGoogleLibraryLoad = function() {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: LOGIN_SCOPE,
            callback: async (tokenResp) => {
                if (tokenResp.error) { showLoginError('Erro na autenticação: ' + tokenResp.error); return; }
                accessToken = tokenResp.access_token;
                try {
                    const infoResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo',
                        { headers: { Authorization: 'Bearer ' + accessToken } });
                    const info = await infoResp.json();
                    if (!info.email || !info.email.endsWith('@' + ALLOWED_DOMAIN)) {
                        google.accounts.oauth2.revoke(accessToken, () => {});
                        accessToken = null;
                        showLoginError(`❌ Acesso negado. Use uma conta @${ALLOWED_DOMAIN}.`);
                        return;
                    }
                    document.getElementById('login-overlay').style.display = 'none';
                    await loadDriveFiles();
                } catch (err) { showLoginError('Erro ao verificar conta: ' + err.message); }
            }
        });
    };

    // Auto-carrega arquivos "Levantamento" locais da pasta do dashboard
    async function autoLoadLocalLevantamentos() {
        try {
            const res = await fetch('.');
            if (!res.ok) return;
            const html = await res.text();
            const doc  = new DOMParser().parseFromString(html, 'text/html');
            const links = [...doc.querySelectorAll('a[href]')]
                .map(a => decodeURIComponent(a.getAttribute('href')))
                .filter(h => /levantamento|alunos.formados/i.test(h) && /\.(csv|xlsx|xls)$/i.test(h));

            const alreadyLoaded = new Set(uploadedFiles.map(f => f.name));
            let loaded = 0;
            for (const filename of links) {
                const displayName = filename.replace(/\.[^/.]+$/, '');
                if (alreadyLoaded.has(displayName)) continue;
                try {
                    const fr = await fetch(encodeURIComponent(filename).replace(/%2F/g, '/'));
                    if (!fr.ok) continue;
                    const buf = await fr.arrayBuffer();
                    processFileBuffer(buf, filename);
                    loaded++;
                } catch(e) { console.warn('Auto-load levantamento:', filename, e); }
            }
            if (loaded > 0) updateSidebar();
        } catch(e) { /* servidor não suporta listagem — ignora */ }
    }
