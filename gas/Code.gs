// ─────────────────────────────────────────────────────────────────────────────
// CISSA Dashboard — Apps Script Proxy (com suporte a JSONP)
// Deploy como Web App: Execute as "Me" | Acesso "Anyone, even anonymous"
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_DOMAIN  = 'cesar.org.br';
const DRIVE_FOLDER_ID = '12PLMU2UOgLUa_6szkmGW3MYVzshLeG8o';
const ACTIVE_FOLDERS  = ['cyberthon', 'hands on'];

// ── Ponto de entrada ─────────────────────────────────────────────────────────
function doGet(e) {
  const token    = (e.parameter.token    || '').trim();
  const action   = (e.parameter.action   || 'list').trim();
  const fileId   = (e.parameter.fileId   || '').trim();
  const callback = (e.parameter.callback || '').replace(/[^a-zA-Z0-9_]/g, ''); // JSONP

  if (!token) return respond({ error: 'Token ausente' }, callback);

  // Verificar domínio do usuário via userinfo
  try {
    const resp = UrlFetchApp.fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    const user = JSON.parse(resp.getContentText());
    if (!user.email || !user.email.toLowerCase().endsWith('@' + ALLOWED_DOMAIN)) {
      return respond({ error: 'Domínio não autorizado: ' + (user.email || 'desconhecido') }, callback);
    }
  } catch (err) {
    return respond({ error: 'Falha na verificação do token: ' + err.message }, callback);
  }

  if (action === 'list')              return respond(listFiles(),       callback);
  if (action === 'export' && fileId)  return respond(exportFile(fileId), callback);
  return respond({ error: 'Ação inválida' }, callback);
}

// ── Listar arquivos das subpastas ativas ──────────────────────────────────────
function listFiles() {
  const result = [];
  try {
    const root = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const subs = root.getFolders();

    while (subs.hasNext()) {
      const folder    = subs.next();
      const nameLower = folder.getName().toLowerCase();
      if (!ACTIVE_FOLDERS.some(af => nameLower.includes(af))) continue;

      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        const mime = file.getMimeType();
        if (mime === MimeType.GOOGLE_SHEETS ||
            mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          result.push({
            id:       file.getId(),
            name:     folder.getName() + '/' + file.getName(),
            mimeType: mime
          });
        }
      }
    }
  } catch (err) {
    return { error: 'Erro ao listar arquivos: ' + err.message };
  }
  return { files: result };
}

// ── Exportar planilha como base64 (xlsx) ─────────────────────────────────────
function exportFile(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    let blob;

    if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
      const exportUrl = 'https://docs.google.com/spreadsheets/d/' + fileId + '/export?format=xlsx';
      blob = UrlFetchApp.fetch(exportUrl, {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
      }).getBlob();
    } else {
      blob = file.getBlob();
    }

    return { data: Utilities.base64Encode(blob.getBytes()), name: file.getName() };
  } catch (err) {
    return { error: 'Erro ao exportar arquivo: ' + err.message };
  }
}

// ── Helper: resposta JSON ou JSONP ────────────────────────────────────────────
function respond(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
