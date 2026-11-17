// Ashfall — créateur de build.
// Données : window.ASHFALL_BUILDER, exportées par le jeu (tools/builder_dump.gd → tools/site_builder.mjs) dans la langue
// de la page ; textes de l'interface : window.ASHFALL_UI[langue].builder (tools/site_i18n/<langue>.json).
// Builds enregistrés dans le navigateur (localStorage « ashfall-builds »), partage par code ou lien (#b=…).
(function () {
  'use strict';
  var D = window.ASHFALL_BUILDER;
  var host = document.getElementById('bd');
  if (!D || !host) return;
  var LANG = document.documentElement.lang || 'fr';
  var ROOT = document.documentElement.getAttribute('data-root') || '';
  var UI_ALL = window.ASHFALL_UI || {};
  var T = ((UI_ALL[LANG] || UI_ALL.fr || {}).builder) || {};
  var R = D.rules, LB = D.labels;

  // ───────────────────────────── outils ─────────────────────────────
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var F = function (s, o) { return String(s || '').replace(/\{(\w+)\}/g, function (_m, k) { return o && o[k] != null ? o[k] : ''; }); };
  var num = function (v) {
    var r = Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1);
    return LANG === 'fr' ? r.replace('.', ',') : r;
  };
  var num2 = function (v) { var r = String(Math.round(v * 100) / 100); return LANG === 'fr' ? r.replace('.', ',') : r; };
  var img = function (p, cls) { return p ? '<img class="' + (cls || '') + '" src="' + esc(ROOT + p) + '" alt="" loading="lazy">' : ''; };
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function statText(stat, val) {
    var tpl = LB.stats[stat];
    if (!tpl) return stat + ' ' + num(val);
    var t = String(tpl);
    if (val < 0) t = t.split('+{v}').join('{v}');
    return t.split('{v}').join(num(val)).replace('+-', '-').replace('−-', '-');
  }
  function toast(msg) {
    var t = h('div', 'bd-toast', esc(msg));
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2200);
    setTimeout(function () { t.remove(); }, 2700);
  }

  // Infobulles : survol seulement (le clic reste aux actions)
  var tipEl = document.getElementById('kx-tip');
  function placeTip(x, y) {
    tipEl.style.left = '0px'; tipEl.style.top = '0px';
    var r = tipEl.getBoundingClientRect();
    var px = x + 18, py = y + 16;
    if (px + r.width > window.innerWidth - 12) px = x - r.width - 18;
    if (py + r.height > window.innerHeight - 12) py = Math.max(12, window.innerHeight - r.height - 12);
    tipEl.style.left = Math.round(Math.max(12, px)) + 'px'; tipEl.style.top = Math.round(py) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; }
  function tip(el, html) {
    if (!tipEl || !html) return el;
    el._tip = html;
    el.addEventListener('mouseenter', function (ev) { tipEl.innerHTML = el._tip; tipEl.hidden = false; placeTip(ev.clientX, ev.clientY); });
    el.addEventListener('mousemove', function (ev) { if (!tipEl.hidden) placeTip(ev.clientX, ev.clientY); });
    el.addEventListener('mouseleave', hideTip);
    return el;
  }
  window.addEventListener('scroll', hideTip, { passive: true });

  // ───────────────────────────── index des données ─────────────────────────────
  var byId = function (arr) { var o = {}; arr.forEach(function (x) { o[x.id] = x; }); return o; };
  var SK = byId(D.skills), SP = byId(D.supports), CL = byId(D.classes), TR = byId(D.talents.trees), LEG = byId(D.items.legendaries);
  var WEAP = byId(D.items.weapons), SHIELD = byId(D.items.shields), ARM = {};
  Object.keys(D.items.armor).forEach(function (s) { ARM[s] = byId(D.items.armor[s]); });
  var NODE_TREE = {};
  D.talents.trees.forEach(function (t) { t.nodes.forEach(function (n) { NODE_TREE[n.id] = t; }); });
  var ATLAS = D.atlas.nodes;
  var PLANETS = byId(D.space.planets);
  var SLOTS = ['helm', 'amulet', 'weapon', 'chest', 'offhand', 'gloves', 'belt', 'ring1', 'boots', 'ring2'];
  var slotKey = function (s) { return s === 'ring1' || s === 'ring2' ? 'ring' : s; };
  var slotName = function (s) { return LB.slots[s] || s; };

  // ───────────────────────────── builds ─────────────────────────────
  var KEY = 'ashfall-builds';
  function blank(cls) {
    return { v: 1, cls: cls || D.classes[0].id, level: 60, asc: [], talents: { trees: [], alloc: {}, cores: {} },
      bar: [null, null, null, null, null], supp: [[], [], [], [], []], auras: [null, null, null, null], auraSupp: [[], [], [], []],
      runes: [null, null, null, null], gear: {}, atlas: [], solar: { slots: [null, null, null] }, notes: '' };
  }
  function fix(b) {
    var z = blank(b && b.cls);
    Object.keys(z).forEach(function (k) { if (b[k] == null) b[k] = z[k]; });
    if (!CL[b.cls]) b.cls = D.classes[0].id;
    b.level = Math.max(1, Math.min(R.maxLevel, parseInt(b.level, 10) || 1));
    return b;
  }
  var store;
  try { store = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { store = null; }
  if (!store || !Array.isArray(store.builds)) store = { builds: [], cur: null };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  function curEntry() { return store.builds.filter(function (x) { return x.id === store.cur; })[0]; }
  function newEntry(name, data) {
    var e = { id: uid(), name: name || T.defaultName, updated: Date.now(), data: fix(data || blank()) };
    store.builds.unshift(e); store.cur = e.id; persist(); return e;
  }
  var temp = null;       // build chargé par lien, pas encore enregistré
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  var saveTimer = null;
  function changed() {
    if (temp) return renderAll();
    var e = curEntry(); if (e) e.updated = Date.now();
    clearTimeout(saveTimer); saveTimer = setTimeout(persist, 250);
    renderAll();
  }
  if (!store.builds.length) newEntry(T.defaultName);
  if (!curEntry()) store.cur = store.builds[0].id;
  var B = function () { return temp ? temp.data : curEntry().data; };

  // Code de build : JSON compressé (deflate-raw) en base64url, préfixe « z » ; repli « j » sans compression.
  function b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = atob(t), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function streamBytes(bytes, tr) { return new Response(new Blob([bytes]).stream().pipeThrough(tr)).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function encode(entry) {
    var bytes = new TextEncoder().encode(JSON.stringify({ n: entry.name, d: entry.data }));
    if (window.CompressionStream) return streamBytes(bytes, new CompressionStream('deflate-raw')).then(function (z) { return 'z' + b64(z); });
    return Promise.resolve('j' + b64(bytes));
  }
  function decode(code) {
    code = String(code || '').trim();
    var m = code.match(/#b=([A-Za-z0-9_-]+)/); if (m) code = m[1];
    try {
      var kind = code[0], bytes = unb64(code.slice(1));
      var p = kind === 'z' ? streamBytes(bytes, new DecompressionStream('deflate-raw')) : Promise.resolve(bytes);
      return p.then(function (b) { var o = JSON.parse(new TextDecoder().decode(b)); if (!o || !o.d) throw 0; return { name: o.n || T.defaultName, data: fix(o.d) }; });
    } catch (e) { return Promise.reject(e); }
  }

  // ───────────────────────────── règles ─────────────────────────────
  var gemLv = function (b) { return R.gemCap[Math.min(R.gemCap.length, b.level) - 1]; };
  var talentPts = function (b) { return Math.max(0, b.level - 1); };
  var ascPts = function (b) { return R.ascLevels.filter(function (l) { return b.level >= l; }).length; };
  var spentTalents = function (b) { var t = 0; Object.keys(b.talents.alloc).forEach(function (k) { t += b.talents.alloc[k] || 0; }); return t; };
  function treePts(b, tid) { var t = 0; (TR[tid] ? TR[tid].nodes : []).forEach(function (n) { t += b.talents.alloc[n.id] || 0; }); return t; }
  function colNeed(tree, c) { var thr = tree.thresholds || [0, 3, 6, 9, 12, 15]; return c < thr.length ? (thr[c] || 0) : (thr[thr.length - 1] || 0) + 3 * (c - thr.length + 1); }
  function nodeOf(tree, id) { return tree.nodes.filter(function (n) { return n.id === id; })[0]; }
  function canAlloc(b, tree, n) {
    var a = b.talents.alloc;
    if (spentTalents(b) >= talentPts(b)) return false;
    if ((a[n.id] || 0) >= n.max) return false;
    if (treePts(b, tree.id) < colNeed(tree, n.col)) return false;
    if (n.req) { var rq = nodeOf(tree, n.req); if (rq && (a[n.req] || 0) < rq.max) return false; }
    return true;
  }
  function canRefund(b, tree, n) {
    var a = b.talents.alloc, rank = a[n.id] || 0;
    if (rank <= 0) return false;
    if (tree.nodes.some(function (o) { return o.req === n.id && (a[o.id] || 0) > 0; })) return false;
    var tp = treePts(b, tree.id) - 1;
    return tree.nodes.every(function (o) { var r = o.id === n.id ? rank - 1 : (a[o.id] || 0); return r <= 0 || tp >= colNeed(tree, o.col); });
  }
  function treeOpen(b, i) { return i === 0 || (b.talents.trees[i - 1] && treePts(b, b.talents.trees[i - 1]) >= R.treeUnlock); }

  // Arbre de classe : départ dès le niveau du passif, sinon lié à un nœud pris ; retrait si le reste reste relié.
  function clsNode(c, id) { return c.tree.filter(function (n) { return n.id === id; })[0]; }
  function ascCan(b, c, n) {
    if (b.asc.indexOf(n.id) >= 0 || b.asc.length >= ascPts(b)) return false;
    if (n.start) return b.level >= ((c.passive || {}).level || 5);
    return n.links.some(function (l) { return b.asc.indexOf(l) >= 0; });
  }
  function ascConnected(c, taken) {
    var ok = {}, changedF = true;
    while (changedF) {
      changedF = false;
      taken.forEach(function (id) {
        if (ok[id]) return;
        var n = clsNode(c, id); if (!n) return;
        if (n.start || n.links.some(function (l) { return ok[l]; })) { ok[id] = true; changedF = true; }
      });
    }
    return taken.every(function (id) { return ok[id]; });
  }
  // Arbre des Terres : relié au départ par des nœuds alloués.
  function atlasReach(alloc, target) {
    var seen = {}, q = ['start'];
    while (q.length) {
      var cur = q.shift(); if (seen[cur]) continue; seen[cur] = true;
      if (cur === target) return true;
      if (cur === 'start' || alloc.indexOf(cur) >= 0) ((ATLAS[cur] || {}).links || []).forEach(function (l) { if (!seen[l]) q.push(l); });
    }
    return false;
  }

  // Objets
  function baseOf(slot, id) {
    if (slot === 'weapon') return WEAP[id];
    if (slot === 'offhand') return SHIELD[id] || WEAP[id];
    return (ARM[slotKey(slot)] || {})[id];
  }
  function isWeaponBase(base) { return base && base.aps != null; }
  function poolKey(slot, base) {
    if (isWeaponBase(base)) return R.minionKinds.indexOf(base.kind) >= 0 ? 'weapon_minion' : 'weapon';
    return slotKey(slot);
  }
  function tierMinIlvl(tiers, gi) {
    var n = tiers.length - gi, lv = tiers[gi][0];
    R.tierCapLv.forEach(function (c) { if (n < c[1]) lv = Math.max(lv, c[0]); });
    return lv;
  }
  function tierOk(tiers, gi, il) { return il >= tierMinIlvl(tiers, gi); }
  function bestTier(tiers, il) { for (var gi = tiers.length - 1; gi >= 0; gi--) if (tierOk(tiers, gi, il)) return tiers.length - gi; return 0; }
  function tierColor(t) {
    var C = R.tierColors, n = C.length - 1, x = Math.max(0, Math.min(1, (t - 1) / n)) * n, i = Math.floor(x), f = x - i;
    var a = C[i], c = C[Math.min(i + 1, n)];
    var mix = function (k) { return Math.round(parseInt(a.substr(k, 2), 16) * (1 - f) + parseInt(c.substr(k, 2), 16) * f); };
    return 'rgb(' + mix(1) + ',' + mix(3) + ',' + mix(5) + ')';
  }
  var energyMax = function (il) { for (var i = 0; i < R.energyBrackets.length; i++) if (il >= R.energyBrackets[i][0]) return R.energyBrackets[i][1]; return 0; };
  function affixDef(slot, base, stat) { return (D.items.pools[poolKey(slot, base)] || []).filter(function (a) { return a.stat === stat; })[0]; }
  // Statistiques d'un objet planifié : implicite, énergie, affixes, corruption, glitch, légendaire.
  function itemInfo(slot, it) {
    if (!it) return null;
    var st = {}, add = function (k, v) { if (v) st[k] = (st[k] || 0) + v; };
    var info = { stats: st, flags: [], dmg: null, req: 1, name: '', color: R.rarityColors[it.r] || '#d8d8d8', type: '', icon: null, base: null };
    if (it.r === 'legendary') {
      var L = LEG[it.l]; if (!L) return null;
      info.name = L.name; info.req = L.req; info.color = R.rarityColors.legendary; info.icon = L.icon; info.leg = L;
      Object.keys(L.implicit || {}).forEach(function (k) { add(k, L.implicit[k]); });
      (L.stats || []).forEach(function (s) { add(s.stat, s.val); });
      info.flags = L.flags || [];
      if (L.kind) { info.dmg = [L.wMin, L.wMax, L.aps]; info.kind = L.kind; }
      info.type = L.kind ? (LB.kinds[L.kind] || '') : slotName(slotKey(L.slot));
    } else {
      var b = baseOf(slot, it.b); if (!b) return null;
      var il = it.il || 1;
      info.base = b; info.icon = b.icon; info.req = Math.max(b.req, Math.max(1, Math.floor(il * 0.75)));
      if (isWeaponBase(b)) {
        if (b.implStat) add(b.implStat, Math.max(b.implBase, Math.floor(b.implBase + il * b.implScale)));
        var dm = Math.max(1, Math.floor(b.d + b.s * il)); info.dmg = [dm, dm, b.aps]; info.kind = b.kind;
        info.type = LB.kinds[b.kind] || '';
      } else {
        Object.keys(b.implicit || {}).forEach(function (k) { add(k, b.implicit[k]); });
        info.type = b.kind === 'shield' ? (LB.kinds.shield || '') : slotName(slotKey(slot));
        if (b.kind === 'shield') info.kind = 'shield';
      }
      if (it.e) add('energyMax', it.e);
      (it.a || []).forEach(function (a) { add(a.s, a.v); });
      if (it.r === 'glitched' && it.g) add(it.g.s, it.g.v);
      var pre = (it.a || []).filter(function (a) { var d = affixDef(slot, b, a.s); return d && d.isP; })[0];
      var suf = (it.a || []).filter(function (a) { var d = affixDef(slot, b, a.s); return d && !d.isP; })[0];
      if (it.r === 'normal') info.name = b.name;
      else if (it.r === 'magic') info.name = [pre && affixDef(slot, b, pre.s).name, b.name, suf && affixDef(slot, b, suf.s).name].filter(Boolean).join(' ');
      else info.name = it.n || T.gear.rarity[it.r];
      if (it.r === 'glitched') info.color = R.glitchColor;
    }
    if (it.c) add(it.c.s, it.c.v);
    return info;
  }
  // Valeurs d'un support au niveau L (Combat.support_values) : mod au niveau 1 + lvl × (L − 1) / 19.
  function supportValues(sp, lv) {
    var v = {}, k = (Math.max(1, lv) - 1) / 19;
    Object.keys(sp.mod || {}).forEach(function (x) { v[x] = sp.mod[x]; });
    Object.keys(sp.lvl || {}).forEach(function (x) { v[x] = (v[x] || 0) + sp.lvl[x] * k; });
    return v;
  }
  function hands(info) { return info && info.kind && R.twoHanded.indexOf(info.kind) >= 0 ? 2 : 1; }

  // ───────────────────────────── calculs du résumé ─────────────────────────────
  function compute(b) {
    var stats = {}, map = {}, warns = [], coreFlags = {};
    var add = function (src, k, v) { if (!v) return; (stats[k] = stats[k] || { t: 0, s: [] }).t += v; stats[k].s.push([src, v]); };
    var c = CL[b.cls];
    // arbre de classe
    b.asc.forEach(function (id) { var n = clsNode(c, id); if (n) Object.keys(n.stats || {}).forEach(function (k) { add(T.sum.srcAsc + ' · ' + n.name, k, n.stats[k]); }); });
    // talents
    Object.keys(b.talents.alloc).forEach(function (id) {
      var r = b.talents.alloc[id] || 0, t = NODE_TREE[id]; if (!r || !t) return;
      var n = nodeOf(t, id); Object.keys(n.stats || {}).forEach(function (k) { add(t.name + ' · ' + n.name, k, n.stats[k] * r); });
    });
    Object.keys(b.talents.cores).forEach(function (key) {
      var tid = key.split(':')[0], tier = +key.split(':')[1], t = TR[tid]; if (!t) return;
      t.cores.forEach(function (ct) { if (ct.tier !== tier) return; ct.choices.forEach(function (ch) {
        if (ch.id === b.talents.cores[key]) { Object.keys(ch.stats || {}).forEach(function (k) { add(t.name + ' · ' + ch.name, k, ch.stats[k]); }); (ch.flags || []).forEach(function (f) { coreFlags[f] = true; }); }
        if (ch.id === b.talents.cores[key] && treePts(b, tid) < ct.need) warns.push(F(T.warn.treeLocked, { t: ch.name, n: ct.need }));
      }); });
    });
    // équipement
    var glitched = 0, flags = {};
    SLOTS.forEach(function (s) {
      var info = itemInfo(s, b.gear[s]); if (!info) return;
      Object.keys(info.stats).forEach(function (k) { add(slotName(s) + ' · ' + info.name, k, info.stats[k]); });
      info.flags.forEach(function (f) { flags[f.id] = true; });
      if (b.gear[s].r === 'glitched') glitched++;
      if (info.req > b.level) warns.push(F(T.warn.req, { i: info.name, n: info.req }));
    });
    var wi = itemInfo('weapon', b.gear.weapon);
    if (wi && hands(wi) === 2 && b.gear.offhand) warns.push(T.warn.twoHand);
    Object.keys(R.glitchLegPerItem).forEach(function (f) {
      if (!flags[f] || !glitched) return;
      var per = R.glitchLegPerItem[f]; Object.keys(per).forEach(function (k) { add(T.sum.srcGlitch, k, per[k] * glitched); });
    });
    // système solaire
    var sol = solar(b);
    Object.keys(sol.total).forEach(function (k) { add(T.sum.srcSolar, k, sol.total[k]); });
    // Arbre des Terres : bonus des cartes, à part
    b.atlas.forEach(function (id) { var n = ATLAS[id]; if (n) Object.keys(n.stats || {}).forEach(function (k) { map[k] = (map[k] || 0) + n.stats[k]; }); });
    // énergie et réservation
    var energy = R.energyBase + R.energyPerLevel * b.level + ((stats.energyMax || {}).t || 0);
    var spent = 0;
    var cost = function (list) { var hi = -1; (list || []).forEach(function (x, j) { if (x) hi = j; }); for (var j = 0; j <= hi; j++) spent += R.supportSlotCost[j] || 3; };
    b.bar.forEach(function (sid, i) { if (b.level >= R.skillSlotLevels[i]) cost(b.supp[i]); });
    b.auras.forEach(function (aid, i) { if (aid) cost(b.auraSupp[i]); });
    // Auras : réservation et statistiques, comme le jeu (Stats.aura_list) ; activées dans l'ordre des emplacements,
    // une aura qui dépasserait le plafond (mana 100 %, vie 90 %) est désactivée.
    var A = R.aura, effPct = (stats.auraEffectPct || {}).t || 0, resPct = (stats.reservationPct || {}).t || 0;
    var blood = flags.bloodMagic || coreFlags.bloodMagic, reserve = 0, reserveLife = 0, auraOff = [];
    var glv = gemLv(b);
    b.auras.forEach(function (aid, i) {
      var def = SK[aid]; if (!def || b.level < R.auraSlotLevels[i]) return;
      var eff = 1 + effPct / 100, c = 1, more = 1, onBlood = false, used = {};
      (b.auraSupp[i] || []).forEach(function (sid) {
        var sp = SP[sid]; if (!sp || used[sid] || !sp.aura) return; used[sid] = true;
        c += (sp.cost || 1) - 1;
        var m = supportValues(sp, glv);
        eff += (m.auraEffect || 0) / 100;
        if (m.auraMore) more *= 1 + m.auraMore / 100;
        if (m.bloodReserve != null) onBlood = true;
      });
      var rv = (def.reserve || 30) * Math.max(A.minCost, c) * (1 + resPct / 100);
      var life = onBlood || blood;
      if (life ? reserveLife + rv > A.lifeCap + 0.001 : reserve + rv > A.manaCap + 0.001) { auraOff.push(def.name); return; }
      if (life) reserveLife += rv; else reserve += rv;
      var lvs = 1 + A.lvScale * (glv - 1);
      Object.keys(def.stats || {}).forEach(function (k) { add(def.name, k, def.stats[k] * lvs * eff * more); });
    });
    auraOff.forEach(function (n) { warns.push(F(T.warn.auraOff, { a: n })); });
    // contrôles
    var tp = spentTalents(b), tmax = talentPts(b), ap = b.asc.length, amax = ascPts(b);
    if (tp > tmax) warns.push(F(T.warn.talents, { a: tp, b: tmax }));
    if (ap > amax) warns.push(F(T.warn.asc, { a: ap, b: amax }));
    if (spent > energy) warns.push(F(T.warn.energy, { a: spent, b: energy }));
    b.talents.trees.forEach(function (tid, i) { if (!treeOpen(b, i)) warns.push(F(T.warn.treeLocked, { t: (TR[tid] || {}).name, n: R.treeUnlock })); });
    var kind = wi && wi.kind;
    b.bar.forEach(function (sid) {
      var s = SK[sid]; if (!s || !s.weapons || !s.weapons.length) return;
      if (s.weapons.indexOf(kind) < 0) warns.push(F(T.warn.weapon, { s: s.name, w: s.weapons.map(function (k) { return LB.kinds[k] || k; }).join(', ') }));
    });
    return { stats: stats, map: map, warns: warns, energy: energy, spent: spent, reserve: Math.round(reserve * 10) / 10, reserveLife: Math.round(reserveLife * 10) / 10, tp: tp, tmax: tmax, ap: ap, amax: amax, solar: sol };
  }
  function solar(b) {
    var S = D.space.solar, total = {}, lines = [], placed = [];
    b.solar.slots.forEach(function (x, i) { if (x && PLANETS[x.p]) placed.push({ i: i, x: x, p: PLANETS[x.p] }); });
    placed.forEach(function (o) {
      var k = (1 + R.starStep * ((o.x.s || 1) - 1)) * (S.slot_mult[Math.min(o.i, S.slot_mult.length - 1)] || 1);
      var got = {};
      Object.keys(o.p.bonus || {}).forEach(function (s) { got[s] = o.p.bonus[s] * k; total[s] = (total[s] || 0) + got[s]; });
      lines[o.i] = { k: k, stats: got };
    });
    var combo = '';
    if (placed.length === S.slots) {
      var f = placed.map(function (o) { return o.p.family; });
      var same = f.every(function (x) { return x === f[0]; }), distinct = f[0] !== f[1] && f[1] !== f[2] && f[0] !== f[2];
      var cb = same ? S.same_family : (distinct ? S.all_families : null);
      if (cb) { combo = cb.name; Object.keys(cb.stats).forEach(function (s) { total[s] = (total[s] || 0) + cb.stats[s]; }); }
    }
    return { total: total, lines: lines, combo: combo };
  }

  // ───────────────────────────── fenêtre de choix ─────────────────────────────
  // items : [{id, name, icon, sub, tip, color, off}] ; onPick(id|null)
  function picker(title, items, onPick, opts) {
    opts = opts || {};
    hideTip();
    var ov = h('div', 'bd-modal'), box = h('div', 'bd-pick');
    box.appendChild(h('div', 'bd-pick-head', '<b>' + esc(title) + '</b>'));
    var q = h('input', 'bd-search'); q.type = 'search'; q.placeholder = T.gear.search; box.firstChild.appendChild(q);
    var x = h('button', 'bd-x', '✕'); x.type = 'button'; box.firstChild.appendChild(x);
    var list = h('div', 'bd-pick-list' + (opts.wide ? ' wide' : ''));
    box.appendChild(list);
    var close = function () { hideTip(); ov.remove(); document.removeEventListener('keydown', key); };
    var key = function (e) { if (e.key === 'Escape') close(); };
    function draw() {
      list.innerHTML = '';
      var f = q.value.trim().toLowerCase();
      if (opts.none) {
        var nb = h('button', 'bd-opt none', '<span class="nm">' + esc(opts.none) + '</span>'); nb.type = 'button';
        nb.addEventListener('click', function () { close(); onPick(null); }); list.appendChild(nb);
      }
      items.forEach(function (it) {
        if (f && (it.name + ' ' + (it.sub || '')).toLowerCase().indexOf(f) < 0) return;
        var b = h('button', 'bd-opt' + (it.off ? ' off' : '') + (it.cur ? ' cur' : ''),
          (it.icon ? img(it.icon, 'ic') : (it.swatch ? '<span class="sw" style="background:' + esc(it.swatch) + '"></span>' : '')) +
          '<span class="tx"><span class="nm"' + (it.color ? ' style="color:' + esc(it.color) + '"' : '') + '>' + esc(it.name) + '</span>' +
          (it.sub ? '<span class="sb">' + esc(it.sub) + '</span>' : '') + '</span>');
        b.type = 'button';
        tip(b, it.tip);
        b.addEventListener('click', function () { if (it.off) return; close(); onPick(it.id); });
        list.appendChild(b);
      });
    }
    q.addEventListener('input', draw);
    x.addEventListener('click', close);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', key);
    draw();
    ov.appendChild(box); document.body.appendChild(ov);
    q.focus();
  }

  // Infobulles construites
  function skillTip(s, lv) {
    if (!s) return '';
    if (s.tip) return s.tip;
    var t = '<strong style="color:#e8b04a">' + esc(s.name) + '</strong>   <span style="color:#4fc3b0">' + esc(s.typeName || '') + '</span><br>';
    t += '<span style="color:#7d8796">' + (s.tags || []).map(function (g) { return esc(LB.tags[g] || g); }).join(' · ') + '</span><br>';
    if (lv) t += '<span style="color:#e8b04a">' + esc(F(T.skills.gem, { n: lv })) + '</span><br>';
    t += '<br><span style="color:#c9cfd8">' + esc(s.desc || '') + '</span><br>';
    var meta = [];
    if (s.mana) meta.push(F(s.manaPerSec ? T.skills.perSec : T.skills.mana, { n: num(s.mana) }));
    if (s.time) meta.push(F(T.skills.time, { n: num(s.time) }));
    if (s.cd) meta.push(F(T.skills.cd, { n: num(s.cd) }));
    if (s.reserve) meta.push(F(T.skills.reserve, { n: s.reserve }));
    if (meta.length) t += '<br>' + esc(meta.join(' · ')) + '<br>';
    if (s.weapons && s.weapons.length) t += '<span style="color:#ffb060">' + esc(F(T.skills.weapons, { w: s.weapons.map(function (k) { return LB.kinds[k] || k; }).join(', ') })) + '</span><br>';
    if (s.attrs && s.attrs.length) t += '<span style="color:#7d8796">' + esc(F(T.skills.attrs, { a: s.attrs.map(function (a) { return T.attrs[a] || a; }).join(' · ') })) + '</span>';
    return t;
  }
  function statLines(st, col) {
    return Object.keys(st).map(function (k) { return '<span style="color:' + (col || '#b0c0d0') + '">' + esc(statText(k, st[k])) + '</span>'; }).join('<br>');
  }
  function itemCard(slot, it, info) {
    if (!info) return '<span style="color:#7d8796">' + esc(T.gear.empty) + '</span>';
    var t = '<strong style="color:' + esc(info.color) + '">' + esc(info.name) + '</strong><br><span style="color:#9a8a78">' + esc(info.type) +
      (info.base && it.r !== 'normal' ? ' — ' + esc(info.base.name) : (info.leg ? ' — ' + esc(info.leg.baseName) : '')) + '</span><br>';
    t += '<span style="color:' + (info.req > B().level ? '#e85555' : '#c0a060') + '">' + esc(F(T.gear.req, { n: info.req })) + '</span><br>';
    if (info.dmg) t += '<br>' + esc(F(T.gear.dmg, { a: info.dmg[0], b: info.dmg[1], s: num(info.dmg[2]) })) + '<br>';
    var impl = {};
    if (info.leg) Object.keys(info.leg.implicit || {}).forEach(function (k) { impl[k] = info.leg.implicit[k]; });
    else if (info.base) {
      if (isWeaponBase(info.base)) { if (info.base.implStat) impl[info.base.implStat] = info.stats[info.base.implStat] - ((it.a || []).filter(function (a) { return a.s === info.base.implStat; }).reduce(function (x, a) { return x + a.v; }, 0)); }
      else Object.keys(info.base.implicit || {}).forEach(function (k) { impl[k] = info.base.implicit[k]; });
      if (it.e) impl.energyMax = it.e;
    }
    if (it.c) impl[it.c.s] = (impl[it.c.s] || 0) + it.c.v;
    if (Object.keys(impl).length) t += '<hr>' + statLines(impl);
    if (info.leg) {
      t += '<hr>' + (info.leg.stats || []).map(function (s) { return '<span style="color:#e8b04a">' + esc(statText(s.stat, s.val)) + '</span>'; }).join('<br>');
      info.flags.forEach(function (f) { t += '<br><span style="color:#ff8a1a">' + esc(f.desc) + '</span>'; });
      if (info.leg.lore) t += '<br><br><em style="color:#7a6a58">' + esc(info.leg.lore) + '</em>';
    } else if ((it.a || []).length || it.g) {
      var row = function (a) {
        var d = affixDef(slot, info.base, a.s) || {};
        var col = d.cat === 'special' ? '#4fc3b0' : d.cat === 'ultimate' ? '#e8b04a' : '#e0d8cc';
        return '<span class="tier" style="background:' + tierColor(a.t) + '">T' + a.t + '</span> <span style="color:' + col + '">' + esc(statText(a.s, a.v)) + '</span>';
      };
      var P = (it.a || []).filter(function (a) { return (affixDef(slot, info.base, a.s) || {}).isP; });
      var S = (it.a || []).filter(function (a) { var d = affixDef(slot, info.base, a.s); return d && !d.isP; });
      t += '<hr>';
      if (P.length) t += '<span style="color:#e8b04a">◆ ' + esc(T.gear.prefixes) + '</span><br>' + P.map(row).join('<br>') + '<br>';
      if (S.length) t += '<span style="color:#4fc3b0">◇ ' + esc(T.gear.suffixes) + '</span><br>' + S.map(row).join('<br>');
      if (it.g) {
        var g = D.items.glitch.filter(function (x) { return x.stat === it.g.s; })[0];
        if (g) t += '<br><span style="color:' + R.glitchColor + '">' + esc(g.text.replace('{v10}', num(it.g.v / 10)).replace('{v}', it.g.v)) + '</span>';
      }
    }
    return t;
  }

  // ───────────────────────────── structure de la page ─────────────────────────────
  var tab = 'gear', gearSel = 'weapon';
  try { tab = sessionStorage.getItem('bd-tab') || 'gear'; } catch (e) {}
  host.innerHTML = '';
  var bar = h('div', 'bd-bar wrap'), body = h('div', 'bd-body wrap'), main = h('div', 'bd-main'), side = h('aside', 'bd-side');
  var tabsEl = h('div', 'bd-tabs'), pane = h('div', 'bd-pane');
  main.appendChild(tabsEl); main.appendChild(pane);
  body.appendChild(main); body.appendChild(side);
  host.appendChild(bar); host.appendChild(body);

  function renderBar() {
    var b = B(), e = temp || curEntry();
    bar.innerHTML = '';
    var top = h('div', 'bd-row');
    var sel = h('select', 'bd-builds'); sel.title = T.myBuilds;
    store.builds.forEach(function (x) { var o = h('option', null, esc(x.name)); o.value = x.id; if (!temp && x.id === store.cur) o.selected = true; sel.appendChild(o); });
    if (temp) { var o2 = h('option', null, esc(temp.name)); o2.selected = true; o2.value = ''; sel.insertBefore(o2, sel.firstChild); }
    sel.addEventListener('change', function () { if (!sel.value) return; temp = null; store.cur = sel.value; persist(); renderAll(); });
    var name = h('input', 'bd-name'); name.value = e.name; name.placeholder = T.namePh; name.maxLength = 60;
    name.addEventListener('input', function () { e.name = name.value || T.defaultName; if (!temp) { clearTimeout(saveTimer); saveTimer = setTimeout(function () { persist(); var op = sel.querySelector('option[value="' + e.id + '"]'); if (op) op.textContent = e.name; }, 300); } });
    var btn = function (label, fn, cls) { var x = h('button', 'bd-btn ' + (cls || ''), esc(label)); x.type = 'button'; x.addEventListener('click', fn); return x; };
    top.appendChild(h('span', 'bd-lbl', esc(T.myBuilds)));
    top.appendChild(sel); top.appendChild(name);
    if (temp) top.appendChild(btn(T.keep, function () { var t2 = temp; temp = null; newEntry(t2.name, t2.data); history.replaceState(null, '', location.pathname + location.search); toast(T.saved); renderAll(); }, 'gold'));
    top.appendChild(btn(T.newBuild, function () { temp = null; newEntry(T.defaultName, blank(b.cls)); renderAll(); }));
    top.appendChild(btn(T.duplicate, function () { var src = temp || curEntry(); temp = null; newEntry(F(T.copyOf, { n: src.name }), JSON.parse(JSON.stringify(src.data))); renderAll(); }));
    if (!temp) top.appendChild(btn(T.del, function () {
      if (!confirm(F(T.confirmDel, { n: e.name }))) return;
      store.builds = store.builds.filter(function (x) { return x.id !== e.id; });
      if (!store.builds.length) newEntry(T.defaultName); else store.cur = store.builds[0].id;
      persist(); renderAll();
    }, 'danger'));
    var sp = h('span', 'bd-sp'); top.appendChild(sp);
    top.appendChild(btn(T.export, function () { encode(temp || curEntry()).then(function (c) { copy(c); }); }));
    top.appendChild(btn(T.copyLink, function () { encode(temp || curEntry()).then(function (c) { copy(location.href.split('#')[0].split('?')[0] + '#b=' + c); }); }));
    top.appendChild(btn(T.import, openImport));
    bar.appendChild(top);

    var row2 = h('div', 'bd-row');
    row2.appendChild(h('span', 'bd-lbl', esc(T.cls)));
    var cls = h('div', 'bd-classes');
    D.classes.forEach(function (c) {
      var x = h('button', 'bd-cls' + (c.id === b.cls ? ' on' : ''), img(c.icon) + '<span>' + esc(c.name) + '</span>');
      x.type = 'button'; x.style.setProperty('--cc', c.color);
      tip(x, '<strong style="color:' + esc(c.color) + '">' + esc(c.name) + '</strong>   <span style="color:#7d8796">' + esc(c.role) + '</span><br><br>' + esc(c.desc) +
        (c.passive && c.passive.name ? '<br><br><span style="color:#e8b04a">' + esc(c.passive.name) + '</span><br><span style="color:#9aa5b6">' + esc(c.passive.desc) + '</span>' : ''));
      x.addEventListener('click', function () { if (b.cls === c.id) return; b.cls = c.id; b.asc = []; b.runes = [null, null, null, null]; changed(); });
      cls.appendChild(x);
    });
    row2.appendChild(cls);
    var lv = h('label', 'bd-level', '<span class="bd-lbl">' + esc(T.level) + '</span>');
    var rng = h('input'); rng.type = 'range'; rng.min = 1; rng.max = R.maxLevel; rng.value = b.level;
    var nb = h('input', 'bd-num'); nb.type = 'number'; nb.min = 1; nb.max = R.maxLevel; nb.value = b.level;
    var setLv = function (v) { b.level = Math.max(1, Math.min(R.maxLevel, parseInt(v, 10) || 1)); changed(); };
    rng.addEventListener('input', function () { nb.value = rng.value; }); rng.addEventListener('change', function () { setLv(rng.value); });
    nb.addEventListener('change', function () { setLv(nb.value); });
    lv.appendChild(rng); lv.appendChild(nb);
    row2.appendChild(lv);
    bar.appendChild(row2);
    if (temp) bar.appendChild(h('div', 'bd-note', esc(T.linkLoaded)));
  }
  function copy(text) {
    var done = function () { toast(T.copied); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { prompt('', text); });
    else prompt('', text);
  }
  function openImport() {
    var ov = h('div', 'bd-modal'), box = h('div', 'bd-pick small');
    box.innerHTML = '<div class="bd-pick-head"><b>' + esc(T.importTitle) + '</b></div>';
    var ta = h('textarea', 'bd-import'); ta.placeholder = T.importPh; box.appendChild(ta);
    var row = h('div', 'bd-row end');
    var ok = h('button', 'bd-btn gold', esc(T.importBtn)), no = h('button', 'bd-btn', esc(T.cancel));
    ok.type = no.type = 'button';
    row.appendChild(no); row.appendChild(ok); box.appendChild(row);
    no.addEventListener('click', function () { ov.remove(); });
    ok.addEventListener('click', function () {
      decode(ta.value).then(function (r) { ov.remove(); temp = null; newEntry(r.name, r.data); toast(T.imported); renderAll(); }, function () { toast(T.importBad); });
    });
    ov.appendChild(box); document.body.appendChild(ov); ta.focus();
  }

  var TABS = ['gear', 'skills', 'cls', 'talents', 'atlas', 'solar', 'notes'];
  function renderTabs() {
    tabsEl.innerHTML = '';
    TABS.forEach(function (k) {
      var x = h('button', 'bd-tab' + (k === tab ? ' on' : ''), esc(T.tabs[k])); x.type = 'button';
      x.addEventListener('click', function () { tab = k; try { sessionStorage.setItem('bd-tab', k); } catch (e) {} renderTabs(); renderPane(); });
      tabsEl.appendChild(x);
    });
  }
  function renderAll() { hideTip(); renderBar(); renderTabs(); renderPane(); renderSide(); }
  function renderPane() {
    hideTip(); pane.innerHTML = '';
    ({ gear: paneGear, skills: paneSkills, cls: paneCls, talents: paneTalents, atlas: paneAtlas, solar: paneSolar, notes: paneNotes })[tab]();
  }

  // ───────────────────────────── résumé ─────────────────────────────
  var GROUP = function (k) {
    if (/^(strength|dexterity|intelligence)$/.test(k)) return 'attr';
    if (/^(maxLife|maxMana|maxES|life|mana|armor|evasion|res|block|energyShield|es|damageTaken|regen|lifeRegen|manaRegen|leech|lifeLeech|lifeOn|dodge|ward|fortif)/i.test(k) || /Res|Regen|armor|evasion|block/i.test(k)) return 'def';
    if (/dmg|Dmg|Pct$|crit|Crit|speed|Speed|add[A-Z]|area|Area|proj|Proj|minion|Minion|skillLvl|pen|Pen|ignite|chill|shock|multi|echo|cdr|duration/i.test(k)) return 'off';
    return 'other';
  };
  function renderSide() {
    var b = B(), r = compute(b);
    side.innerHTML = '';
    side.appendChild(h('div', 'bd-side-title', esc(T.sum.title)));
    var meter = function (label, a, m, cls) {
      var pct = m > 0 ? Math.min(100, a / m * 100) : 0;
      return '<div class="bd-meter ' + (a > m ? 'over' : '') + ' ' + (cls || '') + '"><span class="l">' + esc(label) + '</span><span class="v">' + a + ' / ' + m + '</span><i style="width:' + pct + '%"></i></div>';
    };
    var m = h('div', 'bd-meters',
      meter(T.sum.talents, r.tp, r.tmax) + meter(T.sum.asc, r.ap, r.amax) + meter(T.sum.energy, r.spent, r.energy, 'teal') +
      '<div class="bd-meter"><span class="l">' + esc(T.sum.reserve) + '</span><span class="v">' + num(r.reserve) + ' %</span><i style="width:' + Math.min(100, r.reserve) + '%"></i></div>' +
      (r.reserveLife ? '<div class="bd-meter"><span class="l">' + esc(T.sum.reserveLife) + '</span><span class="v">' + num(r.reserveLife) + ' %</span><i style="width:' + Math.min(100, r.reserveLife / 0.9) + '%"></i></div>' : '') +
      '<div class="bd-meter plain"><span class="l">' + esc(T.sum.atlas) + '</span><span class="v">' + b.atlas.length + '</span></div>');
    side.appendChild(m);
    if (r.warns.length) side.appendChild(h('div', 'bd-warns', '<b>' + esc(T.sum.warn) + '</b>' + r.warns.map(function (w) { return '<div>⚠ ' + esc(w) + '</div>'; }).join('')));
    side.appendChild(h('div', 'bd-side-sub', esc(T.sum.stats)));
    var keys = Object.keys(r.stats);
    if (!keys.length) side.appendChild(h('div', 'bd-empty', esc(T.sum.none)));
    ['attr', 'off', 'def', 'other'].forEach(function (g) {
      var ks = keys.filter(function (k) { return GROUP(k) === g; }).sort(function (a, c) { return statText(a, 1).localeCompare(statText(c, 1), LANG); });
      if (!ks.length) return;
      var box = h('div', 'bd-stats'); box.appendChild(h('div', 'bd-grp', esc(T.sum.groups[g])));
      ks.forEach(function (k) {
        var s = r.stats[k], line = h('div', 'bd-stat', esc(statText(k, s.t)));
        tip(line, '<strong>' + esc(statText(k, s.t)) + '</strong><br><span style="color:#7d8796">' + esc(T.sum.sources) + '</span><br>' +
          s.s.map(function (x) { return esc(x[0]) + ' : <span style="color:#e8b04a">' + esc(num(x[1])) + '</span>'; }).join('<br>'));
        box.appendChild(line);
      });
      side.appendChild(box);
    });
    var mk = Object.keys(r.map);
    if (mk.length) {
      var mb = h('div', 'bd-stats'); mb.appendChild(h('div', 'bd-grp', esc(T.sum.map)));
      mk.forEach(function (k) {
        var ml = (D.atlas.mapLabels || {})[k];
        mb.appendChild(h('div', 'bd-stat dim', esc(ml ? ml.t.replace('{v}', num(r.map[k] * ml.k)) : statText(k, r.map[k]))));
      });
      side.appendChild(mb);
    }
    side.appendChild(h('div', 'bd-ver', esc(F(T.gameVersion, { v: D.version }))));
  }

  // ───────────────────────────── équipement ─────────────────────────────
  function paneGear() {
    var b = B();
    var wrap = h('div', 'bd-gear');
    var doll = h('div', 'bd-doll');
    var wi = itemInfo('weapon', b.gear.weapon);
    SLOTS.forEach(function (s) {
      var it = b.gear[s], info = itemInfo(s, it);
      var locked = s === 'offhand' && wi && hands(wi) === 2;
      var cell = h('button', 'bd-slot s-' + s + (s === gearSel ? ' sel' : '') + (locked ? ' locked' : ''));
      cell.type = 'button';
      cell.style.setProperty('--rc', info ? info.color : '#3a4352');
      cell.innerHTML = '<span class="ic">' + (info ? img(info.icon) : img(D.items.slotIcons[slotKey(s)], 'ghost')) + '</span>' +
        '<span class="slb">' + esc(slotName(s)) + '</span>' + (info ? '<span class="nm" style="color:' + esc(info.color) + '">' + esc(info.name) + '</span>' : '');
      tip(cell, info ? itemCard(s, it, info) : (locked ? esc(T.gear.locked2h) : ''));
      cell.addEventListener('click', function () { gearSel = s; renderPane(); });
      doll.appendChild(cell);
    });
    var left = h('div', 'bd-gear-left'); left.appendChild(doll);
    var edEl = itemEditor(gearSel);
    if (edEl._card) left.appendChild(edEl._card);
    wrap.appendChild(left);
    wrap.appendChild(edEl);
    pane.appendChild(wrap);
  }
  function basesFor(s) {
    if (s === 'weapon') return D.items.weapons;
    if (s === 'offhand') return D.items.shields.concat(D.items.weapons.filter(function (w) { return R.twoHanded.indexOf(w.kind) < 0; }));
    return D.items.armor[slotKey(s)] || [];
  }
  function legsFor(s) {
    var k = slotKey(s);
    return D.items.legendaries.filter(function (l) {
      if (s === 'offhand') return l.slot === 'offhand' || (l.slot === 'weapon' && R.twoHanded.indexOf(l.kind) < 0);
      return l.slot === k || (k === 'ring' && (l.slot === 'ring1' || l.slot === 'ring2'));
    });
  }
  function itemEditor(s) {
    var b = B(), it = b.gear[s];
    var ed = h('div', 'bd-editor');
    var wi = itemInfo('weapon', b.gear.weapon);
    var head = h('div', 'bd-ed-head', '<b>' + esc(slotName(s)) + '</b>');
    if (it) { var clr = h('button', 'bd-btn danger small', esc(T.gear.clear)); clr.type = 'button'; clr.addEventListener('click', function () { delete b.gear[s]; changed(); }); head.appendChild(clr); }
    ed.appendChild(head);
    if (s === 'offhand' && wi && hands(wi) === 2) { ed.appendChild(h('div', 'bd-empty', esc(T.gear.locked2h))); return ed; }
    // rareté
    var rr = h('div', 'bd-seg');
    ['normal', 'magic', 'rare', 'glitched', 'legendary'].forEach(function (r) {
      var x = h('button', 'bd-segb' + (it && it.r === r ? ' on' : ''), esc(T.gear.rarity[r])); x.type = 'button';
      x.style.setProperty('--rc', r === 'glitched' ? R.glitchColor : R.rarityColors[r]);
      x.addEventListener('click', function () {
        if (r === 'legendary') { pickLeg(s); return; }
        if (it && it.r !== 'legendary') { it.r = r; if (r === 'normal') it.a = []; if (r === 'magic') trimMagic(s, it); if (r !== 'glitched') delete it.g; changed(); return; }
        pickBase(s, function (id) { b.gear[s] = { r: r, b: id, il: Math.max(1, Math.min(R.maxLevel, b.level)), a: [], e: 0 }; changed(); });
      });
      rr.appendChild(x);
    });
    ed.appendChild(rr);
    if (!it) { ed.appendChild(h('div', 'bd-empty', esc(T.gear.hint))); return ed; }
    var info = itemInfo(s, it);
    var grid = h('div', 'bd-ed-grid');
    var form = h('div', 'bd-ed-form');
    var card = h('div', 'bd-card', itemCard(s, it, info));
    if (it.r === 'legendary') {
      var lb = h('button', 'bd-pickbtn', img(info.icon) + '<span style="color:' + R.rarityColors.legendary + '">' + esc(info.name) + '</span><small>' + esc(T.gear.pickLeg) + '</small>');
      lb.type = 'button'; lb.addEventListener('click', function () { pickLeg(s); });
      form.appendChild(field(T.gear.legs, lb));
      form.appendChild(h('div', 'bd-hint', esc(T.gear.fixed)));
      form.appendChild(field(T.gear.corruption, corruptSel(s, it)));
    } else {
      var bb = h('button', 'bd-pickbtn', img(info.icon) + '<span>' + esc(info.base.name) + '</span><small>' + esc(T.gear.pickBase) + '</small>');
      bb.type = 'button'; bb.addEventListener('click', function () { pickBase(s, function (id) { it.b = id; it.a = (it.a || []).filter(function (a) { return affixDef(s, baseOf(s, id), a.s); }); changed(); }); });
      form.appendChild(field(T.gear.base, bb));
      var il = h('input', 'bd-num'); il.type = 'number'; il.min = 1; il.max = R.maxLevel; il.value = it.il;
      il.addEventListener('change', function () { it.il = Math.max(1, Math.min(R.maxLevel, parseInt(il.value, 10) || 1)); clampItem(s, it); changed(); });
      form.appendChild(field(T.gear.ilvl, il));
      var em = energyMax(it.il);
      if (em > 0) {
        var en = h('input', 'bd-num'); en.type = 'number'; en.min = 0; en.max = em; en.value = it.e || 0;
        en.addEventListener('change', function () { it.e = Math.max(0, Math.min(em, parseInt(en.value, 10) || 0)); changed(); });
        form.appendChild(field(T.gear.energy + ' (≤ ' + em + ')', en));
      }
      if (it.r === 'rare' || it.r === 'glitched') {
        var nm = h('input', 'bd-text'); nm.value = it.n || ''; nm.placeholder = T.gear.rarity[it.r]; nm.maxLength = 40;
        nm.addEventListener('change', function () { it.n = nm.value; changed(); });
        form.appendChild(field(T.gear.name, nm));
      }
      if (it.r !== 'normal') { form.appendChild(affixBlock(s, it, true)); form.appendChild(affixBlock(s, it, false)); }
      if (it.r === 'glitched') form.appendChild(field(T.gear.glitch, glitchSel(it)));
      form.appendChild(field(T.gear.corruption, corruptSel(s, it)));
    }
    grid.appendChild(form);
    ed.appendChild(grid);
    ed._card = card;
    return ed;
  }
  function field(label, ctl) { var f = h('div', 'bd-field'); f.appendChild(h('span', 'bd-flbl', esc(label))); f.appendChild(ctl); return f; }
  function trimMagic(s, it) {
    var base = baseOf(s, it.b), p = 0, q = 0;
    it.a = (it.a || []).filter(function (a) { var d = affixDef(s, base, a.s); if (!d) return false; if (d.isP) return ++p <= 1; return ++q <= 1; });
  }
  function clampItem(s, it) {
    var base = baseOf(s, it.b);
    (it.a || []).forEach(function (a) {
      var d = affixDef(s, base, a.s); if (!d) return;
      var best = bestTier(d.tiers, it.il);
      if (best && a.t < best) { a.t = best; var tr = d.tiers[d.tiers.length - a.t]; a.v = Math.max(tr[1], Math.min(tr[2], a.v)); }
    });
    it.e = Math.min(it.e || 0, energyMax(it.il));
  }
  function affixBlock(s, it, isP) {
    var base = baseOf(s, it.b), pool = D.items.pools[poolKey(s, base)] || [];
    var max = it.r === 'magic' ? 1 : 3;
    var mine = (it.a || []).filter(function (a) { var d = affixDef(s, base, a.s); return d && d.isP === isP; });
    var box = h('div', 'bd-affixes');
    box.appendChild(h('div', 'bd-aff-head ' + (isP ? 'pre' : 'suf'), (isP ? '◆ ' : '◇ ') + esc(isP ? T.gear.prefixes : T.gear.suffixes) + ' <small>' + mine.length + '/' + max + '</small>'));
    mine.forEach(function (a) {
      var d = affixDef(s, base, a.s);
      var row = h('div', 'bd-aff cat-' + d.cat);
      var ts = h('select', 'bd-tier');
      for (var gi = d.tiers.length - 1; gi >= 0; gi--) {
        if (!tierOk(d.tiers, gi, it.il)) continue;
        var t = d.tiers.length - gi, o = h('option', null, 'T' + t + ' · ' + d.tiers[gi][1] + '–' + d.tiers[gi][2]);
        o.value = t; if (t === a.t) o.selected = true; ts.appendChild(o);
      }
      ts.style.setProperty('--tc', tierColor(a.t));
      ts.addEventListener('change', function () { a.t = +ts.value; var tr = d.tiers[d.tiers.length - a.t]; a.v = tr[2]; changed(); });
      var tr = d.tiers[d.tiers.length - a.t] || d.tiers[0];
      var v = h('input', 'bd-num'); v.type = 'number'; v.min = Math.min(tr[1], tr[2]); v.max = Math.max(tr[1], tr[2]); v.value = a.v;
      v.addEventListener('change', function () { a.v = Math.max(+v.min, Math.min(+v.max, parseInt(v.value, 10) || 0)); changed(); });
      var lbl = h('span', 'bd-aff-txt', esc(statText(a.s, a.v)) + ' <small>' + esc(d.name) + '</small>');
      var rm = h('button', 'bd-x', '✕'); rm.type = 'button'; rm.addEventListener('click', function () { it.a = it.a.filter(function (x) { return x !== a; }); changed(); });
      row.appendChild(ts); row.appendChild(v); row.appendChild(lbl); row.appendChild(rm);
      box.appendChild(row);
    });
    if (mine.length < max) {
      var add = h('button', 'bd-add', '+ ' + esc(T.gear.add)); add.type = 'button';
      add.addEventListener('click', function () {
        var used = {}; (it.a || []).forEach(function (a) { used[a.s] = true; });
        var catN = { special: 0, ultimate: 0 };
        (it.a || []).forEach(function (a) { var d = affixDef(s, base, a.s); if (d && catN[d.cat] != null) catN[d.cat]++; });
        var items = pool.filter(function (d) { return d.isP === isP; }).map(function (d) {
          var best = bestTier(d.tiers, it.il);
          var capped = catN[d.cat] != null && catN[d.cat] >= (R.catCaps[d.cat] || 99);
          var range = best ? d.tiers[d.tiers.length - best] : null;
          return { id: d.stat, name: statText(d.stat, range ? range[2] : 0), sub: d.name + ' · ' + T.gear.cat[d.cat] + (best ? ' · T' + best + '–T' + d.tiers.length : ' · ' + T.gear.noTier) + (capped ? ' · ' + F(T.gear.catCap, { c: T.gear.cat[d.cat], n: R.catCaps[d.cat] }) : ''),
            color: d.cat === 'special' ? '#4fc3b0' : d.cat === 'ultimate' ? '#e8b04a' : null, off: used[d.stat] || !best || capped };
        });
        picker(isP ? T.gear.prefixes : T.gear.suffixes, items, function (stat) {
          var d = affixDef(s, base, stat), t = bestTier(d.tiers, it.il), tr2 = d.tiers[d.tiers.length - t];
          (it.a = it.a || []).push({ s: stat, t: t, v: tr2[2] }); changed();
        }, { wide: true });
      });
      box.appendChild(add);
    }
    return box;
  }
  function corruptSel(s, it) {
    var sel = h('select', 'bd-sel'), o0 = h('option', null, esc(T.gear.corruptNone)); o0.value = ''; sel.appendChild(o0);
    D.items.corruption.forEach(function (c) { var o = h('option', null, esc(statText(c.stat, c.max) + ' (' + c.min + '–' + c.max + ')')); o.value = c.stat; if (it.c && it.c.s === c.stat) o.selected = true; sel.appendChild(o); });
    var wrap = h('div', 'bd-inline'); wrap.appendChild(sel);
    if (it.c) {
      var c = D.items.corruption.filter(function (x) { return x.stat === it.c.s; })[0];
      var v = h('input', 'bd-num'); v.type = 'number'; v.min = c.min; v.max = c.max; v.value = it.c.v;
      v.addEventListener('change', function () { it.c.v = Math.max(c.min, Math.min(c.max, parseInt(v.value, 10) || c.min)); changed(); });
      wrap.appendChild(v);
    }
    sel.addEventListener('change', function () { var c2 = D.items.corruption.filter(function (x) { return x.stat === sel.value; })[0]; it.c = c2 ? { s: c2.stat, v: c2.max } : null; changed(); });
    return wrap;
  }
  function glitchSel(it) {
    var sel = h('select', 'bd-sel'), o0 = h('option', null, '—'); o0.value = ''; sel.appendChild(o0);
    D.items.glitch.forEach(function (g) { var o = h('option', null, esc(g.name)); o.value = g.stat; if (it.g && it.g.s === g.stat) o.selected = true; sel.appendChild(o); });
    var wrap = h('div', 'bd-inline'); wrap.appendChild(sel);
    if (it.g) {
      var g = D.items.glitch.filter(function (x) { return x.stat === it.g.s; })[0];
      var v = h('input', 'bd-num'); v.type = 'number'; v.min = g.min; v.max = g.max; v.value = it.g.v;
      v.addEventListener('change', function () { it.g.v = Math.max(g.min, Math.min(g.max, parseInt(v.value, 10) || g.min)); changed(); });
      wrap.appendChild(v);
    }
    sel.addEventListener('change', function () { var g2 = D.items.glitch.filter(function (x) { return x.stat === sel.value; })[0]; it.g = g2 ? { s: g2.stat, v: g2.max } : null; changed(); });
    return wrap;
  }
  function pickBase(s, cb) {
    var items = basesFor(s).map(function (bs) {
      var impl = isWeaponBase(bs) ? (bs.implStat ? statText(bs.implStat, bs.implBase) : '') : Object.keys(bs.implicit || {}).map(function (k) { return statText(k, bs.implicit[k]); }).join(' · ');
      return { id: bs.id, name: bs.name, icon: bs.icon, sub: (isWeaponBase(bs) ? (LB.kinds[bs.kind] || '') + ' · ' : '') + 'niv. ' + bs.req + (impl ? ' · ' + impl : '') };
    });
    picker(T.gear.pickBase, items, cb, { wide: true });
  }
  function pickLeg(s) {
    var b = B();
    var items = legsFor(s).map(function (l) {
      var info = itemInfo(s, { r: 'legendary', l: l.id });
      return { id: l.id, name: l.name, icon: l.icon, color: R.legTierColors[l.tier] || R.rarityColors.legendary,
        sub: (LB.legTiers[l.tier - 1] || '') + ' · ' + F(T.gear.req, { n: l.req }) + (l.exclusive ? ' · ' + T.gear.exclusive : ''), tip: itemCard(s, { r: 'legendary', l: l.id }, info) };
    });
    picker(T.gear.pickLeg, items, function (id) { var old = b.gear[s]; b.gear[s] = { r: 'legendary', l: id, c: old && old.c || null }; changed(); }, { wide: true });
  }

  // ───────────────────────────── compétences ─────────────────────────────
  function paneSkills() {
    var b = B(), lv = gemLv(b);
    pane.appendChild(h('p', 'bd-help', esc(T.skills.help)));
    var sec = function (title) { var x = h('div', 'bd-sec'); x.appendChild(h('div', 'bd-sec-title', esc(title))); pane.appendChild(x); return x; };
    var bars = sec(T.skills.bar);
    b.bar.forEach(function (sid, i) {
      var open = b.level >= R.skillSlotLevels[i];
      bars.appendChild(skillRow(b, sid, b.supp[i], open, R.skillSlotLevels[i], lv, function (v) { b.bar[i] = v; if (!v) b.supp[i] = []; else pruneSupp(b.supp[i], v); }, F(T.skills.slot, { n: i + 1 }), false));
    });
    var au = sec(T.skills.auras);
    b.auras.forEach(function (aid, i) {
      var open = b.level >= R.auraSlotLevels[i];
      au.appendChild(skillRow(b, aid, b.auraSupp[i], open, R.auraSlotLevels[i], lv, function (v) { b.auras[i] = v; if (!v) b.auraSupp[i] = []; else pruneSupp(b.auraSupp[i], v); }, F(T.skills.slot, { n: i + 1 }), true));
    });
    if (b.cls === R.runeClass) {
      var ru = sec(T.skills.runes), row = h('div', 'bd-runes');
      b.runes.forEach(function (rid, i) {
        var open = b.level >= R.runeSlotLevels[i], s = SK[rid];
        var x = h('button', 'bd-tile' + (open ? '' : ' locked'), s ? img(s.icon) : '<span class="plus">' + (open ? '+' : '🔒') + '</span>');
        x.type = 'button';
        tip(x, s ? skillTip(s, lv) : (open ? esc(T.skills.pickRune) : esc(F(T.skills.unlock, { n: R.runeSlotLevels[i] }))));
        x.addEventListener('click', function () {
          if (!open) return;
          picker(T.skills.pickRune, D.skills.filter(function (k) { return k.runeElem; }).map(function (k) { return { id: k.id, name: k.name, icon: k.icon, tip: skillTip(k, lv), off: b.runes.indexOf(k.id) >= 0 && b.runes[i] !== k.id }; }),
            function (v) { b.runes[i] = v; changed(); }, { none: T.skills.remove });
        });
        x.addEventListener('contextmenu', function (e) { e.preventDefault(); b.runes[i] = null; changed(); });
        var cell = h('div', 'bd-rune'); cell.appendChild(x); cell.appendChild(h('span', 'bd-mini', esc(s ? s.name : F(T.skills.unlock, { n: R.runeSlotLevels[i] }))));
        row.appendChild(cell);
      });
      ru.appendChild(row);
    }
  }
  function pruneSupp(list, sid) {
    for (var j = 0; j < list.length; j++) if (list[j] && !supportFits(SP[list[j]], sid, list)) list[j] = null;
  }
  function supportFits(sp, sid, links) {
    if (!sp) return false;
    if (sp.compat.indexOf(sid) >= 0) return true;
    return links.indexOf('spellTotem') >= 0 && sp.compatTotem.indexOf(sid) >= 0;
  }
  function skillRow(b, sid, supp, open, lvNeed, lv, set, label, aura) {
    var s = SK[sid];
    var row = h('div', 'bd-skill' + (open ? '' : ' locked'));
    var tile = h('button', 'bd-tile big', s ? img(s.icon) : '<span class="plus">' + (open ? '+' : '🔒') + '</span>');
    tile.type = 'button';
    tip(tile, s ? skillTip(s, lv) : esc(open ? (aura ? T.skills.pickAura : T.skills.pick) : F(T.skills.unlock, { n: lvNeed })));
    tile.addEventListener('click', function () {
      if (!open) return;
      var used = (aura ? b.auras : b.bar);
      var list = D.skills.filter(function (k) { var isA = (k.tags || []).indexOf('aura') >= 0; return aura ? isA : !isA; })
        .map(function (k) { return { id: k.id, name: k.name, icon: k.icon, sub: (k.tags || []).map(function (g) { return LB.tags[g] || g; }).join(' · '), tip: skillTip(k, lv), off: used.indexOf(k.id) >= 0 && k.id !== sid }; });
      picker(aura ? T.skills.pickAura : T.skills.pick, list, function (v) { set(v); changed(); }, { none: T.skills.remove, wide: true });
    });
    tile.addEventListener('contextmenu', function (e) { e.preventDefault(); set(null); changed(); });
    row.appendChild(tile);
    var info = h('div', 'bd-skill-info', '<span class="bd-mini">' + esc(label) + (open ? '' : ' · ' + esc(F(T.skills.unlock, { n: lvNeed }))) + '</span>' +
      '<b>' + esc(s ? s.name : '—') + '</b>' + (s ? '<span class="bd-mini">' + esc(F(T.skills.gem, { n: lv })) + (s.reserve ? ' · ' + esc(F(T.skills.reserve, { n: s.reserve })) : '') + '</span>' : ''));
    row.appendChild(info);
    var sups = h('div', 'bd-supps');
    for (var j = 0; j < 5; j++) (function (j) {
      var spid = supp[j], sp = SP[spid];
      var c = h('button', 'bd-tile sup' + (s && open ? '' : ' locked'), (sp ? img(sp.icon) : '<span class="plus">+</span>') + '<span class="cost">' + (R.supportSlotCost[j] || '') + '</span>');
      c.type = 'button';
      tip(c, sp ? sp.tip : esc(T.skills.pickSupport + ' · ' + F(T.skills.cost, { n: R.supportSlotCost[j] })));
      c.addEventListener('click', function () {
        if (!s || !open) return;
        var list = D.supports.filter(function (x) { return x.aura === !!aura && supportFits(x, sid, supp); })
          .map(function (x) { return { id: x.id, name: x.name, icon: x.icon, sub: (x.tags || []).map(function (g) { return LB.tags[g] || g; }).join(' · '), tip: x.tip, off: supp.indexOf(x.id) >= 0 && x.id !== spid }; });
        picker(T.skills.pickSupport, list, function (v) { supp[j] = v; changed(); }, { none: T.skills.remove, wide: true });
      });
      c.addEventListener('contextmenu', function (e) { e.preventDefault(); supp[j] = null; changed(); });
      sups.appendChild(c);
    })(j);
    row.appendChild(sups);
    return row;
  }

  // ───────────────────────────── arbre de classe ─────────────────────────────
  function paneCls() {
    var b = B(), c = CL[b.cls];
    pane.appendChild(h('p', 'bd-help', esc(F(T.ascHelp, { l: R.ascLevels.join(', ') }))));
    var p = c.passive || {};
    var top = h('div', 'bd-passive', img(c.icon) + '<div><span class="bd-mini">' + esc(T.passive) + ' · ' + esc(F(T.passiveAt, { n: p.level || 5 })) + '</span><b style="color:' + esc(c.color) + '">' + esc(p.name || c.name) + '</b><p>' + esc(p.desc || '') + '</p></div>');
    pane.appendChild(top);
    var CW = 180, RH = 130, maxX = 0, maxY = 0;
    c.tree.forEach(function (n) { maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); });
    var W = (maxX + 1) * CW, H = (maxY + 1) * RH + 20;
    var cv = h('div', 'bd-ctree'); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var pos = function (n) { return { x: n.x * CW + CW / 2, y: (n.y - 1) * RH + 50 }; };
    var svg = '<svg width="' + W + '" height="' + H + '">';
    c.tree.forEach(function (n) {
      n.links.forEach(function (l) {
        var o = clsNode(c, l); if (!o) return;
        var a = pos(n), z = pos(o), lit = b.asc.indexOf(n.id) >= 0 && b.asc.indexOf(l) >= 0;
        svg += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + z.x + '" y2="' + z.y + '" stroke="' + (lit ? esc(c.color) : '#3a4352') + '" stroke-width="' + (lit ? 4 : 2.5) + '"/>';
      });
      if (n.start) { var a2 = pos(n); svg += '<line x1="' + a2.x + '" y1="0" x2="' + a2.x + '" y2="' + a2.y + '" stroke="' + (b.asc.indexOf(n.id) >= 0 ? esc(c.color) : '#2a313d') + '" stroke-width="2" stroke-dasharray="4 5"/>'; }
    });
    cv.innerHTML = svg + '</svg>';
    c.tree.forEach(function (n) {
      var on = b.asc.indexOf(n.id) >= 0, can = ascCan(b, c, n), q = pos(n);
      var el = h('button', 'bd-cnode' + (on ? ' on' : can ? ' avail' : ''), img(n.icon) + '<span>' + esc(n.name) + '</span>');
      el.type = 'button'; el.style.left = (q.x - 34) + 'px'; el.style.top = (q.y - 34) + 'px'; el.style.setProperty('--cc', c.color);
      tip(el, '<strong style="color:' + esc(c.color) + '">' + esc(n.name) + '</strong><br>' + esc(n.desc || '') + (Object.keys(n.stats || {}).length ? '<br><br>' + statLines(n.stats, '#e2e8f0') : ''));
      el.addEventListener('click', function () { if (!on && ascCan(b, c, n)) { b.asc.push(n.id); changed(); } });
      el.addEventListener('contextmenu', function (e) {
        e.preventDefault(); if (!on) return;
        var rest = b.asc.filter(function (x) { return x !== n.id; });
        if (ascConnected(c, rest)) { b.asc = rest; changed(); }
      });
      cv.appendChild(el);
    });
    var sc = h('div', 'bd-scroll'); sc.appendChild(cv); pane.appendChild(sc);
  }

  // ───────────────────────────── talents ─────────────────────────────
  function paneTalents() {
    var b = B(), tt = b.talents;
    pane.appendChild(h('p', 'bd-help', esc(T.talents.help)));
    var gods = h('div', 'bd-gods');
    for (var i = 0; i < R.treeSlots; i++) (function (i) {
      var tid = tt.trees[i], t = TR[tid], open = treeOpen(b, i);
      var x = h('div', 'bd-god' + (t ? ' on' : '') + (open ? '' : ' locked'));
      if (t) x.style.setProperty('--gc', t.color);
      x.innerHTML = '<span class="bd-mini">' + esc(T.talents.gods) + ' ' + (i + 1) + '</span><b>' + esc(t ? t.name : (open ? T.talents.pick : F(T.talents.locked, { n: R.treeUnlock }))) + '</b>' +
        (t ? '<span class="bd-mini">' + treePts(b, tid) + ' pts</span>' : '');
      if (t) tip(x, '<strong style="color:' + esc(t.color) + '">' + esc(t.name) + '</strong><br>' + esc(t.desc || ''));
      x.addEventListener('click', function () {
        if (!open && !t) return;
        if (t && sessionStorage) { try { sessionStorage.setItem('bd-god', tid); } catch (e) {} if (x.classList.contains('cur')) return; renderPane(); return; }
        pickTree(b, i);
      });
      if (t) {
        var act = h('span', 'bd-god-act');
        var chg = h('button', 'bd-link', esc(T.talents.change)); chg.type = 'button';
        chg.addEventListener('click', function (e) { e.stopPropagation(); pickTree(b, i); });
        var rst = h('button', 'bd-link', esc(T.talents.reset)); rst.type = 'button';
        rst.addEventListener('click', function (e) { e.stopPropagation(); resetTree(b, tid); changed(); });
        var rm = h('button', 'bd-link', esc(T.talents.remove)); rm.type = 'button';
        rm.addEventListener('click', function (e) { e.stopPropagation(); resetTree(b, tid); tt.trees.splice(i, 1); changed(); });
        act.appendChild(chg); act.appendChild(rst); act.appendChild(rm); x.appendChild(act);
      }
      gods.appendChild(x);
    })(i);
    pane.appendChild(gods);
    var curTid; try { curTid = sessionStorage.getItem('bd-god'); } catch (e) {}
    if (tt.trees.indexOf(curTid) < 0) curTid = tt.trees[0];
    Array.prototype.forEach.call(gods.children, function (g, i) { if (tt.trees[i] === curTid) g.classList.add('cur'); });
    var t = TR[curTid];
    if (!t || !window.ASHFALL_MAKE_TREE) return;
    var holder = h('div', 'bd-scroll');
    var render = window.ASHFALL_MAKE_TREE(function (el, html) { tip(el, html); }, esc);
    render(holder, t, {
      alloc: tt.alloc, cores: tt.cores, points: treePts(b, t.id), labels: LB.stats, canSpend: spentTalents(b) < talentPts(b),
      onNode: function (n, d) {
        if (d > 0 && canAlloc(b, t, n)) { tt.alloc[n.id] = (tt.alloc[n.id] || 0) + 1; changed(); }
        else if (d < 0 && canRefund(b, t, n)) { tt.alloc[n.id]--; if (!tt.alloc[n.id]) delete tt.alloc[n.id]; changed(); }
      },
      onCore: function (tier, ev, el, clear) {
        var key = t.id + ':' + tier.tier;
        if (clear) { delete tt.cores[key]; changed(); return; }
        if (treePts(b, t.id) < (tier.need || 10)) return;
        picker(F(T.talents.pickCore, { n: tier.tier }), tier.choices.map(function (c) {
          return { id: c.id, name: c.name, icon: c.icon, sub: c.desc, cur: tt.cores[key] === c.id, tip: '<strong>' + esc(c.name) + '</strong><br>' + esc(c.desc || '') };
        }), function (id) { if (id) tt.cores[key] = id; else delete tt.cores[key]; changed(); }, { none: T.talents.clearCore, wide: true });
      },
    });
    pane.appendChild(holder);
  }
  function resetTree(b, tid) {
    var t = TR[tid]; if (!t) return;
    t.nodes.forEach(function (n) { delete b.talents.alloc[n.id]; });
    Object.keys(b.talents.cores).forEach(function (k) { if (k.indexOf(tid + ':') === 0) delete b.talents.cores[k]; });
  }
  function pickTree(b, i) {
    var tt = b.talents;
    picker(T.talents.pick, D.talents.trees.map(function (t) {
      return { id: t.id, name: t.name, sub: t.desc, swatch: t.color, color: t.color, off: tt.trees.indexOf(t.id) >= 0 && tt.trees[i] !== t.id,
        tip: '<strong style="color:' + esc(t.color) + '">' + esc(t.name) + '</strong><br>' + esc(t.desc || '') };
    }), function (id) {
      if (!id) return;
      if (tt.trees[i] && tt.trees[i] !== id) resetTree(b, tt.trees[i]);
      tt.trees[i] = id;
      try { sessionStorage.setItem('bd-god', id); } catch (e) {}
      changed();
    }, { wide: true });
  }

  // ───────────────────────────── Arbre des Terres ─────────────────────────────
  function paneAtlas() {
    var b = B();
    pane.appendChild(h('p', 'bd-help', esc(T.atlas.help) + ' — <b>' + esc(F(T.atlas.used, { n: b.atlas.length })) + '</b>'));
    var ids = Object.keys(ATLAS), minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    ids.forEach(function (id) { var n = ATLAS[id]; minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); });
    var pad = 60, W = maxX - minX + pad * 2, H = maxY - minY + pad * 2;
    var col = function (n) { return ((D.atlas.branches[n.branch] || {}).color) || '#99a6b8'; };
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', (minX - pad) + ' ' + (minY - pad) + ' ' + W + ' ' + H);
    svg.setAttribute('class', 'bd-atlas');
    var drawn = {};
    ids.forEach(function (id) {
      var n = ATLAS[id];
      (n.links || []).forEach(function (l) {
        var o = ATLAS[l]; if (!o || drawn[l + '|' + id]) return; drawn[id + '|' + l] = true;
        var on = (id === 'start' || b.atlas.indexOf(id) >= 0) && (l === 'start' || b.atlas.indexOf(l) >= 0);
        var ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', n.x); ln.setAttribute('y1', n.y); ln.setAttribute('x2', o.x); ln.setAttribute('y2', o.y);
        ln.setAttribute('stroke', on ? col(n.branch === 'none' ? o : n) : '#2f3747'); ln.setAttribute('stroke-width', on ? 5 : 3);
        svg.appendChild(ln);
      });
    });
    ids.forEach(function (id) {
      var n = ATLAS[id], on = id === 'start' || b.atlas.indexOf(id) >= 0;
      var can = !on && atlasReach(b.atlas, id);
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'an' + (on ? ' on' : can ? ' avail' : '') + ' t-' + n.type);
      var r = n.type === 'start' ? 34 : n.type === 'notable' ? 24 : 15;
      var shape = document.createElementNS(NS, n.type === 'notable' ? 'rect' : 'circle');
      if (n.type === 'notable') { shape.setAttribute('x', n.x - r); shape.setAttribute('y', n.y - r); shape.setAttribute('width', r * 2); shape.setAttribute('height', r * 2); shape.setAttribute('transform', 'rotate(45 ' + n.x + ' ' + n.y + ')'); }
      else { shape.setAttribute('cx', n.x); shape.setAttribute('cy', n.y); shape.setAttribute('r', r); }
      shape.setAttribute('fill', on ? col(n) : '#141821'); shape.setAttribute('stroke', can || on ? col(n) : '#3a4352'); shape.setAttribute('stroke-width', 4);
      g.appendChild(shape);
      var br = D.atlas.branches[n.branch] || {};
      tip(g, '<strong style="color:' + esc(col(n)) + '">' + esc(n.name) + '</strong>' + (br.name ? '   <span style="color:#7d8796">' + esc(br.name) + '</span>' : '') + '<br>' + esc(n.desc || ''));
      g.addEventListener('click', function () { if (can) { b.atlas.push(id); changed(); } });
      g.addEventListener('contextmenu', function (e) {
        e.preventDefault(); if (id === 'start' || !on) return;
        var rest = b.atlas.filter(function (x) { return x !== id; });
        if (rest.every(function (x) { return atlasReach(rest, x); })) { b.atlas = rest; changed(); }
      });
      svg.appendChild(g);
    });
    var legend = h('div', 'bd-legend');
    Object.keys(D.atlas.branches).forEach(function (k) { var x = D.atlas.branches[k]; if (x.name) legend.appendChild(h('span', null, '<i style="background:' + esc(x.color) + '"></i>' + esc(x.name))); });
    pane.appendChild(legend);
    var box = h('div', 'bd-atlas-box'); box.appendChild(svg); pane.appendChild(box);
  }

  // ───────────────────────────── système solaire ─────────────────────────────
  function paneSolar() {
    var b = B(), S = D.space.solar, r = solar(b);
    pane.appendChild(h('p', 'bd-help', esc(T.solar.help)));
    var wrap = h('div', 'bd-solar');
    // orrery
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-210 -210 420 420'); svg.setAttribute('class', 'bd-orrery');
    var sun = document.createElementNS(NS, 'circle'); sun.setAttribute('r', 26); sun.setAttribute('fill', 'url(#sun)');
    svg.innerHTML = '<defs><radialGradient id="sun"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#ffb347"/><stop offset="1" stop-color="#ff6a1a" stop-opacity=".2"/></radialGradient></defs>';
    svg.appendChild(sun);
    var radii = [80, 135, 190], ang = [-60, 30, 150];
    for (var i = 0; i < S.slots; i++) {
      var o = document.createElementNS(NS, 'circle'); o.setAttribute('r', radii[i]); o.setAttribute('fill', 'none'); o.setAttribute('stroke', '#2f3747'); o.setAttribute('stroke-dasharray', '3 6');
      svg.appendChild(o);
      var x = b.solar.slots[i], p = x && PLANETS[x.p];
      if (p) {
        var a = ang[i] * Math.PI / 180, pl = document.createElementNS(NS, 'circle');
        pl.setAttribute('cx', Math.cos(a) * radii[i]); pl.setAttribute('cy', Math.sin(a) * radii[i]); pl.setAttribute('r', 13 + (x.s || 1) * 1.5);
        pl.setAttribute('fill', p.planet || '#888'); pl.setAttribute('stroke', p.glow || '#fff'); pl.setAttribute('stroke-width', 2);
        svg.appendChild(pl);
      }
    }
    wrap.appendChild(svg);
    var cards = h('div', 'bd-orbits');
    for (var j = 0; j < S.slots; j++) (function (j) {
      var x = b.solar.slots[j], p = x && PLANETS[x.p], ln = r.lines[j];
      var c = h('div', 'bd-orbit');
      c.appendChild(h('div', 'bd-sec-title', esc((S.slot_names || [])[j] || ('#' + (j + 1))) + ' <small>' + esc(F(T.solar.mult, { k: num2(S.slot_mult[j]) })) + '</small>'));
      var pb = h('button', 'bd-pickbtn', p ? '<span class="sw" style="background:' + esc(p.planet) + ';box-shadow:0 0 10px ' + esc(p.glow) + '"></span><span>' + esc(p.name) + '</span><small>' + esc((D.space.families[p.family] || {}).name || '') + '</small>' : '<span>' + esc(T.solar.none) + '</span>');
      pb.type = 'button';
      pb.addEventListener('click', function () {
        picker(T.solar.planet, D.space.planets.map(function (q) {
          var fam = D.space.families[q.family] || {};
          return { id: q.id, name: q.name, swatch: q.planet, sub: (fam.name || '') + ' · ' + Object.keys(q.bonus || {}).map(function (k) { return statText(k, q.bonus[k]); }).join(' · '), tip: '<strong>' + esc(q.name) + '</strong><br><span style="color:' + esc(fam.color || '#fff') + '">' + esc(fam.name || '') + '</span><br>' + esc(q.desc || '') };
        }), function (id) { b.solar.slots[j] = id ? { p: id, s: (x && x.s) || 3 } : null; changed(); }, { none: T.solar.none, wide: true });
      });
      c.appendChild(pb);
      if (p) {
        var stars = h('div', 'bd-stars');
        for (var k = 1; k <= 5; k++) (function (k) {
          var st = h('button', 'bd-star' + (k <= x.s ? ' on' : ''), '★'); st.type = 'button';
          st.addEventListener('click', function () { x.s = k; changed(); });
          stars.appendChild(st);
        })(k);
        c.appendChild(field(T.solar.stars, stars));
        if (ln) c.appendChild(h('div', 'bd-orbit-st', '<small>' + esc(F(T.solar.mult, { k: num2(ln.k) })) + '</small><br>' + statLines(ln.stats, '#e8b04a')));
      }
      cards.appendChild(c);
    })(j);
    wrap.appendChild(cards);
    pane.appendChild(wrap);
    var tot = h('div', 'bd-solar-total');
    tot.appendChild(h('div', 'bd-field', '<span class="bd-flbl">' + esc(T.solar.combo) + '</span><b>' + esc(r.combo || '—') + '</b>'));
    tot.appendChild(h('div', 'bd-field', '<span class="bd-flbl">' + esc(T.solar.total) + '</span><div>' + (statLines(r.total, '#e8b04a') || '—') + '</div>'));
    pane.appendChild(tot);
  }

  function paneNotes() {
    var b = B(), ta = h('textarea', 'bd-notes'); ta.value = b.notes || ''; ta.placeholder = T.notes.ph;
    ta.addEventListener('input', function () { b.notes = ta.value; if (!temp) { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 400); } });
    pane.appendChild(ta);
  }

  // ───────────────────────────── démarrage ─────────────────────────────
  var hm = location.hash.match(/#b=([A-Za-z0-9_-]+)/);
  if (hm) decode(hm[1]).then(function (r) { temp = { id: '', name: r.name, data: r.data }; renderAll(); }, function () { toast(T.importBad); renderAll(); });
  else renderAll();
})();
