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
  $('#navigation').innerHTML = `<a href="#all" class="${section === 'all' ? 'active' : ''}"><span>Tout le contenu</span><small>${catalogue.entries.length}</small></a>` + order.map(([group, ids]) => `<div class="nav-group">${group}</div>${ids.map(link).join('')}`).join('') + `<div class="nav-group">Analyse</div><a class="nav-sources ${section === 'curves' ? 'active' : ''}" href="#curves"><span>Progression</span></a><a class="nav-sources ${section === 'todo' ? 'active' : ''}" href="#todo"><span>Feuille de route</span></a>`;
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
    $('#count').textContent = '4 graphiques';
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

function chartFrame(label, body, extra = '') {
  return '<figure class="chart"><figcaption>' + escape(label) + extra + '</figcaption>' + body + '</figure>';
}

// points: [{x:number, y:number, tip:string}]
function svgLine(series, opts) {
  const o = Object.assign({ w: 760, h: 240, pad: 40, label: '', fmt: (v) => v.toFixed(0), color: '#e8c46a' }, opts || {});
  const maxY = Math.max.apply(null, series.map((p) => p.y)) * 1.06 || 1;
  const innerW = o.w - o.pad * 2, innerH = o.h - o.pad * 2;
  const x = (i) => o.pad + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const y = (v) => o.pad + innerH - (v / maxY) * innerH;
  const pts = series.map((p, i) => x(i).toFixed(1) + ',' + y(p.y).toFixed(1)).join(' ');

  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const yy = o.pad + innerH * (1 - f);
    return '<line x1="' + o.pad + '" y1="' + yy.toFixed(1) + '" x2="' + (o.w - o.pad) + '" y2="' + yy.toFixed(1) + '" stroke="#ffffff16"/>' +
      '<text x="' + (o.pad - 6) + '" y="' + (yy + 4).toFixed(1) + '" fill="#ffffff60" font-size="10" text-anchor="end">' + escape(o.fmt(maxY * f)) + '</text>';
  }).join('');

  const tickEvery = Math.max(1, Math.round(series.length / 10));
  const ticks = series.map((p, i) => (i % tickEvery === 0 || i === series.length - 1)
    ? '<text x="' + x(i).toFixed(1) + '" y="' + (o.h - o.pad + 16) + '" fill="#ffffff60" font-size="10" text-anchor="middle">' + escape(String(p.x)) + '</text>' : '').join('');

  // survol : une bande invisible par point, avec infobulle native
  const band = innerW / Math.max(1, series.length - 1);
  const hover = series.map((p, i) => {
    const left = Math.max(o.pad, x(i) - band / 2);
    return '<rect x="' + left.toFixed(1) + '" y="' + o.pad + '" width="' + band.toFixed(1) + '" height="' + innerH + '" fill="#000" fill-opacity="0" pointer-events="all">' +
      '<title>' + escape(p.tip || (p.x + ' → ' + o.fmt(p.y))) + '</title></rect>' +
      '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.y).toFixed(1) + '" r="6" fill="none" pointer-events="none" stroke="' + o.color + '" stroke-width="1.4" opacity="0"/>';
  }).join('');

  return chartFrame(o.label,
    '<svg viewBox="0 0 ' + o.w + ' ' + o.h + '" role="img" aria-label="' + escape(o.label) + '">' + grid +
    '<polyline fill="none" stroke="' + o.color + '" stroke-width="2.2" points="' + pts + '"/>' + ticks + hover + '</svg>',
    o.extra || '');
}

function svgBars(items, opts) {
  const o = Object.assign({ w: 760, h: 220, pad: 40, label: '', color: '#7fd44a' }, opts || {});
  const maxY = Math.max.apply(null, items.map((i) => i.y)) * 1.12 || 1;
  const innerW = o.w - o.pad * 2, innerH = o.h - o.pad * 2;
  const bw = innerW / items.length;
  const bars = items.map((it, i) => {
    const bh = (it.y / maxY) * innerH;
    const left = o.pad + i * bw + bw * 0.15;
    return '<rect x="' + left.toFixed(1) + '" y="' + (o.pad + innerH - bh).toFixed(1) + '" width="' + (bw * 0.7).toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + o.color + '" rx="3">' +
      '<title>' + escape(it.tip || (it.x + ' → ' + it.v)) + '</title></rect>' +
      '<text x="' + (left + bw * 0.35).toFixed(1) + '" y="' + (o.h - o.pad + 15) + '" fill="#ffffff60" font-size="9" text-anchor="middle">' + escape(it.x) + '</text>' +
      '<text x="' + (left + bw * 0.35).toFixed(1) + '" y="' + (o.pad + innerH - bh - 5).toFixed(1) + '" fill="#ffffff90" font-size="9" text-anchor="middle">' + escape(it.v) + '</text>';
  }).join('');
  return chartFrame(o.label, '<svg viewBox="0 0 ' + o.w + ' ' + o.h + '" role="img" aria-label="' + escape(o.label) + '">' + bars + '</svg>');
}

const MAX_LEVEL = 100;
function xpToNext(level) { return Math.round(30 * Math.pow(level, 1.65) + 20 * level); }
function monLife(lvl, hpMult) { return (1 + (lvl - 1) * 0.22) * Math.pow(1.045, lvl - 1) * hpMult; }
function monDmg(lvl, dmgMult) { return (1 + (lvl - 1) * 0.14) * Math.pow(1.022, lvl - 1) * dmgMult; }

function curvesView(tierId) {
  const monsters = catalogue.sources.find((s) => s.id === 'data/monsters.json')?.data || {};
  const tiers = Array.isArray(monsters.tiers) ? monsters.tiers : [];
  const tier = tiers.find((t) => String(t.id) === String(tierId)) || tiers[0] || { name: 'Normal', hp: 1, dmg: 1 };
  const hpMult = Number(tier.hp) || 1, dmgMult = Number(tier.dmg) || 1;

  const selector = tiers.length
    ? '<label class="chart-filter">Palier <select id="curve-tier">' + tiers.map((t) =>
        '<option value="' + t.id + '"' + (String(t.id) === String(tier.id) ? ' selected' : '') + '>' + escape(t.name) + ' (vie ×' + Number(t.hp).toFixed(2) + ')</option>').join('') + '</select></label>'
    : '';

  const xp = [], life = [], dmg = [];
  for (let level = 1; level <= MAX_LEVEL; level++) {
    xp.push({ x: level, y: xpToNext(level), tip: 'Niveau ' + level + ' → ' + xpToNext(level).toLocaleString('fr-FR') + ' XP pour le suivant' });
    life.push({ x: level, y: monLife(level, hpMult), tip: 'Niveau ' + level + ' — vie ×' + monLife(level, hpMult).toFixed(2) + ' (' + escape(tier.name) + ')' });
    dmg.push({ x: level, y: monDmg(level, dmgMult), tip: 'Niveau ' + level + ' — dégâts ×' + monDmg(level, dmgMult).toFixed(3) });
  }

  const bars = tiers.map((t) => ({ x: String(t.name).slice(0, 9), y: Number(t.hp) || 1, v: '×' + (Number(t.hp) || 1).toFixed(2), tip: t.name + ' — vie ×' + (Number(t.hp) || 1).toFixed(2) + ', dégâts ×' + (Number(t.dmg) || 1).toFixed(2) + ', MF ' + (t.mf || 0) + ' %, niveau +' + (t.lvlAdd || 0) }));

  return '<div class="charts">' +
    '<p class="technical">Formules du jeu : <code>xp_to_next</code> (main.gd), <code>_mon_life</code> et <code>_mon_dmg</code> (enemy.gd), paliers de <code>data/monsters.json</code>. Survole une courbe pour le détail d’un niveau.</p>' +
    selector +
    svgLine(xp, { label: 'XP requis pour le niveau suivant (1 → ' + MAX_LEVEL + ')', fmt: (v) => (v >= 1000 ? Math.round(v / 1000) + 'k' : String(Math.round(v))), color: '#e8c46a' }) +
    svgLine(life, { label: 'Vie d’un monstre par niveau — ' + tier.name, fmt: (v) => '×' + v.toFixed(0), color: '#ff7a7a' }) +
    svgLine(dmg, { label: 'Dégâts d’un monstre par niveau — ' + tier.name, fmt: (v) => '×' + v.toFixed(1), color: '#7f9cff' }) +
    (bars.length ? svgBars(bars, { label: 'Multiplicateur de vie par palier de difficulté' }) : '') +
    '</div>';
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
  section = catalogue.sections.some(s=>s.id === next) || ['all','curves','todo'].includes(next) ? next : 'skills';
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
$('#detail').addEventListener('change',event=>{ if(event.target.id==='curve-tier'){ $('#detail').innerHTML = curvesView(event.target.value); } else if(event.target.id && event.target.id.indexOf('todo-')===0){ fillTodo(); }});
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


