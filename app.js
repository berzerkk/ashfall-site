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

  // ───────────────────────────── héros : braises ─────────────────────────────
  (function () {
    var cv = document.getElementById('embers');
    if (!cv || !cv.getContext) return;
    var cx = cv.getContext('2d');
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var W = 0, H = 0, dpr = 1, parts = [], last = 0;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var want = Math.round(Math.min(220, W * H / 9000) * (calm ? 0.3 : 1));
      while (parts.length < want) parts.push(spawn(true));
      parts.length = want;
    }
    function spawn(any) {
      var big = Math.random() < 0.12;
      return {
        x: Math.random() * W, y: any ? Math.random() * H : H + 10,
        r: big ? 1.8 + Math.random() * 2.2 : 0.6 + Math.random() * 1.4,
        vy: -(18 + Math.random() * (big ? 30 : 55)), vx: (Math.random() - 0.5) * 14,
        ph: Math.random() * 6.28, fq: 1.5 + Math.random() * 3, life: 0, max: 5 + Math.random() * 9,
        hue: 14 + Math.random() * 28, ash: Math.random() < 0.18
      };
    }
    function frame(t) {
      var dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      cx.clearRect(0, 0, W, H);
      cx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.life += dt;
        p.vx += Math.sin(t / 900 + p.ph) * 6 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        var k = Math.min(1, p.life / 0.8) * Math.max(0, 1 - p.life / p.max) * Math.min(1, p.y / (H * 0.25));
        var fl = 0.65 + 0.35 * Math.sin(t / 1000 * p.fq * 6.28 + p.ph);
        var a = Math.max(0, k * fl);
        if (p.ash) {
          cx.fillStyle = 'rgba(120,110,105,' + (a * 0.35).toFixed(3) + ')';
          cx.fillRect(p.x, p.y, p.r * 1.4, p.r * 1.4);
        } else {
          var g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
          g.addColorStop(0, 'hsla(' + (p.hue + 20) + ',100%,78%,' + a.toFixed(3) + ')');
          g.addColorStop(0.25, 'hsla(' + p.hue + ',100%,55%,' + (a * 0.55).toFixed(3) + ')');
          g.addColorStop(1, 'hsla(' + p.hue + ',100%,40%,0)');
          cx.fillStyle = g;
          cx.fillRect(p.x - p.r * 5, p.y - p.r * 5, p.r * 10, p.r * 10);
        }
        if (p.y < -20 || p.life > p.max) parts[i] = spawn(false);
      }
      cx.globalCompositeOperation = 'source-over';
      if (!document.hidden) requestAnimationFrame(frame); else last = 0;
    }
    size();
    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) requestAnimationFrame(frame); });
    requestAnimationFrame(frame);
  })();

  // Téléchargement : lien et taille exacte lus dans le manifeste de mise à jour (latest.json)
  if (window.fetch && location.protocol !== 'file:') {
    fetch('latest.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (m) {
      var exe = m && m.files && m.files['Ashfall.exe'];
      if (!exe) return;
      Array.prototype.forEach.call(document.querySelectorAll('[data-dl="exe"]'), function (a) { a.href = exe.url; });
      var go = (exe.size / 1073741824).toFixed(2).replace('.', ',');
      var oct = String(exe.size).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
      Array.prototype.forEach.call(document.querySelectorAll('[data-size="exe"]'), function (p) { p.textContent = go + ' Go (' + oct + ' octets)'; });
    }).catch(function () {});
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
