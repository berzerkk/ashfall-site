// Généré par tools/site_i18n.mjs (tools/site_i18n/langs.json) : ne pas modifier à la main.
window.ASHFALL_LANGS = {"source":"fr","fallback":"en","langs":[{"code":"fr","name":"Français"},{"code":"en","name":"English"}]};
(function () {
  var L = window.ASHFALL_LANGS, h = document.documentElement;
  var root = h.getAttribute('data-root') || '', page = h.getAttribute('data-page') || 'index.html';
  var codes = L.langs.map(function (l) { return l.code; });
  window.ASHFALL_LANG_URL = function (c) { return root + (c === L.source ? '' : c + '/') + page; };
  var want = null;
  try { want = localStorage.getItem('ashfall-lang'); } catch (e) {}
  if (codes.indexOf(want) < 0) {
    want = null;
    var nav = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < nav.length && !want; i++) {
      var c = String(nav[i] || '').toLowerCase().split('-')[0];
      if (codes.indexOf(c) >= 0) want = c;
    }
    want = want || L.fallback;
  }
  if (want !== h.lang && !/[?&]lang=keep/.test(location.search)) location.replace(window.ASHFALL_LANG_URL(want) + location.hash);
})();
