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
   6. Cole essa URL em config.js -> apiUrl.
   7. Copie o TOKEN abaixo para config.js -> token (devem ser iguais).

   Cada participante ocupa UMA linha (identificada por "id"):
   a 1ª resposta grava a linha e a 2ª completa a mesma linha.

   Colunas: id, criado_em, s1_dono, s1_medio, s1_base,
            s2_dono, s2_medio, s2_base, atualizado_em
   ============================================================ */

var SHEET_NAME = 'Respostas';
var TOKEN = 'b9afda70b857572f59f8775ecdb2a353';

var HEADERS = ['id', 'criado_em', 's1_dono', 's1_medio', 's1_base',
               's2_dono', 's2_medio', 's2_base', 'atualizado_em'];

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
  }
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sh.setFrozenRows(1);
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

function num_(v) { return (v === null || v === undefined) ? '' : Math.round(+v || 0); }

function findRowById_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) { return -1; }
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) { return i + 2; }
  }
  return -1;
}

function handleAdd_(e) {
  try {
    var p = parsePayload_(e);
    if (String(p.token || '') !== TOKEN) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    var id = String(p.id || '').trim();
    if (!id) { return json_({ ok: false, error: 'missing id' }); }

    var s1 = p.s1 || null, s2 = p.s2 || null;
    var sh = getSheet_();
    var now = new Date();
    var row = findRowById_(sh, id);

    var values = [
      id,
      (row > 0 ? (sh.getRange(row, 2).getValue() || now) : now),
      num_(s1 && s1.o), num_(s1 && s1.m), num_(s1 && s1.l),
      num_(s2 && s2.o), num_(s2 && s2.m), num_(s2 && s2.l),
      now
    ];

    if (row > 0) {
      sh.getRange(row, 1, 1, HEADERS.length).setValues([values]);
    } else {
      sh.appendRow(values);
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function blankTier_() { return { o: 0, m: 0, l: 0, ro: 0, rm: 0, rc: 0 }; }

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

function computeStats_() {
  var sh = getSheet_();
  var last = sh.getLastRow();
  var a1 = blankTier_(), a2 = blankTier_(), n1 = 0, n2 = 0;
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      var r = vals[i];
      var hasS1 = r[2] !== '' && r[2] !== null && r[2] !== undefined;
      var hasS2 = r[5] !== '' && r[5] !== null && r[5] !== undefined;
      if (hasS1) { addTier_(a1, +r[2] || 0, +r[3] || 0, +r[4] || 0); n1++; }
      if (hasS2) { addTier_(a2, +r[5] || 0, +r[6] || 0, +r[7] || 0); n2++; }
    }
  }
  return { count: n2, started: n1, s1: reduce_(a1, n1), s2: reduce_(a2, n2) };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
