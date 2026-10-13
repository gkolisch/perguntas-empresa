/* ============================================================
   Folha & Cargos — backend de respostas (Google Apps Script)
   ------------------------------------------------------------
   COMO PUBLICAR (5 minutos, conta Google gratuita):

   1. Crie uma planilha em https://sheets.new
   2. Menu: Extensões > Apps Script
   3. Apague o conteúdo e cole TODO este arquivo. Salve.
   4. Clique em "Implantar" > "Nova implantação"
        - Tipo: "App da Web"
        - Executar como: Eu
        - Quem pode acessar: Qualquer pessoa
      Clique em "Implantar" e autorize.
   5. Copie a URL do App da Web (termina em /exec).
   6. Cole essa URL em config.js -> apiUrl  (ou abra o site com
      ?api=SUA_URL para testar).

   Cada resposta vira uma linha na aba "Respostas".
   As colunas são: timestamp, s1_dono, s1_medio, s1_base,
   s2_dono, s2_medio, s2_base.
   ============================================================ */

var SHEET_NAME = 'Respostas';

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'stats';
  if (action === 'add') { return handleAdd_(e); }
  return json_(computeStats_());
}

function doPost(e) {
  return handleAdd_(e);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Vincule este script a uma planilha (Extensoes > Apps Script).');
  }
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['timestamp', 's1_dono', 's1_medio', 's1_base', 's2_dono', 's2_medio', 's2_base']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function parsePayload_(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) {}
  }
  if (e && e.parameter && e.parameter.data) {
    try { return JSON.parse(e.parameter.data); } catch (err) {}
  }
  return {};
}

function handleAdd_(e) {
  try {
    var p = parsePayload_(e);
    var s1 = p.s1 || {}, s2 = p.s2 || {};
    getSheet_().appendRow([
      new Date(),
      Math.round(+s1.o || 0), Math.round(+s1.m || 0), Math.round(+s1.l || 0),
      Math.round(+s2.o || 0), Math.round(+s2.m || 0), Math.round(+s2.l || 0)
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function computeStats_() {
  var values = getSheet_().getDataRange().getValues();
  var acc = {
    n: 0,
    s1: { o: 0, m: 0, l: 0, ro: 0, rm: 0, rc: 0 },
    s2: { o: 0, m: 0, l: 0, ro: 0, rm: 0, rc: 0 }
  };
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (r[1] === '' || r[1] === null || r[1] === undefined) { continue; }
    acc.n++;
    addTier_(acc.s1, +r[1] || 0, +r[2] || 0, +r[3] || 0);
    addTier_(acc.s2, +r[4] || 0, +r[5] || 0, +r[6] || 0);
  }
  return { count: acc.n, s1: reduce_(acc.s1, acc.n), s2: reduce_(acc.s2, acc.n) };
}

function addTier_(a, o, m, l) {
  a.o += o; a.m += m; a.l += l;
  if (l > 0) { a.ro += o / l; a.rm += m / l; a.rc++; }
}

function reduce_(a, n) {
  return {
    o: n ? a.o / n : 0,
    m: n ? a.m / n : 0,
    l: n ? a.l / n : 0,
    ratioTopBase: a.rc ? a.ro / a.rc : 0,
    ratioMidBase: a.rc ? a.rm / a.rc : 0
  };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
