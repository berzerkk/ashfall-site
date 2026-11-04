const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const plain = value => String(value).replace(/\[\/?(?:b|i|u|color|font_size|center|url)(?:=[^\]]*)?\]/g,'');
const fieldNames = {name:'Nom', desc:'Description', description:'Description', base:'Base', req:'Niveau requis', tier:'Tier', slot:'Emplacement', kind:'Type',
  aps:'Attaques par seconde', cd:'Recharge (s)', time:'Temps de lancement (s)', mana:'Coût en mana', tags:'Mots-clés', baseStats:'Statistiques de base',
  implicit:'Implicite', aStats:'Affixes fixes', flags:'Effets', stats:'Statistiques', lore:'Histoire', mod:'Modificateurs', reqAny:'Compatibilité',
  tiers:'Paliers', isP:'Préfixe', w:'Poids', cat:'Catégorie', level:'Niveau', life:'Vie', dmg:'Dégâts', speed:'Vitesse', ai:'Comportement', xp:'Expérience',
  cost:'Coût / multiplicateur', radius:'Rayon', r:'Rayon', color:'Couleur', links:'Connexions', max:'Maximum', min:'Minimum', val:'Valeur',
  dMin:'Dégâts minimum de base', dMax:'Dégâts maximum de base', wMin:'Dégâts minimum', wMax:'Dégâts maximum', sMin:'Progression minimum', sMax:'Progression maximum',
  model:'Ressource du jeu (non affichée)', path:'Chemin', icon:'Icône source', text:'Description', role:'Rôle', parent:'Groupe'};
let catalogue, section = 'skills', selected = '', filter = '', limit = 120, requestActive = false;
let byId = new Map();
let iconDraft = null;
const order = [
  ['Personnage',['classes','ascensions','trees','talents','atlas']],
  ['Compétences',['skills','supports']],
  ['Équipement',['legendary','weapons','armor','shields','affixes','effects','materials','crafting','corruption']],
  ['Monde',['monsters','elites','levels','maps','tiers','props']],
  ['Référence',['codex','stats','skins','images','rules','other']],
];
function href(entry) { return '#' + entry.section + '/' + encodeURIComponent(entry.key); }
function icon(entry, large = false) {
  const fallback = typeof entry.data?.icon === 'string' ? Array.from(entry.data.icon).slice(0,3).join('') : '◇';
  return `<span class="icon${large ? ' large' : ''}" data-fallback="${escape(fallback)}" data-fallback-image="${escape(entry.fallbackImage || '')}">${entry.image ? `<img ${large ? '' : 'loading="lazy"'} src="${escape(entry.image)}" alt="${escape(entry.name)}">` : escape(fallback)}</span>`;
}
function statName(stat) {
  return (catalogue.statLabels[stat] || stat).replace(/^[+−-]?\{v\}\s*(?:%\s*)?(?:de |d['’])?/,'');
}
function statSentence(stat, value) { return (catalogue.statLabels[stat] || `${stat} : {v}`).replaceAll('{v}',String(value)).replace('+-','−'); }
function secondary(entry) {
  if (['legendary','weapons','armor','shields'].includes(entry.section)) return [catalogue.kindLabels[entry.data.kind] || catalogue.slotLabels[entry.data.slot] || catalogue.slotLabels[entry.parent],entry.data.req != null ? `Niv. ${entry.data.req}` : ''].filter(Boolean).join(' · ');
  return (entry.parent ? (catalogue.slotLabels[entry.parent] || entry.parent) + ' · ' : '') + entry.id;
}
function badge(entry) { return entry.section === 'legendary' ? `<span class="badge t${Number(entry.data.tier) || 4}">T${Number(entry.data.tier) || 4}</span>` : ''; }
function navigation() {
  const link = id => { const s = catalogue.sections.find(s => s.id === id); return s ? `<a href="#${id}" class="${section === id ? 'active' : ''}"><span>${escape(s.name)}</span><small>${s.count}</small></a>` : ''; };
  $('#navigation').innerHTML = `<a href="#all" class="${section === 'all' ? 'active' : ''}"><span>Tout le contenu</span><small>${catalogue.entries.length}</small></a>` + order.map(([group, ids]) => `<div class="nav-group">${group}</div>${ids.map(link).join('')}`).join('') + `<div class="nav-group">Analyse</div><a class="nav-sources ${section === 'curves' ? 'active' : ''}" href="#curves"><span>Progression</span></a>`;
}
function facetValue(entry) {
  if (section === 'legendary') return 'T' + entry.data.tier;
  return entry.parent || entry.data?.kind || entry.data?.type || entry.data?.cat || '';
}
function prepareFacet() {
  const values = [...new Set(catalogue.entries.filter(e => e.section === section).map(facetValue).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b),'fr'));
  $('#facet').hidden = values.length < 2;
  $('#facet').innerHTML = '<option value="">Tous les types</option>' + values.map(v => `<option value="${escape(v)}">${escape(catalogue.slotLabels[v] || v)}</option>`).join('');
  if (!values.includes(filter)) filter = '';
  $('#facet').value = filter;
}
function sourceEntries() { return catalogue.sources.map(s => ({key:s.id, section:'sources', id:s.id, name:s.id, source:s.id, pointer:'', description:s.format === 'json' ? 'Données JSON complètes' : 'Constantes et code source du jeu', data:s.data, notices:s.notices, code:s.code})); }
function candidates() {
  const query = fold($('#search').value).trim();
  return (section === 'sources' ? sourceEntries() : catalogue.entries.filter(e => section === 'all' || e.section === section)).filter(e =>
    (!filter || facetValue(e) === filter) && (!query || fold([e.name,e.id,e.parent || '',JSON.stringify(e.data)].join(' ')).includes(query)));
}
function renderList() {
  if (section === 'prompts') {
    $('#count').textContent = '4 modèles';
    $('#results').innerHTML = '<p class="empty">Modèles de prompt partagés par famille.</p>';
    $('#detail').innerHTML = promptSettingsView();
    fillPromptSettings();
    return;
  }
  if (section === 'todo') {
    $('#count').textContent = 'feuille de route';
    $('#results').innerHTML = '<p class="empty">Points à améliorer et contenu à produire.</p>';
    $('#detail').innerHTML = todoView();
    fillTodo();
    return;
  }
  if (section === 'sounds') {
    $('#count').textContent = 'bibliothèque';
    $('#results').innerHTML = '<p class="empty">Sons du jeu.</p>';
    $('#detail').innerHTML = soundsView();
    fillSounds();
    return;
  }
  if (section === 'curves') {
    $('#count').textContent = '11 graphiques';
    $('#results').innerHTML = '<p class="empty">Courbes de progression calculées depuis le code du jeu.</p>';
    $('#detail').innerHTML = curvesView();
    return;
  }
  const rows = candidates();
  $('#count').textContent = `${rows.length} ${rows.length > 1 ? 'entrées' : 'entrée'}`;
  if (!rows.some(e => e.key === selected)) selected = rows[0]?.key || '';
  const position = rows.findIndex(e => e.key === selected);
  if (position >= limit) limit = Math.ceil((position + 1) / 120) * 120;
  $('#results').innerHTML = rows.slice(0,limit).map(e => `<a class="result ${selected === e.key ? 'active' : ''}" href="${href(e)}">${section === 'sources' ? '' : icon(e)}<span class="result-text"><span class="result-name">${escape(e.name)}</span><span class="result-id">${escape(secondary(e))}</span></span></a>`).join('') || '<p class="empty">Aucune entrée ne correspond à cette recherche.</p>';
  if (rows.length > limit) $('#results').insertAdjacentHTML('beforeend', '<button class="result more">Afficher les 120 entrées suivantes</button>');
  $('#detail').innerHTML = rows.length ? detail(rows.find(e => e.key === selected)) : '<p class="empty">Les données sont lues directement dans le jeu.</p>';
  hydrateIconPanel();
}
function affixRolls(entry) {
  const p = entry.affixPools;
  if (!p) return '';
  const labels = catalogue.statLabels || {};
  const chip = (a) => {
    const stat = String(a.stat);
    const label = labels[stat] || stat;
    return '<a class="affix-chip" href="#stats" title="' + escape(stat) + '">' +
      '<b>' + escape(label) + '</b></a>';
  };
  const group = (list, label) => list.length
    ? '<div class="affix-group"><h4>' + label + ' <small>(' + list.length + ')</small></h4><div class="affix-chips">' + list.map(chip).join('') + '</div></div>'
    : '';
  return '<h3>Affixes possibles</h3>' + group(p.prefixes, 'Préfixes') + group(p.suffixes, 'Suffixes');
}

// ─── Progression : formules du jeu (garder synchronisé avec main.gd / enemy.gd / skills.gd / loot.gd) ───
const MAX_LEVEL = 100;
const fr = (v, d = 0) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });
const kfmt = (v) => (v >= 1e6 ? fr(v / 1e6, 1) + 'M' : v >= 1000 ? fr(v / 1000, v >= 10000 ? 0 : 1) + 'k' : fr(v, v < 10 ? 1 : 0));
// main.gd xp_to_next
function xpToNext(n) { let b = 30 * Math.pow(n, 1.55) + 20 * n; if (n > 55) b *= Math.pow(1.07, n - 55); return Math.round(b); }
// enemy.gd : XP d'un monstre, PV / dégâts de base, PV resserrés (hors boss)
function monXp(base, lvl) { return base * (1 + 0.18 * (lvl - 1)) * (1 + 0.015 * (lvl - 1)); }
function lifeBase(b) { return 30 * Math.pow(Math.max(1, b) / 30, 0.75); }
function monLife(base, lvl) { return base * (1 + (lvl - 1) * 0.22) * Math.pow(1.045, lvl - 1); }
function monDmg(base, lvl) { const early = 1 + 0.5 * Math.min(1, Math.max(0, 1 - lvl / 14)); return base * (1 + (lvl - 1) * 0.14) * Math.pow(1.022, lvl - 1) * early; }
// data.gd curve()
function curveVal(curves, name, lvl) {
  const c = (curves || {})[name]; if (!c) return 0;
  const t = Math.min(1, Math.max(0, (lvl - (c.start || 0)) / Math.max(1, (c.end || 100) - (c.start || 0))));
  return (c.max || 0) * Math.pow(t, c.pow || 1);
}
// main.gd _populate : chances de groupe magique / rare
function eliteChances(curves, lvl) {
  const ramp = Math.min(1, Math.max(0, (lvl - 1) / 12));
  return { rare: 0.015 + (0.10 - 0.015) * ramp + curveVal(curves, 'rare', lvl), magic: 0.06 + (0.18 - 0.06) * ramp + curveVal(curves, 'magic', lvl) };
}
const ACT_COLORS = { ashwood: '#7fd44a', desert: '#e8c46a', volcano: '#ff7a5a', coast: '#5ac8e8' };

function chartFrame(label, body, extra = '') {
  return '<figure class="chart"><figcaption>' + escape(label) + extra + '</figcaption>' + body + '</figure>';
}

// Courbes multiples : series = [{name, color, points:[{x, y, tip}], dash}] ; abscisses communes (indices).
// opts : label, fmt, log (échelle log), note (texte sous le titre), xs (libellés), bandColors (fond par x).
function svgMulti(series, opts) {
  const o = Object.assign({ w: 780, h: 260, pad: 46, label: '', fmt: (v) => kfmt(v), log: false, note: '' }, opts || {});
  const all = series.flatMap((s) => s.points.map((p) => p.y)).filter((v) => isFinite(v));
  const n = Math.max(...series.map((s) => s.points.length));
  const minPos = Math.max(1e-6, Math.min(...all.filter((v) => v > 0)));
  const maxY = (Math.max(...all) || 1) * 1.06;
  const innerW = o.w - o.pad * 2, innerH = o.h - o.pad * 2;
  const x = (i) => o.pad + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const ly = (v) => Math.log10(Math.max(minPos, v));
  const y = o.log ? (v) => o.pad + innerH - ((ly(v) - ly(minPos)) / Math.max(1e-6, ly(maxY) - ly(minPos))) * innerH
    : (v) => o.pad + innerH - (v / maxY) * innerH;
  const gridVals = o.log ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.pow(10, ly(minPos) + (ly(maxY) - ly(minPos)) * f)) : [0, 0.25, 0.5, 0.75, 1].map((f) => maxY * f);
  const grid = gridVals.map((v) => { const yy = y(v); return '<line x1="' + o.pad + '" y1="' + yy.toFixed(1) + '" x2="' + (o.w - o.pad) + '" y2="' + yy.toFixed(1) + '" stroke="#ffffff16"/><text x="' + (o.pad - 6) + '" y="' + (yy + 4).toFixed(1) + '" fill="#ffffff60" font-size="10" text-anchor="end">' + escape(o.fmt(v)) + '</text>'; }).join('');
  const xsrc = series[0].points;
  const tickEvery = Math.max(1, Math.round(n / 12));
  const ticks = xsrc.map((p, i) => (i % tickEvery === 0 || i === n - 1) ? '<text x="' + x(i).toFixed(1) + '" y="' + (o.h - o.pad + 16) + '" fill="#ffffff60" font-size="10" text-anchor="middle">' + escape(String(p.x)) + '</text>' : '').join('');
  const bands = o.bandColors ? xsrc.map((p, i) => { const bw = innerW / Math.max(1, n - 1); return '<rect x="' + Math.max(o.pad, x(i) - bw / 2).toFixed(1) + '" y="' + o.pad + '" width="' + bw.toFixed(1) + '" height="' + innerH + '" fill="' + o.bandColors[i] + '" fill-opacity="0.07"/>'; }).join('') : '';
  const lines = series.map((s) => '<polyline fill="none" stroke="' + s.color + '" stroke-width="2.2"' + (s.dash ? ' stroke-dasharray="6 4"' : '') + ' points="' + s.points.map((p, i) => x(i).toFixed(1) + ',' + y(p.y).toFixed(1)).join(' ') + '"/>').join('');
  const band = innerW / Math.max(1, n - 1);
  const hover = xsrc.map((p, i) => '<rect x="' + Math.max(o.pad, x(i) - band / 2).toFixed(1) + '" y="' + o.pad + '" width="' + band.toFixed(1) + '" height="' + innerH + '" fill="#000" fill-opacity="0" pointer-events="all"><title>' +
    escape(String(p.x) + '\n' + series.map((s) => s.name + ' : ' + (s.points[i] ? (s.points[i].tip || o.fmt(s.points[i].y)) : '—')).join('\n')) + '</title></rect>').join('');
  const legend = series.length > 1 ? ' <span class="chart-legend">' + series.map((s) => '<span style="color:' + s.color + '">■ ' + escape(s.name) + '</span>').join(' ') + '</span>' : '';
  return chartFrame(o.label, (o.note ? '<p class="chart-note">' + escape(o.note) + '</p>' : '') +
    '<svg viewBox="0 0 ' + o.w + ' ' + o.h + '" role="img" aria-label="' + escape(o.label) + '">' + bands + grid + lines + ticks + hover + '</svg>', legend);
}

function svgBars(items, opts) {
  const o = Object.assign({ w: 780, h: 230, pad: 40, label: '', color: '#7fd44a', note: '' }, opts || {});
  const maxY = Math.max.apply(null, items.map((i) => i.y)) * 1.12 || 1;
  const innerW = o.w - o.pad * 2, innerH = o.h - o.pad * 2;
  const bw = innerW / items.length;
  const bars = items.map((it, i) => {
    const bh = (it.y / maxY) * innerH;
    const left = o.pad + i * bw + bw * 0.15;
    return '<rect x="' + left.toFixed(1) + '" y="' + (o.pad + innerH - bh).toFixed(1) + '" width="' + (bw * 0.7).toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + (it.color || o.color) + '" rx="3">' +
      '<title>' + escape(it.tip || (it.x + ' → ' + it.v)) + '</title></rect>' +
      '<text x="' + (left + bw * 0.35).toFixed(1) + '" y="' + (o.h - o.pad + 15) + '" fill="#ffffff60" font-size="9" text-anchor="middle">' + escape(it.x) + '</text>' +
      '<text x="' + (left + bw * 0.35).toFixed(1) + '" y="' + (o.pad + innerH - bh - 5).toFixed(1) + '" fill="#ffffff90" font-size="9" text-anchor="middle">' + escape(it.v) + '</text>';
  }).join('');
  return chartFrame(o.label, (o.note ? '<p class="chart-note">' + escape(o.note) + '</p>' : '') + '<svg viewBox="0 0 ' + o.w + ' ' + o.h + '" role="img" aria-label="' + escape(o.label) + '">' + bars + '</svg>');
}

// Simulation de la campagne puis des cauchemars : une passe par zone, tous les monstres tués.
function simulateProgress(M, L) {
  const zones = [];
  let lvl = 1, xp = 0;
  const curves = M.curves || {};
  const playZone = (z, zl, actId, tierId) => {
    const pool = Object.entries(z.pool || {});
    const tw = pool.reduce((a, [, w]) => a + w, 0) || 1;
    const mult = (M.maps.find((m) => m.id === actId) || {}).mult || {};
    let avgXp = 0, avgLife = 0, avgDps = 0, avgSpd = 0;
    for (const [t, w] of pool) {
      const d = M.monsters[t]; if (!d) continue; const k = w / tw;
      avgXp += k * monXp(d.xp, zl);
      avgLife += k * monLife(d.boss ? d.life : lifeBase(d.life), zl) * (mult.hp || 1);
      avgDps += k * monDmg(d.dmg, zl) * (mult.dmg || 1) / (d.atkTime || 1);
      avgSpd += k * d.speed * (mult.speed || 1);
    }
    const tier = (M.tiers || []).find((t) => t.id === tierId) || { hp: 1, dmg: 1 };
    const packs = ((L[z.id] || {}).packs || []).length || z.packs || 28;
    const count = 4.2 * (1 + curveVal(curves, 'density', zl));
    const ec = eliteChances(curves, zl);
    const eliteXp = 1 + ec.magic * 1.2 + ec.rare / count * 4;
    const zxp = packs * count * avgXp * eliteXp + monXp((M.monsters[z.boss] || { xp: 100 }).xp, zl);
    const before = lvl;
    xp += zxp;
    while (lvl < MAX_LEVEL && xp >= xpToNext(lvl)) { xp -= xpToNext(lvl); lvl++; }
    zones.push({ id: z.id + (tierId ? ' C' + tierId : ''), zl, act: actId, before, after: lvl, frac: lvl + (lvl < MAX_LEVEL ? xp / xpToNext(lvl) : 0), xp: zxp,
      life: avgLife * (tier.hp || 1), dps: avgDps * (tier.dmg || 1), speed: avgSpd, count, packs });
  };
  const all = [];
  for (const map of M.maps || []) for (const z of map.levels || []) all.push([z, map.id]);
  all.forEach(([z, act]) => playZone(z, z.lvl, act, 0));
  for (const t of (M.tiers || []).filter((t) => t.id > 0)) all.forEach(([z, act], i) => playZone(z, Math.min(100, (t.lvlAdd || 58) + Math.round(0.8 * i)), act, t.id));
  return zones;
}

function curvesView() {
  const src = (id) => catalogue.sources.find((s) => s.id === id)?.data || {};
  const M = src('data/monsters.json'), L = src('data/levels.json');
  const tiers = Array.isArray(M.tiers) ? M.tiers : [];
  const curves = M.curves || {};
  const out = [];
  out.push('<p class="technical">Formules recopiées du jeu (<code>xp_to_next</code>, <code>_mon_life</code>, <code>_mon_dmg</code>, <code>Data.curve</code>, <code>repeat_count</code>, <code>loot.drop_for</code>) et données de <code>data/monsters.json</code> (multiplicateurs d’acte, courbes, paliers). Survole un graphique pour lire les valeurs. La simulation suppose une passe par zone avec tous les monstres tués.</p>');

  // 1. Niveau du joueur vs niveau des zones
  const sim = simulateProgress(M, L);
  const bandColors = sim.map((z) => ACT_COLORS[z.act] || '#888');
  out.push(svgMulti([
    { name: 'Niveau des zones', color: '#ff7a7a', points: sim.map((z) => ({ x: z.id, y: z.zl, tip: 'zone niv. ' + z.zl })) },
    { name: 'Niveau du joueur (fin de zone)', color: '#e8c46a', points: sim.map((z) => ({ x: z.id, y: z.frac, tip: 'joueur ' + z.before + ' → ' + z.after })) },
  ], { label: 'Progression simulée : joueur vs zones (campagne puis Cauchemar I → IV)', fmt: (v) => fr(v), bandColors, note: 'Fond coloré = acte (vert forêt, jaune désert, rouge volcan, bleu côte). Écart > 0 : le joueur est en avance.' }));

  // 2. Niveaux gagnés par zone
  out.push(svgBars(sim.map((z) => ({ x: z.id.replace(' C', '·'), y: Math.max(0.01, z.frac - (sim[sim.indexOf(z) - 1]?.frac ?? 1)), v: '', color: ACT_COLORS[z.act], tip: z.id + ' : +' + fr(z.frac - (sim[sim.indexOf(z) - 1]?.frac ?? 1), 2) + ' niveau(x), ' + kfmt(z.xp) + ' XP' })),
    { label: 'Niveaux gagnés par zone', note: 'Une barre par zone (campagne puis cauchemars) : repère les zones où l’on monte trop vite ou trop lentement.' }));

  // 3. XP par niveau (log)
  const xpPts = []; for (let l = 1; l < MAX_LEVEL; l++) xpPts.push({ x: l, y: xpToNext(l) });
  out.push(svgMulti([{ name: 'XP requise', color: '#e8c46a', points: xpPts }], { label: 'XP requise pour le niveau suivant (échelle logarithmique)', log: true, note: 'Plus raide au-delà du niveau 55 (×1,07 par niveau).' }));

  // 4. PV / DPS / vitesse moyens par zone
  const zoneSeries = (key, color, name, fmt) => ({ name, color, points: sim.map((z) => ({ x: z.id, y: z[key], tip: fmt(z[key]) })) });
  out.push(svgMulti([zoneSeries('life', '#ff7a7a', 'PV moyens', (v) => kfmt(v))], { label: 'PV moyens d’un monstre par zone (log)', log: true, bandColors }));
  out.push(svgMulti([zoneSeries('dps', '#7f9cff', 'DPS moyen', (v) => fr(v, 1))], { label: 'Dégâts par seconde moyens d’un monstre par zone (log)', log: true, bandColors }));
  out.push(svgMulti([zoneSeries('speed', '#7fd44a', 'Vitesse', (v) => fr(v))], { label: 'Vitesse moyenne des monstres par zone', bandColors, fmt: (v) => fr(v) }));

  // 5. Densité et rareté selon le niveau de zone
  const dens = [], rare = [], magic = [];
  for (let l = 1; l <= MAX_LEVEL; l++) {
    const ec = eliteChances(curves, l);
    dens.push({ x: l, y: 4 * (1 + curveVal(curves, 'density', l)), tip: fr(4 * (1 + curveVal(curves, 'density', l)), 2) + ' monstres / groupe' });
    rare.push({ x: l, y: ec.rare * 100, tip: fr(ec.rare * 100, 1) + ' %' });
    magic.push({ x: l, y: ec.magic * 100, tip: fr(ec.magic * 100, 1) + ' %' });
  }
  out.push(svgMulti([{ name: 'Monstres par groupe (base 4)', color: '#e8c46a', points: dens }], { label: 'Taille des groupes selon le niveau de zone', fmt: (v) => fr(v, 1), note: 'monsters.json → curves.density' }));
  out.push(svgMulti([{ name: 'Groupe magique %', color: '#6aa8ff', points: magic }, { name: 'Groupe rare %', color: '#ffd84a', points: rare }], { label: 'Chance de groupe d’élite selon le niveau de zone', fmt: (v) => fr(v, 0) + ' %' }));

  // 6. PV de base des monstres : brut vs resserré
  const mons = Object.entries(M.monsters || {}).filter(([, d]) => !d.boss && d.life < 1e6 && d.life > 0).sort((a, b) => a[1].life - b[1].life);
  out.push(svgMulti([
    { name: 'PV de base (données)', color: '#ffffff80', dash: true, points: mons.map(([k, d]) => ({ x: k, y: d.life })) },
    { name: 'PV effectifs (30·(PV/30)^0,75)', color: '#ff7a7a', points: mons.map(([k, d]) => ({ x: k, y: lifeBase(d.life), tip: fr(lifeBase(d.life), 1) })) },
  ], { label: 'PV de base par monstre (hors boss)', fmt: (v) => fr(v) }));

  // 7. Butin par palier
  out.push(svgMulti([
    { name: 'Quantité d’objets %', color: '#7fd44a', points: tiers.map((t) => ({ x: t.name, y: Number(t.qty) || 0 })) },
    { name: 'Rareté (MF) %', color: '#ffd84a', points: tiers.map((t) => ({ x: t.name, y: Number(t.mf) || 0 })) },
    { name: 'PV ×100', color: '#ff7a7a', dash: true, points: tiers.map((t) => ({ x: t.name, y: (Number(t.hp) || 1) * 100 })) },
    { name: 'Dégâts ×100', color: '#7f9cff', dash: true, points: tiers.map((t) => ({ x: t.name, y: (Number(t.dmg) || 1) * 100 })) },
  ], { label: 'Paliers de difficulté : butin et monstres', fmt: (v) => fr(v) }));

  // 8. Répétitions (Écho / Frappe multiple)
  const rep = [];
  for (let p = 0; p <= 300; p += 10) {
    const sure = Math.floor(p / 100), f = (p % 100) / 100;
    const e = (n) => (1 + n) * (1 + 0.05 * n);
    const mult = (1 - f) * e(sure) + f * e(sure + 1);
    rep.push({ x: p + ' %', y: mult, tip: '×' + fr(mult, 2) + ' dégâts par lancer' });
  }
  out.push(svgMulti([{ name: 'Multiplicateur moyen', color: '#c58aff', points: rep }], { label: 'Écho / Frappe multiple : dégâts moyens par lancer selon la chance de répétition', fmt: (v) => '×' + fr(v, 1), note: 'Chaque répétition rejoue le coup et ajoute +5 % de dégâts à tout le lancer ; au-delà de 100 %, plusieurs répétitions.' }));

  return '<div class="charts">' + out.join('') + '</div>';
}

function promptSettingsView() {
  return '<div class="prompt-settings"></div>';
}

async function fillPromptSettings() {
  const box = $('.prompt-settings');
  if (!box) return;
  const response = await fetch('/api/prompt/templates', { cache: 'no-store' });
  const templates = await response.json().catch(() => ({}));
  templatesCache = templates;
  const ids = Object.keys(templates).sort();
  box.innerHTML =
    '<p class="technical">Un modèle par famille. La partie spécifique de chaque icône est stockée à part et reste modifiable fiche par fiche. Le prompt envoyé = modèle + partie spécifique.</p>' +
    ids.map((id) =>
      '<div class="tpl"><div class="tpl-head"><h4>' + escape(id) + '</h4>' +
      '<button class="tpl-remove" type="button" data-id="' + escape(id) + '">Supprimer</button></div>' +
      '<textarea class="tpl-text" data-id="' + escape(id) + '" rows="5" spellcheck="false">' + escape(templates[id]) + '</textarea></div>'
    ).join('') +
    '<div class="tpl-add"><label class="icon-field">Nouveau modèle (identifiant)<input class="tpl-new-id" type="text" placeholder="ex. talent" maxlength="24"></label>' +
    '<button class="tpl-add-btn" type="button">Créer</button></div>' +
    '<div class="icon-row"><button class="tpl-save" type="button">Enregistrer les modèles</button><span class="tpl-status"></span></div>';
}

async function savePromptSettings(button) {
  const box = button.closest('.prompt-settings');
  const status = box.querySelector('.tpl-status');
  const payload = {};
  for (const area of box.querySelectorAll('.tpl-text')) payload[area.dataset.id] = area.value;
  try {
    const response = await fetch('/api/prompt/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'échec');
    templatesCache = data.templates;
    status.textContent = ' modèles enregistrés';
    status.className = 'tpl-status ok';
  } catch (error) {
    status.textContent = ' ' + error.message;
    status.className = 'tpl-status ko';
  }
}

async function addPromptTemplate(button) {
  const box = button.closest('.prompt-settings');
  const input = box.querySelector('.tpl-new-id');
  const id = (input.value || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,24}$/.test(id)) { box.querySelector('.tpl-status').textContent = ' identifiant invalide (a-z, 0-9, - et _, 2 à 24)'; return; }
  const payload = {};
  for (const area of box.querySelectorAll('.tpl-text')) payload[area.dataset.id] = area.value;
  payload[id] = payload[id] || 'Polished fantasy game icon in the style of Torchlight Infinite, smooth rendered painting, vivid saturated colours, square full-bleed composition, one bold central subject, strong colour contrast, no text, no letters, no border, no frame, no UI';
  const response = await fetch('/api/prompt/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { box.querySelector('.tpl-status').textContent = ' ' + (data.error || 'échec'); return; }
  templatesCache = data.templates;
  await fillPromptSettings();
}

async function removePromptTemplate(button) {
  const box = button.closest('.prompt-settings');
  const id = button.dataset.id;
  const payload = {};
  for (const area of box.querySelectorAll('.tpl-text')) payload[area.dataset.id] = area.value;
  payload[id] = '';
  const response = await fetch('/api/prompt/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { box.querySelector('.tpl-status').textContent = ' ' + (data.error || 'échec'); return; }
  templatesCache = data.templates;
  await fillPromptSettings();
}

function soundsView() {
  return '<div class="sounds"><p class="technical">Sons synthétisés par le jeu, exportés en WAV (<code>sfxdump</code> dans la console de debug). Modifier un son = modifier <code>scripts/game/sfx.gd</code> puis relancer <code>sfxdump</code>.</p><div class="sounds-list"><p class="empty">Chargement…</p></div></div>';
}

async function fillSounds() {
  const box = $('.sounds-list');
  if (!box) return;
  let data;
  try { data = await (await fetch('sfx.json', { cache: 'no-store' })).json(); }
  catch { box.innerHTML = '<p class="empty">Liste des sons indisponible.</p>'; return; }
  if (!data.count) {
    box.innerHTML = '<p class="empty">Aucun son exporté. Lance <code>sfxdump</code> dans la console du jeu (touche ²).</p>';
    return;
  }
  const needle = ($('#search').value || '').toLowerCase();
  const rows = data.sounds.filter((s) => !needle || s.name.toLowerCase().includes(needle));
  box.innerHTML = '<p class="technical">' + rows.length + ' / ' + data.count + ' son(s) — ' + escape(data.dir) + '</p>' +
    rows.map((s) =>
      '<div class="sound-row"><span class="sound-name">' + escape(s.name) + '</span>' +
      '<audio controls preload="none" src="sfx/' + encodeURIComponent(s.file) + '"></audio>' +
      '<span class="sound-size">' + (s.bytes / 1024).toFixed(0) + ' Ko</span></div>'
    ).join('');
}

function todoView() {
  return '<div class="todo"><p class="technical">Feuille de route du projet, comparée aux références du genre. Clique une ligne pour la marquer faite ou à refaire.</p>' +
    '<div class="todo-filters">' +
    '<label class="icon-field">Axe<select id="todo-axis"><option value="">tous</option></select></label>' +
    '<label class="icon-field">Priorité<select id="todo-priority"><option value="">toutes</option><option value="P0">P0 — bloquant</option><option value="P1">P1 — important</option><option value="P2">P2 — utile</option><option value="P3">P3 — plus tard</option></select></label>' +
    '<label class="icon-field">Statut<select id="todo-status"><option value="">tous</option><option value="todo">à faire</option><option value="done">fait</option></select></label>' +
    '<span class="todo-counts"></span>' +
    '</div><div class="todo-list"></div></div>';
}

let todoData = null;

async function fillTodo() {
  const box = $('.todo-list');
  if (!box) return;
  if (!todoData) {
    try { todoData = await (await fetch('todo.json', {cache:'no-store'})).json(); }
    catch { box.innerHTML = '<p class="empty">TODO indisponible (data/todo.json).</p>'; return; }
    const axisSelect = $('#todo-axis');
    if (axisSelect && axisSelect.options.length <= 1) {
      for (const a of todoData.axes) {
        const o = document.createElement('option');
        o.value = a.id; o.textContent = a.label;
        axisSelect.appendChild(o);
      }
    }
  }
  const axis = $('#todo-axis')?.value || '';
  const priority = $('#todo-priority')?.value || '';
  const status = $('#todo-status')?.value || '';
  const labels = Object.fromEntries(todoData.axes.map((a) => [a.id, a.label]));
  const items = todoData.items.filter((i) => (!axis || i.axis === axis) && (!priority || i.priority === priority) && (!status || i.status === status));

  const total = todoData.items.length;
  const done = todoData.items.filter((i) => i.status === 'done').length;
  const p0 = todoData.items.filter((i) => i.priority === 'P0' && i.status !== 'done').length;
  const counts = $('.todo-counts');
  if (counts) counts.innerHTML = '<b>' + done + '</b> / ' + total + ' fait · <b>' + p0 + '</b> bloquant(s) restant(s)';

  const byAxis = new Map();
  for (const it of items) {
    if (!byAxis.has(it.axis)) byAxis.set(it.axis, []);
    byAxis.get(it.axis).push(it);
  }
  const order = ['P0', 'P1', 'P2', 'P3'];
  box.innerHTML = [...byAxis.entries()].map(([id, list]) =>
    '<section class="todo-axis"><h4>' + escape(labels[id] || id) + ' <small>(' + list.length + ')</small></h4>' +
    list.sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority)).map((it) =>
      '<article class="todo-item ' + (it.status === 'done' ? 'done' : '') + '" data-id="' + escape(it.id) + '">' +
      '<button class="todo-toggle" type="button" aria-label="basculer">' + (it.status === 'done' ? '✓' : '○') + '</button>' +
      '<div class="todo-body"><div class="todo-title"><span class="prio ' + String(it.priority || 'p3').toLowerCase() + '">' + it.priority + '</span> ' + escape(it.title) + '</div>' +
      '<div class="todo-detail">' + escape(it.detail) + '</div>' +
      (it.compare && it.compare !== '—' ? '<div class="todo-compare">Référence : ' + escape(it.compare) + '</div>' : '') +
      '</div></article>'
    ).join('') + '</section>'
  ).join('') || '<p class="empty">Aucun élément pour ces filtres.</p>';
}

async function toggleTodo(button) {
  const card = button.closest('.todo-item');
  const id = card.dataset.id;
  const item = todoData.items.find((i) => i.id === id);
  if (!item) return;
  const next = item.status === 'done' ? 'todo' : 'done';
  try {
    const res = { ok: false, json: async () => ({ error: 'Wiki en lecture seule.' }) };
    const data = await res.json();
    if (!res.ok) throw Error(data.error || 'échec');
    item.status = next;
    await fillTodo();
  } catch (error) {
    console.error(error);
  }
}

function iconPanel(entry) {
  const key = entry.resolvedIconKey || entry.iconKey;
  return '<section class="icon-panel" data-key="' + escape(key) + '">' +
    '<h3>Icône générée</h3>' +
    '<div class="icon-sizes" data-sizes></div>' +
    '<div class="icon-staged" data-staged hidden><h4>Nouvelle version — en attente de validation</h4><div class="icon-sizes" data-staged-sizes></div>' +
    '<div class="icon-row"><button class="icon-keep" type="button">Garder la nouvelle</button><button class="icon-drop" type="button">Jeter</button><span class="icon-staged-status"></span></div></div>' +
    '<div class="icon-row">' +
    '<label class="icon-field">Modèle de prompt<select class="icon-family"></select></label>' +
    '<button class="icon-generate" type="button">Générer</button>' +
    '<span class="icon-status"></span>' +
    '</div>' +
    '<div class="icon-progress" data-progress hidden><div class="icon-progress-bar"></div></div>' +
    '<label class="icon-field">Partie spécifique du prompt<textarea class="icon-prompt" rows="6" spellcheck="false" placeholder="Chargement du prompt…"></textarea></label>' +
    '<details class="icon-details"><summary>Journal de génération</summary><pre class="raw icon-log">—</pre></details>' +
    '</section>';
}

function iconSizes(rel) {
  if (!rel) return '<p class="technical">Aucune image enregistrée pour cette icône.</p>';
  const dir = rel.replace(/\.[^.]+$/, '');
  const base = dir.split('/').pop();
  const files = [['512', dir + '/' + base + '.png'], ['256', dir + '/' + base + '_256.png'], ['128', dir + '/' + base + '_128.png'], ['64', dir + '/' + base + '_64.png']];
  const stamp = Date.now();
  return files.map(function (pair) {
    return '<figure class="icon-size"><img loading="lazy" src="/generated-icons/' + escape(pair[1]) + '?v=' + stamp + '" alt="' + pair[0] + ' px" data-focus="' + escape(pair[1]) + '"><figcaption>' + pair[0] + ' px</figcaption></figure>';
  }).join('');
}

let templatesCache = null;

async function templateIds() {
  if (!templatesCache) {
    try { templatesCache = await (await fetch('/api/prompt/templates', { cache: 'no-store' })).json(); }
    catch { templatesCache = {}; }
  }
  return Object.keys(templatesCache).sort();
}

async function hydrateIconPanel() {
  const panel = $('.icon-panel');
  if (!panel) return;
  const key = panel.dataset.key;
  const area = panel.querySelector('.icon-prompt');
  const sizes = panel.querySelector('[data-sizes]');
  const ids = await templateIds();
  const select = panel.querySelector('.icon-family');
  if (ids.length) select.innerHTML = ids.map(function (id) { return '<option value="' + escape(id) + '">' + escape(id) + '</option>'; }).join('');

  if (iconDraft && iconDraft.key === key && iconDraft.prompt !== undefined) {
    area.value = iconDraft.prompt;
    if (iconDraft.output) sizes.innerHTML = iconSizes(iconDraft.output);
    return;
  }
  try {
    const response = await fetch('/api/icon/prompt?key=' + encodeURIComponent(key), { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Prompt indisponible');
    area.value = data.specific || '';
    area.placeholder = data.specific ? '' : 'Aucune partie spécifique enregistrée.';
    if (data.family && ids.indexOf(data.family) >= 0) select.value = data.family;
    sizes.innerHTML = iconSizes(data.output);
    const staged = panel.querySelector('[data-staged]');
    staged.hidden = !data.staged;
    if (data.staged) panel.querySelector('[data-staged-sizes]').innerHTML = iconSizes(data.stagedOutput);
    iconDraft = { key: key, prompt: area.value, output: data.output };
    if (!data.generatable) {
      panel.querySelector('.icon-generate').disabled = true;
      panel.querySelector('.icon-status').textContent = 'Génération non branchée pour cette famille.';
    }
  } catch (error) {
    area.placeholder = error.message;
  }
}

async function decideVersion(button, action) {
  const panel = button.closest('.icon-panel');
  const status = panel.querySelector('.icon-staged-status');
  try {
    const response = await fetch('/api/icon/' + action, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: panel.dataset.key }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'échec');
    status.textContent = action === 'promote' ? ' nouvelle version appliquée (réimporter dans Godot)' : ' version jetée';
    status.className = 'icon-staged-status ok';
    const fresh = await (await fetch('/api/icon/prompt?key=' + encodeURIComponent(panel.dataset.key), { cache: 'no-store' })).json();
    panel.querySelector('[data-sizes]').innerHTML = iconSizes(fresh.output);
    panel.querySelector('[data-staged]').hidden = !fresh.staged;
    if (fresh.staged) panel.querySelector('[data-staged-sizes]').innerHTML = iconSizes(fresh.stagedOutput);
    iconDraft = { key: panel.dataset.key, prompt: fresh.specific || '', output: fresh.output };
  } catch (error) {
    status.textContent = ' ' + error.message;
    status.className = 'icon-staged-status ko';
  }
}

async function regenerate(button) {
  const panel = button.closest('.icon-panel');
  const key = panel.dataset.key;
  const specific = panel.querySelector('.icon-prompt').value.trim();
  const template = panel.querySelector('.icon-family').value;
  const status = panel.querySelector('.icon-status');
  const log = panel.querySelector('.icon-log');
  const progress = panel.querySelector('[data-progress]');
  button.disabled = true;
  progress.hidden = false;
  status.textContent = 'génération…';
  status.className = 'icon-status';
  const started = Date.now();
  const tick = setInterval(function () { status.textContent = 'génération… ' + Math.round((Date.now() - started) / 1000) + ' s'; }, 250);
  try {
    const response = await fetch('/api/icon/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key, specific: specific, template: template }),
    });
    const data = await response.json();
    log.textContent = data.log || data.error || '—';
    if (!response.ok) throw Error(data.error || 'échec');
    status.textContent = 'nouvelle version prête (' + ((Date.now() - started) / 1000).toFixed(1) + ' s)';
    status.className = 'icon-status ok';
    iconDraft = null;
    const fresh = await (await fetch('/api/icon/prompt?key=' + encodeURIComponent(key), { cache: 'no-store' })).json();
    panel.querySelector('[data-sizes]').innerHTML = iconSizes(fresh.output);
    panel.querySelector('[data-staged]').hidden = !fresh.staged;
    if (fresh.staged) panel.querySelector('[data-staged-sizes]').innerHTML = iconSizes(fresh.stagedOutput);
  } catch (error) {
    status.textContent = error.message;
    status.className = 'icon-status ko';
  } finally {
    clearInterval(tick);
    progress.hidden = true;
    button.disabled = false;
  }
}

function openFocus(src) {
  let overlay = $('#focus');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'focus';
    overlay.className = 'focus-overlay';
    overlay.addEventListener('click', function () { overlay.hidden = true; });
    overlay.appendChild(document.createElement('img'));
    document.body.appendChild(overlay);
  }
  overlay.querySelector('img').src = src;
  overlay.hidden = false;
}


$('#detail').addEventListener('click', (event) => {
  const focusImg = event.target.closest('[data-focus]');
  if (focusImg) { openFocus(focusImg.src); return; }
  const saveBtn = event.target.closest('.icon-templates-save');
  if (saveBtn) { saveTemplates(saveBtn); return; }
  const tplSave = event.target.closest('.tpl-save');
  if (tplSave) { savePromptSettings(tplSave); return; }
  const tplAdd = event.target.closest('.tpl-add-btn');
  if (tplAdd) { addPromptTemplate(tplAdd); return; }
  const tplRemove = event.target.closest('.tpl-remove');
  if (tplRemove) { removePromptTemplate(tplRemove); return; }
  const keepBtn = event.target.closest('.icon-keep');
  if (keepBtn) { decideVersion(keepBtn, 'promote'); return; }
  const todoBtn = event.target.closest('.todo-toggle');
  if (todoBtn) { toggleTodo(todoBtn); return; }
  const dropBtn = event.target.closest('.icon-drop');
  if (dropBtn) { decideVersion(dropBtn, 'discard'); return; }
  const tplToggle = event.target.closest('.icon-details');
  if (tplToggle && !tplToggle.open) { const panel = tplToggle.closest('.icon-panel'); if (panel && tplToggle.contains(panel.querySelector('.icon-templates'))) loadTemplatesInto(panel); }
  const button = event.target.closest('.icon-generate');
  if (button) regenerate(button);
});
function reference(value) {
  const target = byId.get(String(value));
  return target ? `<a class="cross-link" href="${href(target)}">${escape(target.section === 'stats' ? statName(target.id) : target.name)}</a>` : escape(value);
}
function table(value, depth = 0) {
  return `<table class="data-table"><tbody>${Object.entries(value).map(([key,v]) => `<tr><th>${escape(catalogue.statLabels[key] ? statName(key) : fieldNames[key] || key)}${(catalogue.statLabels[key] || fieldNames[key]) && fieldNames[key] !== key ? `<small>${escape(key)}</small>` : ''}</th><td>${renderValue(v,key,depth+1)}</td></tr>`).join('')}</tbody></table>`;
}
function renderValue(value, key = '', depth = 0) {
  if (value === null) return '<span class="value-null">null</span>';
  if (typeof value === 'boolean') return `<span class="value-bool">${value ? 'Oui' : 'Non'}</span>`;
  if (typeof value === 'number') return escape(catalogue.statLabels[key] ? statSentence(key,value) : value);
  if (typeof value === 'string') {
    if (['slot','kind'].includes(key)) return escape(catalogue.slotLabels[value] || catalogue.kindLabels[value] || value);
    if (['links','flags','mech','stat','id','skills','supports','start'].includes(key)) return reference(value);
    return escape(plain(value));
  }
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="value-null">Aucun</span>';
    if (key === 'tiers' && value.every(v => Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number'))) return `<table class="tier-table"><thead><tr><th>Tier</th><th>Niv. objet min.</th><th>Min.</th><th>Max.</th></tr></thead><tbody>${value.map((v,i) => `<tr><td>T${value.length-i}</td>${v.map(n=>`<td>${n}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    if (value.every(v => v === null || typeof v !== 'object')) return `<div class="array">${value.map(v => `<span>${key === 'tags' ? escape(catalogue.tagLabels[v] || v) : renderValue(v,key,depth)}</span>`).join('')}</div>`;
    return value.map((v,i) => `<details${depth < 2 && value.length < 4 ? ' open' : ''}><summary>${escape(v?.name || v?.id || (v?.stat && v?.val != null ? statSentence(v.stat,v.val) : `Entrée ${i+1}`))}</summary>${typeof v === 'object' && v !== null ? table(v,depth) : renderValue(v,key,depth+1)}</details>`).join('');
  }
  if (!Object.keys(value).length) return '<span class="value-null">Aucun</span>';
  return depth > 1 ? `<details><summary>${Object.keys(value).length} propriétés</summary>${table(value,depth)}</details>` : table(value,depth);
}
function detail(entry) {
  const data = entry.data;
  const tags = data?.tags || [];
  const description = entry.description || (typeof data === 'string' ? data : '');
  return `<div class="entry-heading">${entry.section === 'sources' ? '' : icon(entry,true)}<div><h2>${escape(entry.name)}</h2><div class="technical">${escape(entry.id)}</div></div></div>` +
    (entry.parent ? `<div class="technical">${escape(catalogue.slotLabels[entry.parent] || entry.parent)}</div>` : '') +
    (tags.length ? `<div class="tags">${tags.map(t=>`<span class="tag">${escape(catalogue.tagLabels[t] || t)}</span>`).join('')}</div>` : '') +
    (description ? `<p class="description">${escape(plain(description))}</p>` : '') +
    (entry.notices?.length ? `<p class="notice">${entry.notices.length} constantes contiennent des expressions ou chargements de ressources. Leur définition reste consultable dans le code source ci-dessous.</p>` : '') +
    `<h3>Données complètes</h3>${data && typeof data === 'object' ? table(data) : renderValue(data)}` +
    `<h3>Source</h3><details><summary>Voir les données brutes</summary><pre class="raw">${escape(JSON.stringify(data,null,2))}</pre></details>` +
     +
    (entry.affixPools ? affixRolls(entry) : '') +
    '' +
   
    `<p class="source">${escape(entry.source)}${entry.pointer ? '<br>' + escape(entry.pointer) : ''}</p>`;
}
function route() {
  const hash = location.hash.slice(1), index = hash.indexOf('/');
  const next = (index < 0 ? hash : hash.slice(0,index)) || 'skills';
  if (next !== section) { filter = ''; limit = 120; $('#search').value = ''; }
  section = catalogue.sections.some(s=>s.id === next) || ['all','curves'].includes(next) ? next : 'skills';
  try { selected = index < 0 ? '' : decodeURIComponent(hash.slice(index+1)); } catch { selected = ''; }
  $('#heading').textContent = section === 'all' ? 'Tout le contenu' : section === 'sources' ? 'Fichiers sources' : section === 'curves' ? 'Progression' : section === 'prompts' ? 'Réglages des prompts' : section === 'sounds' ? 'Sons' : section === 'todo' ? 'Feuille de route' : catalogue.sections.find(s=>s.id === section)?.name || section;
  navigation(); prepareFacet(); renderList();
}
async function refresh() {
  if (requestActive) return;
  // Ne jamais écraser un prompt en cours d'édition dans le panneau d'icône.
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.icon-panel')) return;
  requestActive = true;
  try {
    const response = await fetch('catalogue.json',{cache:'no-store'});
    if (response.status === 304) { $('#error').hidden = true; $('#status').textContent = 'Données à jour'; return; }
    const next = await response.json();
    if (!response.ok) throw Error(next.error || 'Lecture des sources impossible');
    catalogue = next;
    byId = new Map();
    for (const entry of catalogue.entries) if (!['other','rules','images'].includes(entry.section)) byId.set(entry.id,entry);
    $('#version').textContent = `VERSION ${catalogue.gameVersion || 'LOCALE'} · DONNÉES DU JEU`;
    $('#error').hidden = true; $('#status').textContent = 'Données à jour';
    const resultScroll = $('.results').scrollTop, detailScroll = $('#detail').scrollTop;
    // Ne pas effacer une recherche pendant une actualisation automatique.
    const search = $('#search').value, priorSection = section, priorSelected = selected;
    route();
    if (priorSection === section) { $('#search').value = search; selected = priorSelected; renderList(); }
    $('.results').scrollTop = resultScroll; $('#detail').scrollTop = detailScroll;
  } catch (error) {
    $('#error').textContent = error.message; $('#error').hidden = false;
    $('#status').textContent = 'Source indisponible';
  } finally { requestActive = false; }
}
$('#search').addEventListener('input',()=>{limit=120;renderList();});
$('#detail').addEventListener('change',event=>{ if(event.target.id && event.target.id.indexOf('todo-')===0){ fillTodo(); }});
$('#facet').addEventListener('change',event=>{filter=event.target.value;limit=120;renderList();});
$('#results').addEventListener('click',event=>{if(event.target.closest('.more')){limit+=120;renderList();}});
window.addEventListener('hashchange',()=>{if(catalogue)route();});
document.addEventListener('error',event=>{
  if (!(event.target instanceof HTMLImageElement)) return;
  const image=event.target,parent=image.parentElement;
  if(parent.dataset.fallbackImage && !image.dataset.retried){image.dataset.retried='1';image.src=parent.dataset.fallbackImage;return;}
  image.remove();parent.textContent=parent.dataset.fallback || '◇';
},true);
await refresh();


