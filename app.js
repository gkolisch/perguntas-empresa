/* ============================================================
   Folha & Cargos — lógica do experimento
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- Constantes ---------------- */
  var TOTAL = 200000;
  var N_MID = 5;
  var N_LOW = 19;
  var N_TOTAL = 1 + N_MID + N_LOW;

  var DEFAULTS = { o: 62000, m: 20000, l: 2000 };
  var EQUAL = TOTAL / N_TOTAL;

  var LS_RESPONSES = "pe:responses";
  var LS_API = "pe:apiUrl";

  var fmtBRL = new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0
  });
  var fmtInt = new Intl.NumberFormat("pt-BR");

  function fmt(v) { return fmtBRL.format(Math.round(v)); }
  function compact(v) {
    v = Math.round(v);
    if (v >= 1000) {
      var k = v / 1000;
      var txt = (k >= 10 || Math.abs(k - Math.round(k)) < 0.05)
        ? String(Math.round(k))
        : k.toFixed(1).replace(".", ",");
      return "R$ " + txt + "k";
    }
    return "R$ " + fmtInt.format(v);
  }
  function compactLow(v) {
    v = Math.round(v);
    if (v >= 1000) {
      var k = v / 1000;
      return (k >= 10 || Math.abs(k - Math.round(k)) < 0.05)
        ? Math.round(k) + "k"
        : k.toFixed(1).replace(".", ",") + "k";
    }
    return fmtInt.format(v);
  }
  function pct(v) {
    return (v >= 0 ? "+" : "") + v.toFixed(0) + "%";
  }

  /* ---------------- Estado ---------------- */
  var scenarios = {
    s1: { o: DEFAULTS.o, m: DEFAULTS.m, l: DEFAULTS.l },
    s2: { o: DEFAULTS.o, m: DEFAULTS.m, l: DEFAULTS.l }
  };
  var userAnswers = { s1: null, s2: null };
  var uis = {};
  var mounts = {};

  /* ---------------- Matemática da distribuição ----------------
     Invariante: o + 5m + 19l = 200.000  (nunca ultrapassa o máximo)
     Ao mover um slider, os outros dois se reajustam mantendo a
     proporção (forma) da distribuição atual.                     */
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function applyOwner(s, v) {
    v = clamp(v, 0, TOTAL); s.o = v;
    var R = TOTAL - v;
    if (s.m <= 0 && s.l <= 0) { s.m = R / 24; s.l = R / 24; return; }
    if (s.l <= 0) { s.m = R / N_MID; s.l = 0; return; }
    var ratio = s.m / s.l;                 // preserva m : l
    s.l = R / (N_MID * ratio + N_LOW);
    s.m = ratio * s.l;
  }
  function applyMid(s, v) {
    v = clamp(v, 0, TOTAL / N_MID); s.m = v;
    var R = TOTAL - N_MID * v;
    if (s.o <= 0 && s.l <= 0) { s.o = R / 20; s.l = R / 20; return; }
    if (s.l <= 0) { s.o = R; s.l = 0; return; }
    var ratio = s.o / s.l;                 // preserva o : l
    s.l = R / (ratio + N_LOW);
    s.o = ratio * s.l;
  }
  function applyLow(s, v) {
    v = clamp(v, 0, TOTAL / N_LOW); s.l = v;
    var R = TOTAL - N_LOW * v;
    if (s.o <= 0 && s.m <= 0) { s.o = R / 6; s.m = R / 6; return; }
    if (s.m <= 0) { s.o = R; s.m = 0; return; }
    var ratio = s.o / s.m;                 // preserva o : m
    s.m = R / (ratio + N_MID);
    s.o = ratio * s.m;
  }
  var SETTERS = { o: applyOwner, m: applyMid, l: applyLow };

  function snap(s) { return { o: Math.round(s.o), m: Math.round(s.m), l: Math.round(s.l) }; }
  function sum(s) { return s.o + N_MID * s.m + N_LOW * s.l; }

  /* ---------------- UI do cenário ---------------- */
  function nodeOwner() {
    return '<div class="node node-owner" data-tier="o">' +
      '<span class="node-name">Você</span>' +
      '<span class="node-value">—</span></div>';
  }
  function nodes(n, tier, cls) {
    var out = "";
    for (var i = 0; i < n; i++) {
      out += '<div class="node ' + cls + '" data-tier="' + tier + '">' +
        '<span class="node-value">—</span></div>';
    }
    return out;
  }
  function controlHTML(key, tier, label, sub, max, step, min) {
    return '' +
      '<div class="control' + (tier === "o" ? " is-owner" : "") + '">' +
        '<div class="control-top">' +
          '<span class="control-label">' + label + '<small>' + sub + '</small></span>' +
          '<output data-out="' + tier + '">—</output>' +
        '</div>' +
        '<input type="range" data-slider="' + tier + '" data-key="' + key + '"' +
          ' min="' + (min || 0) + '" max="' + max + '" step="' + step + '" value="0"' +
          ' aria-label="' + label + '" />' +
      '</div>';
  }

  function buildScenarioUI(mount, key) {
    mount.innerHTML = '' +
      '<div class="chart-card">' +
        '<div class="org-wrap">' +
          '<div class="org" data-org="' + key + '">' +
            '<svg class="wires" aria-hidden="true"></svg>' +
            '<div class="org-row row-owner">' + nodeOwner() + '</div>' +
            '<div class="org-row row-mid">' + nodes(N_MID, "m", "node-mid") + '</div>' +
            '<div class="org-row row-low">' + nodes(N_LOW, "l", "node-low") + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="controls-card">' +
        controlHTML(key, "o", "Você (dono)", "1 pessoa · topo do organograma", TOTAL, 100) +
        controlHTML(key, "m", "Funcionários do meio", N_MID + " pessoas · 2ª fileira", Math.round(TOTAL / N_MID), 100) +
        controlHTML(key, "l", "Funcionários da base", N_LOW + " pessoas · fileira de baixo", 10500, 50) +
        '<div class="presets">' +
          '<button type="button" class="preset" data-preset="default">Padrão</button>' +
          '<button type="button" class="preset" data-preset="equal">Média (todos iguais)</button>' +
        '</div>' +
        '<div class="chips">' +
          '<div class="chip"><span class="chip-k">Total alocado</span><span class="chip-v" data-chip="total">—</span></div>' +
          '<div class="chip"><span class="chip-k">Média por pessoa</span><span class="chip-v" data-chip="avg">—</span></div>' +
          '<div class="chip"><span class="chip-k">Dono ÷ base</span><span class="chip-v accent" data-chip="ratio">—</span></div>' +
        '</div>' +
      '</div>';

    var org = mount.querySelector('[data-org="' + key + '"]');
    var ui = {
      org: org,
      ownerVal: org.querySelector('.node-owner .node-value'),
      midVals: Array.prototype.slice.call(org.querySelectorAll('.node-mid .node-value')),
      lowVals: Array.prototype.slice.call(org.querySelectorAll('.node-low .node-value')),
      sliders: {},
      outs: {},
      presetDefault: mount.querySelector('[data-preset="default"]'),
      presetEqual: mount.querySelector('[data-preset="equal"]'),
      chip: {
        total: mount.querySelector('[data-chip="total"]'),
        avg: mount.querySelector('[data-chip="avg"]'),
        ratio: mount.querySelector('[data-chip="ratio"]')
      }
    };
    ["o", "m", "l"].forEach(function (t) {
      ui.sliders[t] = mount.querySelector('[data-slider="' + t + '"]');
      ui.outs[t] = mount.querySelector('[data-out="' + t + '"]');
    });

    ["o", "m", "l"].forEach(function (t) {
      ui.sliders[t].addEventListener("input", function () {
        SETTERS[t](scenarios[key], parseFloat(this.value));
        updateScenario(key, t);
      });
    });
    ui.presetDefault.addEventListener("click", function () {
      scenarios[key] = { o: DEFAULTS.o, m: DEFAULTS.m, l: DEFAULTS.l };
      updateScenario(key, null, true);
    });
    ui.presetEqual.addEventListener("click", function () {
      scenarios[key] = { o: EQUAL, m: EQUAL, l: EQUAL };
      updateScenario(key, null, true);
    });

    uis[key] = ui;
  }

  function setFill(input) {
    var min = parseFloat(input.min), max = parseFloat(input.max), val = parseFloat(input.value);
    var p = max > min ? ((val - min) / (max - min)) * 100 : 0;
    input.style.setProperty("--p", p.toFixed(2) + "%");
  }

  function flashNodes(org) {
    var nodesEl = org.querySelectorAll(".node");
    for (var i = 0; i < nodesEl.length; i++) {
      (function (n) {
        n.classList.remove("flash");
        void n.offsetWidth;
        n.classList.add("flash");
      })(nodesEl[i]);
    }
  }

  function updateScenario(key, changed, animate) {
    var s = scenarios[key];
    var ui = uis[key];

    ui.ownerVal.textContent = compact(s.o);
    ui.midVals.forEach(function (n) { n.textContent = compact(s.m); });
    ui.lowVals.forEach(function (n) { n.textContent = compactLow(s.l); });

    ui.sliders.o.value = Math.round(s.o);
    ui.sliders.m.value = Math.round(s.m);
    ui.sliders.l.value = Math.round(s.l);
    ["o", "m", "l"].forEach(function (t) { setFill(ui.sliders[t]); });

    ui.outs.o.textContent = fmt(s.o);
    ui.outs.m.textContent = fmt(s.m);
    ui.outs.l.textContent = fmt(s.l);

    ui.chip.total.textContent = fmt(sum(s));
    ui.chip.avg.textContent = fmt(sum(s) / N_TOTAL);
    if (s.l > 0.5) {
      ui.chip.ratio.textContent = (s.o / s.l).toFixed(1).replace(".", ",") + "×";
    } else {
      ui.chip.ratio.textContent = "—";
    }

    var isDefault = Math.round(s.o) === DEFAULTS.o && Math.round(s.m) === DEFAULTS.m && Math.round(s.l) === DEFAULTS.l;
    var isEqual = Math.abs(s.o - s.m) < 1 && Math.abs(s.m - s.l) < 1;
    ui.presetDefault.classList.toggle("is-on", isDefault);
    ui.presetEqual.classList.toggle("is-on", isEqual);

    if (animate) { flashNodes(ui.org); }
  }

  /* ---------------- Fios do organograma ---------------- */
  function wireLine(x1, y1, x2, y2) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
  }
  function drawWires(key) {
    var ui = uis[key];
    if (!ui || !ui.org || !ui.org.offsetParent) { return; }
    var svg = ui.org.querySelector(".wires");
    var orgRect = ui.org.getBoundingClientRect();
    var W = ui.org.clientWidth, H = ui.org.clientHeight;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);

    function box(el) {
      var r = el.getBoundingClientRect();
      return {
        x: r.left - orgRect.left + r.width / 2,
        top: r.top - orgRect.top,
        bottom: r.bottom - orgRect.top
      };
    }
    var owner = box(ui.org.querySelector(".node-owner"));
    var mids = Array.prototype.map.call(ui.org.querySelectorAll(".node-mid"), box);
    var lows = Array.prototype.map.call(ui.org.querySelectorAll(".node-low"), box);
    if (!mids.length || !lows.length) { return; }

    var out = [];
    var midTop = Math.min.apply(null, mids.map(function (m) { return m.top; }));
    var bus1 = owner.bottom + (midTop - owner.bottom) * 0.5;
    var midXs = mids.map(function (m) { return m.x; });
    var minMidX = Math.min.apply(null, midXs), maxMidX = Math.max.apply(null, midXs);
    out.push(wireLine(owner.x, owner.bottom, owner.x, bus1));
    out.push(wireLine(minMidX, bus1, maxMidX, bus1));
    mids.forEach(function (m) { out.push(wireLine(m.x, bus1, m.x, m.top)); });

    var midBottom = Math.max.apply(null, mids.map(function (m) { return m.bottom; }));
    var lowTop = Math.min.apply(null, lows.map(function (l) { return l.top; }));
    var bus2 = midBottom + (lowTop - midBottom) * 0.5;
    var lowXs = lows.map(function (l) { return l.x; });
    var minLowX = Math.min.apply(null, lowXs), maxLowX = Math.max.apply(null, lowXs);
    mids.forEach(function (m) { out.push(wireLine(m.x, m.bottom, m.x, bus2)); });
    out.push(wireLine(minLowX, bus2, maxLowX, bus2));
    lows.forEach(function (l) { out.push(wireLine(l.x, bus2, l.x, l.top)); });

    svg.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="1.5">' + out.join("") + '</g>';
  }

  /* ---------------- Navegação ---------------- */
  function goTo(n) {
    var sections = document.querySelectorAll(".screen");
    for (var i = 0; i < sections.length; i++) {
      var active = parseInt(sections[i].dataset.screen, 10) === n;
      sections[i].classList.toggle("is-active", active);
      sections[i].hidden = !active;
    }
    var steps = document.querySelectorAll(".step");
    for (var j = 0; j < steps.length; j++) {
      var num = parseInt(steps[j].dataset.step, 10);
      steps[j].classList.toggle("is-active", num === n);
      steps[j].classList.toggle("is-done", num < n);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (n === 1) { requestAnimationFrame(function () { drawWires("s1"); }); }
    if (n === 2) { requestAnimationFrame(function () { drawWires("s2"); }); }
  }

  /* ---------------- Armazenamento ---------------- */
  function apiUrl() {
    var q = new URLSearchParams(window.location.search).get("api");
    if (q) { try { localStorage.setItem(LS_API, q); } catch (e) {} return q; }
    var cfg = (window.APP_CONFIG && window.APP_CONFIG.apiUrl) || "";
    if (cfg) { return cfg; }
    try { return localStorage.getItem(LS_API) || ""; } catch (e) { return ""; }
  }
  function withParam(url, qs) { return url + (url.indexOf("?") >= 0 ? "&" : "?") + qs; }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LS_RESPONSES) || "[]") || []; }
    catch (e) { return []; }
  }
  function saveLocal(payload) {
    try {
      var arr = readLocal();
      arr.push(payload);
      localStorage.setItem(LS_RESPONSES, JSON.stringify(arr));
    } catch (e) {}
  }

  function setStatus(text, cls) {
    var el = document.getElementById("foot-status");
    if (!el) { return; }
    el.textContent = text || "";
    el.className = "foot-status" + (cls ? " " + cls : "");
  }

  function snapshot() {
    return { s1: snap(scenarios.s1), s2: snap(scenarios.s2), ts: Date.now() };
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function onSubmit() {
    var url = apiUrl();
    var payload = snapshot();
    userAnswers.s1 = payload.s1;
    userAnswers.s2 = payload.s2;
    saveLocal(payload);

    goTo(3);
    loadResults();

    if (url) {
      setStatus("Enviando para o servidor…", "");
      fetch(withParam(url, "action=add&data=" + encodeURIComponent(JSON.stringify(payload)) + "&t=" + Date.now()),
        { mode: "no-cors", cache: "no-store" })
        .then(function () { setStatus("Resposta enviada.", "ok"); })
        .catch(function () { setStatus("Salvo neste navegador (servidor indisponível).", ""); });
    } else {
      setStatus("Salvo neste navegador (modo local).", "");
    }
  }

  /* ---------------- Estatísticas coletivas ---------------- */
  function computeStats(arr) {
    var acc = {
      s1: { o: 0, m: 0, l: 0, srO: 0, srM: 0, rn: 0 },
      s2: { o: 0, m: 0, l: 0, srO: 0, srM: 0, rn: 0 }
    };
    var n = arr.length;
    arr.forEach(function (rec) {
      ["s1", "s2"].forEach(function (k) {
        var v = rec[k] || {};
        var o = +v.o || 0, m = +v.m || 0, l = +v.l || 0;
        var a = acc[k];
        a.o += o; a.m += m; a.l += l;
        if (l > 0) { a.srO += o / l; a.srM += m / l; a.rn++; }
      });
    });
    var out = { count: n, s1: {}, s2: {} };
    ["s1", "s2"].forEach(function (k) {
      var a = acc[k];
      out[k] = {
        o: n ? a.o / n : 0,
        m: n ? a.m / n : 0,
        l: n ? a.l / n : 0,
        ratioTopBase: a.rn ? a.srO / a.rn : 0,
        ratioMidBase: a.rn ? a.srM / a.rn : 0
      };
    });
    return out;
  }
  function localStats() { return computeStats(readLocal()); }

  function barRow(label, value, max, variant) {
    var w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
    return '' +
      '<div class="bar-row">' +
        '<div class="bar-top"><span class="k">' + label + '</span><span class="v">' + fmt(value) + '</span></div>' +
        '<div class="bar-track"><span class="bar-fill ' + (variant || "") + '" data-w="' + w + '"></span></div>' +
      '</div>';
  }

  function scenarioCard(stats, key, title, sub) {
    var max = Math.max(stats.o, stats.m, stats.l, 1);
    return '' +
      '<div class="res-card">' +
        '<h3>' + title + '</h3>' +
        '<p class="res-sub">' + sub + '</p>' +
        '<div class="bars">' +
          barRow("Dono", stats.o, max, "") +
          barRow("Funcionários do meio", stats.m, max, "mint") +
          barRow("Funcionários da base", stats.l, max, "mint") +
        '</div>' +
        '<div class="ratio-line">' +
          '<span class="k">Fator dono ÷ base</span>' +
          '<span class="v">' + (stats.ratioTopBase ? stats.ratioTopBase.toFixed(1).replace(".", ",") + "×" : "—") + '</span>' +
        '</div>' +
      '</div>';
  }

  function compareTable(you, avg, title) {
    var tiers = [
      { k: "Dono (Você)", sub: "1 pessoa", y: you.o, a: avg.o },
      { k: "Funcionários do meio", sub: N_MID + " pessoas", y: you.m, a: avg.m },
      { k: "Funcionários da base", sub: N_LOW + " pessoas", y: you.l, a: avg.l }
    ];
    var rows = tiers.map(function (t) {
      var d = t.a > 0 ? ((t.y - t.a) / t.a) * 100 : 0;
      var flat = Math.abs(d) < 2;
      var cls = flat ? "flat" : (d > 0 ? "up" : "down");
      var label = flat ? "0%" : pct(d);
      return '<tr>' +
        '<td class="tier">' + t.k + '<small>' + t.sub + '</small></td>' +
        '<td class="you">' + fmt(t.y) + '</td>' +
        '<td>' + fmt(t.a) + '</td>' +
        '<td class="delta ' + cls + '">' + label + '</td>' +
      '</tr>';
    }).join("");
    return '' +
      '<div class="compare-card">' +
        '<h3 style="margin:0 0 4px;font-family:var(--font-display);font-size:20px">' + title + '</h3>' +
        '<p class="section-note" style="margin-bottom:10px">Sua resposta comparada com a média de quem já respondeu.</p>' +
        '<table class="compare">' +
          '<thead><tr><th>Nível</th><th>Você</th><th>Média</th><th>Diferença</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>';
  }

  function renderResults(box, stats) {
    var n = stats.count;
    var s1 = stats.s1, s2 = stats.s2;
    var html = "";

    html += '<div class="hero-stat">' +
      '<div class="hero-num">' + fmtInt.format(n) + '</div>' +
      '<div class="hero-label">' + (n === 1 ? "pessoa já respondeu" : "pessoas já responderam") +
      ' as duas perguntas. <b>Os valores abaixo são médias</b> de todas as respostas.</div>' +
      '</div>';

    html += '<h2 class="section-title">Salários médios nas duas situações</h2>';
    html += '<div class="res-grid">' +
      scenarioCard(s1, "s1", "Cenário 1 · Você é o dono", "Como as pessoas distribuem quando mandam na folha.") +
      scenarioCard(s2, "s2", "Cenário 2 · Você é a base", "Como as pessoas distribuem quando são o funcionário mais baixo.") +
      '</div>';

    html += '<div class="insight">' +
      'Fator de diferença média entre o topo e a base: <b>' +
      (s1.ratioTopBase ? s1.ratioTopBase.toFixed(1).replace(".", ",") + "×" : "—") +
      '</b> no cenário 1 e <b>' +
      (s2.ratioTopBase ? s2.ratioTopBase.toFixed(1).replace(".", ",") + "×" : "—") +
      '</b> no cenário 2. ' +
      (s1.ratioTopBase && s2.ratioTopBase
        ? (s2.ratioTopBase < s1.ratioTopBase
          ? "Quando a pessoa está na base, a concentração no topo cai em média."
          : "As respostas quase não mudam quando a pessoa está na base.")
        : "Ainda há poucas respostas para comparar.") +
      '</div>';

    if (userAnswers.s1 && userAnswers.s2) {
      html += '<h2 class="section-title">Sua distribuição × média geral</h2>';
      html += '<p class="section-note">Veja o quanto você se afastou (ou não) do que o grupo respondeu. Diferenças abaixo de 2% aparecem como “0%”.</p>';
      html += compareTable(userAnswers.s1, s1, "Cenário 1 · Você é o dono");
      html += compareTable(userAnswers.s2, s2, "Cenário 2 · Você é a base");
      html += '<div class="legend">' +
        '<span><i class="sw-you"></i> Sua resposta</span>' +
        '<span><i class="sw-avg"></i> Média do grupo</span>' +
      '</div>';
    }

    box.innerHTML = html;

    requestAnimationFrame(function () {
      Array.prototype.forEach.call(box.querySelectorAll(".bar-fill"), function (el) {
        el.style.width = el.dataset.w + "%";
      });
    });
  }

  function loadResults() {
    var box = document.getElementById("results");
    box.innerHTML = '<div class="loader"><span></span><span></span><span></span></div>';
    var url = apiUrl();

    if (!url) { renderResults(box, localStats()); return; }

    delay(900).then(function () {
      return fetch(withParam(url, "action=stats&t=" + Date.now()), { cache: "no-store" });
    })
      .then(function (r) { if (!r.ok) { throw new Error("http " + r.status); } return r.json(); })
      .then(function (data) {
        if (data && typeof data.count === "number" && data.count > 0) { renderResults(box, data); }
        else { renderResults(box, localStats()); }
      })
      .catch(function () {
        setStatus("Servidor indisponível — mostrando respostas locais.", "");
        renderResults(box, localStats());
      });
  }

  /* ---------------- Init ---------------- */
  function debounce(fn, ms) {
    var t; return function () {
      clearTimeout(t); t = setTimeout(fn, ms);
    };
  }

  function init() {
    mounts.s1 = document.querySelector('[data-scenario="s1"]');
    mounts.s2 = document.querySelector('[data-scenario="s2"]');
    buildScenarioUI(mounts.s1, "s1");
    buildScenarioUI(mounts.s2, "s2");
    updateScenario("s1");
    updateScenario("s2");

    Array.prototype.forEach.call(document.querySelectorAll("[data-action]"), function (btn) {
      btn.addEventListener("click", function () {
        var action = btn.dataset.action;
        if (action === "next") {
          var from = btn.dataset.from;
          if (from === "1") { userAnswers.s1 = snap(scenarios.s1); goTo(2); }
          else { onSubmit(); }
        } else if (action === "back") {
          if (btn.dataset.to === "1") { goTo(1); }
        }
      });
    });

    var redraw = debounce(function () { drawWires("s1"); drawWires("s2"); }, 120);
    window.addEventListener("resize", redraw);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { drawWires("s1"); });
    }

    setStatus(apiUrl() ? "Conectado ao servidor." : "Modo local — configure a URL do Apps Script para somar respostas.", apiUrl() ? "ok" : "");
    goTo(1);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
