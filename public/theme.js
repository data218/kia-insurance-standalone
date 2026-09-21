(function () {
  'use strict';

  var STORE_KEY = 'kia_theme';
  var LEGACY_KEY = 'kia_perf_theme';

  var THEMES = [
    { name: 'Classic Blue', bg: '#e8f0fe', panel: '#ffffff', card: '#ffffff', cardHover: '#eff6ff', border: '#c4cedb', text: '#000000', muted: '#333333', accent: '#3b82f6', header1: '#333333', header2: '#777777', green: '#166534', red: '#dc2626', blue: '#3b82f6', orange: '#f97316', purple: '#a855f7', teal: '#14b8a6', yellow: '#eab308' },
    { name: 'Ocean Deep', bg: '#eef3f9', panel: '#ffffff', card: '#ffffff', cardHover: '#f3f7fb', border: '#b9c9dd', text: '#0b1c2c', muted: '#365369', accent: '#1e6f9e', header1: '#0f2027', header2: '#2c5364', green: '#166534', red: '#dc2626', blue: '#1e6f9e', orange: '#f97316', purple: '#7c3aed', teal: '#0d9488', yellow: '#eab308' },
    { name: 'Sonic Midnight', dark: true, bg: '#0f172a', panel: '#1e293b', card: '#1e293b', cardHover: '#253248', border: '#334155', text: '#e2e8f0', muted: '#94a3b8', accent: '#38bdf8', header1: '#0b1220', header2: '#334155', green: '#34d399', red: '#f87171', blue: '#38bdf8', orange: '#fb923c', purple: '#a78bfa', teal: '#2dd4bf', yellow: '#facc15' },
    { name: 'Royal Purple', bg: '#f6f1ff', panel: '#ffffff', card: '#ffffff', cardHover: '#f1e9ff', border: '#d4c6ef', text: '#1e1033', muted: '#5b21b6', accent: '#7c3aed', header1: '#3b0764', header2: '#7c3aed', green: '#059669', red: '#dc2626', blue: '#6d28d9', orange: '#f97316', purple: '#a855f7', teal: '#14b8a6', yellow: '#eab308' },
    { name: 'Royal Purple Dark', dark: true, bg: '#16101f', panel: '#221831', card: '#221831', cardHover: '#2a1e3d', border: '#3a2a52', text: '#efe6ff', muted: '#ab94d6', accent: '#a78bfa', header1: '#1e0c33', header2: '#6d28d9', green: '#34d399', red: '#fb7185', blue: '#a78bfa', orange: '#fb923c', purple: '#c084fc', teal: '#2dd4bf', yellow: '#facc15' },
    { name: 'Emerald Forest', bg: '#ecfdf5', panel: '#ffffff', card: '#ffffff', cardHover: '#e4f7ec', border: '#bfe5cc', text: '#052e1b', muted: '#0f766e', accent: '#059669', header1: '#064e3b', header2: '#10b981', green: '#059669', red: '#dc2626', blue: '#0ea5e9', orange: '#f97316', purple: '#7c3aed', teal: '#0d9488', yellow: '#eab308' },
    { name: 'Forest Night', dark: true, bg: '#0c1412', panel: '#15241e', card: '#15241e', cardHover: '#1b2e26', border: '#234034', text: '#d8efe2', muted: '#7fa997', accent: '#34d399', header1: '#081712', header2: '#14532d', green: '#34d399', red: '#fb7185', blue: '#38bdf8', orange: '#fb923c', purple: '#a78bfa', teal: '#2dd4bf', yellow: '#facc15' },
    { name: 'Sunset Glow', bg: '#fff7ed', panel: '#ffffff', card: '#ffffff', cardHover: '#ffedd9', border: '#f3d3ad', text: '#3b1708', muted: '#9a3412', accent: '#ea580c', header1: '#7c2d12', header2: '#f97316', green: '#059669', red: '#dc2626', blue: '#0ea5e9', orange: '#ea580c', purple: '#7c3aed', teal: '#0d9488', yellow: '#eab308' },
    { name: 'Rose Blush', bg: '#fff1f2', panel: '#ffffff', card: '#ffffff', cardHover: '#fde7ec', border: '#efc3cb', text: '#3f0a1c', muted: '#9f1239', accent: '#e11d48', header1: '#881337', header2: '#e11d48', green: '#059669', red: '#dc2626', blue: '#0ea5e9', orange: '#f97316', purple: '#a855f7', teal: '#14b8a6', yellow: '#eab308' },
    { name: 'Crimson Wine', dark: true, bg: '#1a0f12', panel: '#2a1820', card: '#2a1820', cardHover: '#331e28', border: '#442430', text: '#f5e3e8', muted: '#a97f8c', accent: '#fb7185', header1: '#3b0714', header2: '#be123c', green: '#34d399', red: '#fb7185', blue: '#60a5fa', orange: '#fb923c', purple: '#c084fc', teal: '#2dd4bf', yellow: '#facc15' },
    { name: 'Aurora Teal', bg: '#ecfeff', panel: '#ffffff', card: '#ffffff', cardHover: '#dafcf5', border: '#b0e5e5', text: '#04302e', muted: '#0e7490', accent: '#0d9488', header1: '#0f766e', header2: '#22d3ee', green: '#059669', red: '#dc2626', blue: '#0ea5e9', orange: '#f97316', purple: '#7c3aed', teal: '#0d9488', yellow: '#eab308' },
    { name: 'Neon Cyber', dark: true, bg: '#0a0a14', panel: '#151527', card: '#151527', cardHover: '#1c1c33', border: '#2c2c52', text: '#e6e6ff', muted: '#8f8fd4', accent: '#22d3ee', header1: '#1b0f3a', header2: '#a21caf', green: '#34d399', red: '#fb7185', blue: '#22d3ee', orange: '#fb923c', purple: '#a78bfa', teal: '#2dd4bf', yellow: '#facc15' },
    { name: 'Terminal Matrix', dark: true, bg: '#020603', panel: '#071206', card: '#071206', cardHover: '#0a180a', border: '#1d4427', text: '#33ff66', muted: '#1f9c45', accent: '#00ff66', header1: '#001a00', header2: '#00cc44', green: '#00ff66', red: '#ff5555', blue: '#33ff66', orange: '#ffb000', purple: '#66ff99', teal: '#00ffcc', yellow: '#ffee00' },
    { name: 'Graphite Mono', bg: '#eef0f3', panel: '#ffffff', card: '#ffffff', cardHover: '#e9ecf0', border: '#c9cdd4', text: '#111827', muted: '#4b5563', accent: '#4b5563', header1: '#111111', header2: '#444444', green: '#059669', red: '#dc2626', blue: '#2563eb', orange: '#f97316', purple: '#7c3aed', teal: '#0d9488', yellow: '#eab308' },
    { name: 'Nordic Frost', bg: '#eaf2fb', panel: '#ffffff', card: '#ffffff', cardHover: '#e8f1fa', border: '#bed2e8', text: '#12263f', muted: '#2e6da8', accent: '#2e6da8', header1: '#274b7c', header2: '#7aa5d9', green: '#059669', red: '#dc2626', blue: '#2e6da8', orange: '#f97316', purple: '#7c3aed', teal: '#0d9488', yellow: '#eab308' },
    { name: 'Golden Amber', bg: '#fffbeb', panel: '#ffffff', card: '#ffffff', cardHover: '#fdf1d5', border: '#ecd9a0', text: '#3d2605', muted: '#92400e', accent: '#d97706', header1: '#451a03', header2: '#f59e0b', green: '#059669', red: '#dc2626', blue: '#0ea5e9', orange: '#d97706', purple: '#7c3aed', teal: '#0d9488', yellow: '#eab308' }
  ];

  function buildVars(t) {
    var white = '#ffffff';
    var hdr = 'linear-gradient(135deg,' + t.header1 + ',' + t.header2 + ')';
    var dark = !!t.dark;
    return {
      'bg': t.bg, 'panel': t.panel, 'card': t.card, 'card-hover': t.cardHover, 'border': t.border,
      'text': t.text, 'muted': t.muted, 'accent': t.accent,
      'green': t.green, 'red': t.red, 'blue': t.blue, 'orange': t.orange, 'purple': t.purple,
      'pink': t.purple, 'teal': t.teal, 'yellow': t.yellow, 'radius': '10px',
      'topbar-bg': hdr,
      'surface': t.panel, 'surface-2': t.cardHover, 'surface-3': t.panel,
      'fg': t.text, 'fg-muted': t.muted, 'fg-soft': t.muted,
      'header-gradient': hdr, 'header-fg': white, 'header-fg-sub': 'rgba(255,255,255,.7)',
      'control-bg': 'rgba(255,255,255,.15)', 'control-border': 'rgba(255,255,255,.4)', 'control-fg': white,
      'menu-bg': t.header1, 'menu-fg': white, 'menu-hover': 'rgba(255,255,255,.15)',
      'thead-bg': t.header1, 'thead-fg': white,
      'accent-soft': dark ? 'rgba(255,255,255,.06)' : t.cardHover,
      'accent-hover': dark ? 'rgba(255,255,255,.12)' : t.cardHover,
      'total-bg': dark ? 'rgba(255,255,255,.08)' : t.cardHover,
      'button-bg': t.header1, 'button-hover': t.header2, 'button-fg': white, 'button-border': 'rgba(255,255,255,.4)',
      'scroll-thumb': t.border, 'scroll-track': 'transparent', 'modal-bg': t.panel,
      'yday-bg': dark ? '#475569' : '#555555', 'today-bg': t.green, 'daily-head-bg': t.header1,
      'pos-fg': t.green, 'neg-fg': t.red, 'nv-bg': dark ? 'rgba(239,68,68,.18)' : '#fee2e2', 'nv-fg': t.red
    };
  }

  function ensureStyleTag() {
    var el = document.getElementById('themeVars');
    if (!el) {
      el = document.createElement('style');
      el.id = 'themeVars';
      document.head.appendChild(el);
    }
    var sel = document.getElementById('themeSelectStyle');
    if (!sel) {
      sel = document.createElement('style');
      sel.id = 'themeSelectStyle';
      sel.textContent = '.theme-select{padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;background:var(--card,#fff);color:var(--text,#333);border:1px solid var(--border,#ccc);outline:none;max-width:150px}.theme-select:hover{background:var(--card-hover,#f0f5ff)}';
      document.head.appendChild(sel);
    }
    return el;
  }

  function findTheme(name) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].name === name) return THEMES[i];
    return null;
  }

  function applyTheme(name) {
    var t = findTheme(name) || THEMES[0];
    var vars = buildVars(t);
    var css = ':root{';
    for (var k in vars) if (vars.hasOwnProperty(k)) css += '--' + k + ':' + vars[k] + ';';
    css += '}';
    ensureStyleTag().textContent = css;
    document.documentElement.setAttribute('data-theme', t.name);
    try { localStorage.setItem(STORE_KEY, t.name); } catch (e) {}
    syncSelects(t.name);
    return t.name;
  }

  function syncSelects(name) {
    var selects = document.querySelectorAll('.theme-select');
    for (var i = 0; i < selects.length; i++) {
      if (selects[i].value !== name) selects[i].value = name;
    }
  }

  function buildSelect(el) {
    if (el.getAttribute('data-theme-ready') === '1') return;
    el.setAttribute('data-theme-ready', '1');
    for (var i = 0; i < THEMES.length; i++) {
      var opt = document.createElement('option');
      opt.value = THEMES[i].name;
      opt.textContent = THEMES[i].name;
      el.appendChild(opt);
    }
    el.addEventListener('change', function () { applyTheme(el.value); });
  }

  function savedTheme() {
    var n = null;
    try { n = localStorage.getItem(STORE_KEY); } catch (e) {}
    if (n && findTheme(n)) return n;
    try { n = localStorage.getItem(LEGACY_KEY); } catch (e) {}
    if (n && findTheme(n)) return n;
    return THEMES[0].name;
  }

  function init() {
    var name = savedTheme();
    applyTheme(name);
    var selects = document.querySelectorAll('.theme-select');
    for (var i = 0; i < selects.length; i++) buildSelect(selects[i]);
    syncSelects(name);
  }

  window.kiaThemes = { apply: applyTheme, list: THEMES, init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
