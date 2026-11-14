// Ashfall — site : infobulles réelles du jeu, visionneuse, journal.
(function () {
  'use strict';

  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  // ───────────────────────────── infobulles ─────────────────────────────
  var SHOW = window.ASHFALL_SHOW || { skills: [], supports: [], items: [] };
  var tip = document.getElementById('kx-tip');

  function place(x, y) {
    tip.style.left = '0px';
    tip.style.top = '0px';
    var r = tip.getBoundingClientRect();
    var px = x + 18, py = y + 16;
    if (px + r.width > window.innerWidth - 12) px = x - r.width - 18;
    if (py + r.height > window.innerHeight - 12) py = Math.max(12, window.innerHeight - r.height - 12);
    if (px < 12) px = 12;
    tip.style.left = Math.round(px) + 'px';
    tip.style.top = Math.round(py) + 'px';
  }

  function show(el, x, y) {
    tip.innerHTML = el._html;
    tip.hidden = false;
    place(x, y);
  }
  function hide() { tip.hidden = true; }

  function bind(b, html) {
    b._html = html;
    b.addEventListener('mouseenter', function (ev) { show(b, ev.clientX, ev.clientY); });
    b.addEventListener('mousemove', function (ev) { if (!tip.hidden) place(ev.clientX, ev.clientY); });
    b.addEventListener('mouseleave', hide);
    b.addEventListener('focus', function () {
      var r = b.getBoundingClientRect();
      show(b, r.right - 8, r.top + r.height / 2);
    });
    b.addEventListener('blur', hide);
    b.addEventListener('click', function (ev) {
      if (tip.hidden) show(b, ev.clientX, ev.clientY); else hide();
    });
  }

  function icon_grid(host, list) {
    if (!host) return;
    var frag = document.createDocumentFragment();
    list.forEach(function (e) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'kx-icon';
      b.setAttribute('aria-label', e.name);
      var img = document.createElement('img');
      img.src = e.icon; img.alt = e.name; img.width = 64; img.height = 64; img.loading = 'lazy';
      b.appendChild(img);
      bind(b, e.html);
      frag.appendChild(b);
    });
    host.appendChild(frag);
  }

  function item_chips(host, list) {
    if (!host) return;
    var frag = document.createDocumentFragment();
    list.forEach(function (e) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'kx-chip r-' + e.rarity;
      b.textContent = e.name;
      bind(b, e.html);
      frag.appendChild(b);
    });
    host.appendChild(frag);
  }
  if (false) item_chips(null, []);

  function item_tiles(host, list) {
    if (!host) return;
    var frag = document.createDocumentFragment();
    list.forEach(function (e) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'kx-tile r-' + e.rarity;
      if (e.icon) {
        var img = document.createElement('img');
        img.src = e.icon; img.alt = e.name; img.loading = 'lazy';
        b.appendChild(img);
      }
      var nm = document.createElement('span');
      nm.className = 'nm'; nm.textContent = e.name;
      b.appendChild(nm);
      bind(b, e.html);
      frag.appendChild(b);
    });
    host.appendChild(frag);
  }

  // ───────────────────────────── accueil : classes, nouveautés, compteurs ─────────────────────────────
  var HOME = window.ASHFALL_HOME || { classes: [], fresh: [], counts: {} };
  var cg = document.getElementById('class-grid');
  if (cg) {
    HOME.classes.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'class-ico';
      if (c.color) b.style.setProperty('--cc', c.color);
      b.innerHTML = '<img src="' + esc(c.icon) + '" alt="" loading="lazy" width="104" height="104"><span>' + esc(c.name) + '</span>';
      var col = c.color || '#e8b04a';
      bind(b, '<strong style="color:' + esc(col) + '">' + esc(c.name) + '</strong>' +
        (c.role ? '   <span style="color:#7d8796">' + esc(c.role) + '</span>' : '') +
        '<br><br><span style="color:#c9cfd8">' + esc(c.desc) + '</span>' +
        (c.passive ? '<br><br><span style="color:#e8b04a">' + esc(c.passive.name) + '</span><br><span style="color:#9aa5b6">' + esc(c.passive.desc) + '</span>' : ''));
      cg.appendChild(b);
    });
  }
  // onglets des mécaniques
  var tabs = Array.prototype.slice.call(document.querySelectorAll('#mecaniques .tab'));
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      var id = t.getAttribute('data-tab');
      tabs.forEach(function (x) { x.classList.toggle('on', x === t); });
      Array.prototype.forEach.call(document.querySelectorAll('#mecaniques .tab-panel'), function (p) {
        var on = p.getAttribute('data-panel') === id;
        p.hidden = !on; p.classList.toggle('on', on);
      });
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-fresh]'), function (host) {
    var fam = host.getAttribute('data-fresh');
    icon_grid(host, HOME.fresh.filter(function (s) { return s.family === fam; }).map(function (s) {
      return { name: s.name, icon: s.icon, html: '<strong>' + esc(s.name) + '</strong><br><br><span style="color:#b9c2d0">' + esc(s.desc) + '</span>' };
    }));
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-count]'), function (b) {
    var n = HOME.counts && HOME.counts[b.getAttribute('data-count')];
    if (n) b.textContent = n;
  });

  icon_grid(document.getElementById('show-skills'), SHOW.skills);
  icon_grid(document.getElementById('show-supports'), SHOW.supports);
  item_tiles(document.getElementById('show-items'), SHOW.items);
  window.ASHFALL_TIP = { bind: bind, esc: esc };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', hide, { passive: true });

  // Markdown en ligne du journal : **gras**, *italique*, `code` (après échappement HTML)
  function md(t) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  // ───────────────────────────── journal ─────────────────────────────
  var log = window.ASHFALL_LOG || [];
  var host = document.getElementById('log');
  if (host) {
    log.forEach(function (v, i) {
      var d = document.createElement('details');
      d.className = 'ver';
      if (i === 0) d.open = true;
      var body = '<div class="ver-body">';
      if (v.intro) body += '<p class="ver-intro">' + md(v.intro) + '</p>';
      v.groups.forEach(function (g) {
        if (g.title) body += '<h4>' + esc(g.title) + '</h4>';
        body += '<ul>' + g.items.map(function (t) { return '<li>' + md(t) + '</li>'; }).join('') + '</ul>';
      });
      body += '</div>';
      d.innerHTML = '<summary><span class="vtag">' + esc(v.ver) + '</span><span class="vtitle">' + esc(v.title) + '</span></summary>' + body;
      host.appendChild(d);
    });
  }

  // ───────────────────────────── visionneuse ─────────────────────────────
  var figs = Array.prototype.slice.call(document.querySelectorAll('#gallery figure img, #gallery-ui figure img, .shot-pair img, .meca-shots img'));
  var full = function (f) { return f.getAttribute('data-full') || f.getAttribute('src'); };
  var label = function (f) {
    var t = f.parentNode.querySelector('figcaption');
    return t ? t.textContent : (f.alt || '');
  };
  var lb = document.getElementById('lb');
  if (figs.length && lb) {
    var img = document.getElementById('lb-img');
    var cap = document.getElementById('lb-cap');
    var i = 0;

    var show_at = function (n) {
      i = (n + figs.length) % figs.length;
      img.src = figs[i].getAttribute('src');   // vignette tout de suite, puis la 4K
      var hi = new Image();
      var want = i;
      hi.onload = function () { if (want === i && !lb.hidden) img.src = hi.src; };
      hi.src = full(figs[i]);
      img.alt = figs[i].alt || '';
      cap.innerHTML = esc(label(figs[i])) + '<span class="lb-n">' + (i + 1) + ' / ' + figs.length + '</span>' +
        '<a class="lb-4k" href="' + esc(full(figs[i])) + '" target="_blank" rel="noopener">Ouvrir en 4K</a>';
    };
    var open = function (n) { show_at(n); lb.hidden = false; document.body.style.overflow = 'hidden'; };
    var close = function () { lb.hidden = true; document.body.style.overflow = ''; img.src = ''; };

    figs.forEach(function (f, n) { f.addEventListener('click', function () { open(n); }); });
    document.getElementById('lb-close').addEventListener('click', close);
    document.getElementById('lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show_at(i - 1); });
    document.getElementById('lb-next').addEventListener('click', function (e) { e.stopPropagation(); show_at(i + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target === img) close(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show_at(i - 1);
      else if (e.key === 'ArrowRight') show_at(i + 1);
    });
  }
})();
