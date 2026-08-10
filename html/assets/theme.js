/* ==========================================================================
   Plans — shared behaviour
   Owns the plan catalogue, the header, dark mode, reading progress and
   scroll reveals for every page in the site.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     The catalogue. This is the single place a plan is declared: the
     header nav and the gallery cards are both rendered from it, so
     adding a plan means adding one entry here and nothing else.
     ------------------------------------------------------------------ */
  var PLANS = [
    {
      file: 'plan-fuerza-jose.html',
      nav: 'Fuerza',
      title: 'Fuerza sin equipo',
      category: 'Fuerza',
      accent: 'strength',
      tags: ['activo', 'entrenamiento'],
      active: true,
      summary: 'Ocho semanas de peso corporal en casa para construir base antes de volver a correr. Cinco ejercicios, 30 minutos, tres días por semana.',
      meta: [
        { value: '8', label: 'semanas' },
        { value: '10 ago', label: '→ 4 oct' }
      ]
    },
    {
      file: 'plan-alimenticio-jose.html',
      nav: 'Nutrición',
      title: 'Come bien, come simple',
      category: 'Nutrición',
      accent: 'nutrition',
      tags: ['activo', 'nutricion'],
      active: true,
      summary: 'Plan de ~1,950 kcal construido sobre lo que ya sé cocinar. Porciones visuales sin báscula, tres comidas, opciones intercambiables.',
      meta: [
        { value: '1,950', label: 'kcal/día' },
        { value: '140g', label: 'proteína' }
      ]
    },
    {
      file: 'movilidad-runners.html',
      nav: 'Movilidad',
      title: 'Movilidad & flexibilidad',
      category: 'Movilidad',
      accent: 'mobility',
      tags: ['activo', 'entrenamiento'],
      active: true,
      summary: 'Tres rutinas separadas: dinámica antes de entrenar, estática después, y movilidad profunda para los días de descanso activo.',
      meta: [
        { value: '16', label: 'ejercicios' },
        { value: '8–12', label: 'min' }
      ]
    },
    {
      file: 'running-roadmap-v2.html',
      nav: 'Running',
      title: 'De cero a 5K · v2',
      category: 'Running',
      accent: 'running',
      tags: ['futuro', 'entrenamiento'],
      active: false,
      summary: 'Roadmap corregido tras auditar la v1: fechas reales, dos semanas puente añadidas y ningún salto que viole la regla del 10%.',
      meta: [
        { value: '20', label: 'semanas' },
        { value: '5 oct', label: '→ 15 feb' }
      ]
    }
  ];

  var LANDING_URL = 'https://www.josechaparro.com/';
  var STORAGE_KEY = 'plans-theme';

  var SUN = '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var BURGER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';

  /* ---------------------------------------------------------------- theme */

  function storedTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function applyTheme(name) {
    document.documentElement.classList.toggle('dark', name === 'dark');
    try { localStorage.setItem(STORAGE_KEY, name); } catch (e) { /* private mode */ }
  }

  function currentTheme() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  /* --------------------------------------------------------------- header */

  function currentFile() {
    var path = window.location.pathname;
    var file = path.substring(path.lastIndexOf('/') + 1);
    return file === '' ? 'index.html' : file;
  }

  function buildHeader() {
    var here = currentFile();
    var isGallery = here === 'index.html';

    var links = PLANS.map(function (plan) {
      var current = plan.file === here ? ' aria-current="page"' : '';
      return '<a href="./' + plan.file + '"' + current + '>' + plan.nav + '</a>';
    });

    if (!isGallery) {
      links.unshift('<a href="./index.html">Todos los planes</a>');
    }

    var header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML =
      '<div class="header-inner">' +
        '<a class="brand" href="' + LANDING_URL + '">José <span>Chaparro</span></a>' +
        '<span class="brand-sep">/</span>' +
        '<a class="brand-tag" href="./index.html" style="text-decoration:none">Plans</a>' +
        '<button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">' + BURGER + '</button>' +
        '<nav class="site-nav">' + links.join('') + '</nav>' +
        '<button class="theme-toggle" aria-label="Cambiar tema">' + SUN + MOON + '</button>' +
      '</div>';

    document.body.insertBefore(header, document.body.firstChild);

    var nav = header.querySelector('.site-nav');
    var burger = header.querySelector('.nav-toggle');
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); }
    });

    header.querySelector('.theme-toggle').addEventListener('click', function () {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });

    if (!isGallery) { buildProgressBar(); }
  }

  /* ------------------------------------------------------------- progress */

  function buildProgressBar() {
    var bar = document.createElement('div');
    bar.className = 'read-progress';
    document.body.appendChild(bar);

    var ticking = false;
    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      bar.style.width = Math.min(100, Math.max(0, pct)) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* --------------------------------------------------------------- reveal */

  function initReveal() {
    var items = document.querySelectorAll('.scroll-reveal');
    if (!items.length) { return; }

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('revealed'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ------------------------------------------------------------------ run */

  function init() {
    buildHeader();
    initReveal();
  }

  window.PlansTheme = { plans: PLANS, applyTheme: applyTheme };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* The class itself is set by an inline snippet in <head> so the first
     paint is already correct; this only keeps the stored value in sync
     when the OS preference changes and the user never chose explicitly. */
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!storedTheme()) {
        document.documentElement.classList.toggle('dark', e.matches);
      }
    });
  }
})();
