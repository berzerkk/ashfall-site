// Ashfall — arbre de talents rendu en DOM, avec la même géométrie que panels.gd.
// Réutilisable : window.ASHFALL_RENDER_TREE(host, tree, {alloc, cores, points, labels})
// Sur l'accueil, le script s'auto-applique à #tree avec window.ASHFALL_TREE.
(function () {
  'use strict';

  var CW = 176, RH = 118, TOP = 46, SZ_S = 60, SZ_M = 76;
  // même règle que Talents.col_threshold : au-delà de la liste, +3 points par colonne
  function colNeed(thr, c) { return c < thr.length ? (thr[c] || 0) : (thr[thr.length - 1] || 0) + 3 * (c - thr.length + 1); }

  function makeRenderer(bind, esc) {
    function fmt(labels, key, val) {
      var vs = (Math.abs(val - Math.round(val)) < 0.05) ? String(Math.round(val)) : val.toFixed(1);
      var tpl = labels[key];
      if (tpl) {
        var t = String(tpl);
        if (val < 0) t = t.split('+{v}').join(vs);
        return t.split('{v}').join(vs);
      }
      return key + ' : ' + vs;
    }
    function statLines(labels, stats, mult, colr) {
      var out = '';
      Object.keys(stats).forEach(function (k) {
        out += '<span style="color:' + colr + '">  ' + esc(fmt(labels, k, stats[k] * mult)) + '</span><br>';
      });
      return out;
    }
    function nodeTip(n, alloc, total, thr, labels) {
      var rank = alloc[n.id] || 0;
      var kind = { small: 'Petit talent', medium: 'Talent moyen', keystone: 'Talent majeur' }[n.kind] || 'Talent';
      var h = '<span style="color:#e8b04a"><strong>' + esc(n.name) + '</strong></span><br>';
      h += '<span style="color:#7d8796">' + esc(kind) + ' · ' + n.max + ' rang(s)</span><br>';
      if (n.desc) h += esc(n.desc) + '<br>';
      if (n.stats && Object.keys(n.stats).length) {
        h += '<br><span style="color:#7d8796">Par rang :</span><br>' + statLines(labels, n.stats, 1, '#e2e8f0');
        if (rank > 0 && n.max > 1) {
          h += '<span style="color:#7d8796">Total rang ' + rank + '/' + n.max + ' :</span><br>' + statLines(labels, n.stats, rank, '#4fc3b0');
        }
      }
      var need = colNeed(thr, n.col);
      if (need > 0 && total < need) {
        h += '<span style="color:#e85555">Requiert ' + need + ' pts (' + total + '/' + need + ')</span><br>';
      }
      return h;
    }
    function colorAlpha(hex, a) {
      var h = String(hex || '').replace('#', '');
      if (h.length !== 6) return 'rgba(232,176,74,' + a + ')';
      return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
    }

    return function render(host, tree, opts) {
      opts = opts || {};
      var nodes = tree.nodes || [];
      var alloc = opts.alloc || {};
      var cores = opts.cores || {};
      var labels = opts.labels || {};
      var total = opts.points || 0;
      var thr = tree.thresholds || [0, 3, 6, 9, 12, 15];
      var maxCol = 0, maxRow = 0;
      nodes.forEach(function (n) { maxCol = Math.max(maxCol, n.col); maxRow = Math.max(maxRow, n.row); });
      var W = (maxCol + 1) * CW, H = TOP + (maxRow + 1) * RH;

      var treeCol = tree.color || '#e8b04a';
      var panel = document.createElement('div');
      panel.className = 'tal-panel';

      var head = document.createElement('div');
      head.className = 'tal-head';
      head.innerHTML = '<span class="tal-name" style="color:' + esc(treeCol) + '">' + esc(String(tree.name).toUpperCase())
        + '</span>' + (opts.hidePoints ? '' : '<span class="tal-pts">' + total + ' points investis</span>');
      panel.appendChild(head);

      if (tree.cores && tree.cores.length) {
        var coreWrap = document.createElement('div');
        coreWrap.className = 'tal-cores';
        coreWrap.innerHTML = '<div class="tal-sub">TALENTS MAJEURS</div>';
        var row = document.createElement('div');
        row.className = 'tal-core-row';
        tree.cores.forEach(function (tier) {
          var key = tree.id + ':' + tier.tier;
          var chosen = cores[key] || '';
          var def = (tier.choices || []).filter(function (c) { return c.id === chosen; })[0];
          var unlocked = total >= (tier.need || 10);
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'tal-core' + (def ? ' on' : '') + (unlocked ? '' : ' locked');
          b.style.setProperty('--tc', treeCol);
          b.innerHTML = def
            ? '<span class="cn">' + esc(def.name) + '</span><span class="cs">✓ ACTIF</span>'
            : '<span class="plus">+</span>';
          var tip = '<strong>Talent Majeur — Palier ' + tier.tier + '</strong><br>';
          if (def) tip += '<strong>' + esc(def.name) + '</strong><br>' + esc(def.desc || '');
          else if (!unlocked) tip += '<span style="color:#e5534b">Nécessite ' + (tier.need || 10) + " points dans l'arbre</span>";
          else tip += 'Aucun choix fait';
          if (!def && tier.choices) {
            tip += '<br><br><span style="color:#7d8796">Choix possibles :</span>';
            tier.choices.forEach(function (c) { tip += '<br>· <strong>' + esc(c.name) + '</strong> — ' + esc(c.desc || ''); });
          }
          bind(b, tip);
          row.appendChild(b);
        });
        coreWrap.appendChild(row);
        panel.appendChild(coreWrap);
      }

      var canvas = document.createElement('div');
      canvas.className = 'tal-canvas';
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';

      for (var c = 0; c <= maxCol; c++) {
        var need = colNeed(thr, c);
        var openC = total >= need;
        var band = document.createElement('div');
        band.className = 'tal-band' + (openC ? ' open' : '');
        band.style.left = (c * CW + 6) + 'px';
        band.style.width = (CW - 12) + 'px';
        band.style.height = H + 'px';
        canvas.appendChild(band);
        var hl = document.createElement('div');
        hl.className = 'tal-hl' + (openC ? ' open' : '');
        hl.style.left = (c * CW) + 'px';
        hl.style.width = CW + 'px';
        hl.textContent = need > 0 ? need + ' PTS' : 'DÉPART';
        if (!openC) hl.textContent += '  (' + total + '/' + need + ')';
        canvas.appendChild(hl);
      }

      var pos = {};
      nodes.forEach(function (n) { pos[n.id] = { x: n.col * CW + CW * 0.5, y: TOP + n.row * RH + RH * 0.45 }; });

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'tal-links');
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      nodes.forEach(function (n) {
        if (!n.req || !pos[n.id] || !pos[n.req]) return;
        var a = pos[n.req], b = pos[n.id];
        var lit = (alloc[n.id] || 0) > 0;
        var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', a.x); l.setAttribute('y1', a.y);
        l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);
        l.setAttribute('stroke', lit ? treeCol : '#3a4352');
        l.setAttribute('stroke-width', lit ? 4 : 2.5);
        svg.appendChild(l);
      });
      canvas.appendChild(svg);

      nodes.forEach(function (n) {
        var rank = alloc[n.id] || 0;
        var isMed = n.kind === 'medium';
        var sz = isMed ? SZ_M : SZ_S;
        var p = pos[n.id];
        var canAl = rank < n.max && total >= colNeed(thr, n.col) && (!n.req || (alloc[n.req] || 0) > 0);
        var full = rank >= n.max;
        var nc = rank > 0 ? treeCol : (canAl ? '#4fc3b0' : '#3a4352');

        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'tal-node' + (isMed ? ' med' : '') + (rank > 0 ? (full ? ' full' : ' on') : (canAl ? ' avail' : ' off'));
        el.style.left = (p.x - sz / 2) + 'px';
        el.style.top = (p.y - sz / 2) + 'px';
        el.style.width = sz + 'px';
        el.style.height = sz + 'px';
        el.style.setProperty('--nc', nc);
        el.style.setProperty('--nb', rank > 0 ? colorAlpha(treeCol, full ? 0.38 : 0.2) : (canAl ? '#1c2431' : '#161d28'));
        el.setAttribute('aria-label', n.name);
        var inner = document.createElement('span');
        inner.className = 'diamond';
        el.appendChild(inner);
        if (n.icon) {
          // icône générée du nœud (mêmes images qu'en jeu), grisée tant que le nœud n'est pas pris
          var img = document.createElement('img');
          img.className = 'tal-ico' + (rank > 0 ? '' : ' dim');
          img.src = n.icon; img.alt = ''; img.loading = 'lazy';
          el.appendChild(img);
        }
        var badge = document.createElement('span');
        badge.className = 'badge' + (full ? ' full' : (rank > 0 ? ' on' : ''));
        badge.textContent = rank + '/' + n.max;
        el.appendChild(badge);
        bind(el, nodeTip(n, alloc, total, thr, labels));
        canvas.appendChild(el);

        var lbl = document.createElement('div');
        lbl.className = 'tal-lbl';
        lbl.style.left = (p.x - CW / 2) + 'px';
        lbl.style.top = (p.y + sz / 2 + 4) + 'px';
        lbl.style.width = CW + 'px';
        lbl.style.color = rank > 0 ? treeCol : (canAl ? '#e8ecf1' : '#7d8796');
        lbl.textContent = n.name;
        canvas.appendChild(lbl);
      });

      panel.appendChild(canvas);
      host.appendChild(panel);
      return panel;
    };
  }

  window.ASHFALL_MAKE_TREE = makeRenderer;

  // ── usage sur l'accueil : l'arbre du build de démonstration ────────────────
  var T = window.ASHFALL_TREE;
  var host = document.getElementById('tree');
  if (!T || !T.tree || !host || !window.ASHFALL_TIP) return;
  makeRenderer(window.ASHFALL_TIP.bind, window.ASHFALL_TIP.esc)(host, T.tree, {
    alloc: T.alloc, cores: T.cores, points: T.points, labels: T.labels,
  });
})();
