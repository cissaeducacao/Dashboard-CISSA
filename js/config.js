    Chart.defaults.font.family = "'DM Sans', sans-serif";
    Chart.register(ChartDataLabels);

    // ── Configuração Google / Apps Script Proxy ──────────────────────────────
    const GOOGLE_CLIENT_ID  = '819315504258-c4i38dejmil689b6vl1tt6luqand88j6.apps.googleusercontent.com';
    const GAS_URL           = 'https://script.google.com/macros/s/AKfycbwkwZL-Cl8p_PncymwjkjgS5pxAdShKk9n8i0M2n-VPNucNKgSC2ZyvwZ1SRtXUaCczXg/exec';
    const ALLOWED_DOMAIN    = 'cesar.org.br';
    const LOGIN_SCOPE       = 'openid email profile';      // só identidade — Drive fica no GAS
    let   accessToken       = null;
    let   tokenClient       = null;
    // ────────────────────────────────────────────────────────────────────────

    let uploadedFiles = [];
    let currentScope = 'all';
    let pTypeGlobal = 'unified';
    let currentView = 'geral';
    let charts = {};

    const pieColors = ['#375B95', '#D25600', '#232323', '#888888'];
    const monthNames = {"01":"Janeiro","02":"Fevereiro","03":"Março","04":"Abril","05":"Maio","06":"Junho","07":"Julho","08":"Agosto","09":"Setembro","10":"Outubro","11":"Novembro","12":"Dezembro"};
