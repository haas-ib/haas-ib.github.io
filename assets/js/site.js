/* haas_ib portfolio: interactions and motion. Plain JS, no build step. */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function debounce(fn, wait) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, wait); };
  }

  function formatDim(w, h) { return Math.round(w) + ' × ' + Math.round(h); }
  function setValue(el, text) { el.setAttribute('data-value', text); }
  function getValue(el) { return el.getAttribute('data-value') || ''; }

  /* ---------- Footer year ---------- */
  $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Clocks (Khulna / New York / Los Angeles) ---------- */
  function initClocks() {
    var clocks = $$('[data-clock]');
    var zones = $$('[data-tz]');
    if (!clocks.length || !window.Intl) return;

    function tick() {
      var now = new Date();
      clocks.forEach(function (el) {
        try {
          el.textContent = new Intl.DateTimeFormat('en-GB', {
            timeZone: el.getAttribute('data-clock'), hour: '2-digit', minute: '2-digit', hour12: false
          }).format(now);
        } catch (e) { /* unknown zone: keep placeholder */ }
      });
      zones.forEach(function (el) {
        try {
          var parts = new Intl.DateTimeFormat('en-US', { timeZone: el.getAttribute('data-tz'), timeZoneName: 'short' }).formatToParts(now);
          var name = parts.filter(function (p) { return p.type === 'timeZoneName'; })[0];
          if (name) el.textContent = name.value;
        } catch (e) { /* keep fallback label */ }
      });
    }

    tick();
    setTimeout(function () { tick(); setInterval(tick, 60000); }, (60 - new Date().getSeconds()) * 1000 + 50);
  }

  /* ---------- Frame tag: live viewport size and breakpoint ---------- */
  function initViewportTag() {
    var dim = $('[data-viewport]');
    var bp = $('[data-breakpoint]');
    function update() {
      var w = window.innerWidth;
      if (dim) setValue(dim, formatDim(w, window.innerHeight));
      if (bp) setValue(bp, w >= 1024 ? 'Desktop' : (w >= 640 ? 'Tablet' : 'Mobile'));
    }
    update();
    window.addEventListener('resize', update, { passive: true });
  }

  /* ---------- Measurements: hero selection box and section sizes ---------- */
  var measureLocked = false;
  function measure() {
    var name = $('[data-measure]');
    var label = $('[data-measure-label]');
    if (name && label && !measureLocked) {
      var r = name.getBoundingClientRect();
      setValue(label, formatDim(r.width, r.height));
    }
    $$('[data-dim]').forEach(function (el) {
      if (el.__counting) return;
      var section = el.closest('section');
      if (!section) return;
      var s = section.getBoundingClientRect();
      setValue(el, formatDim(s.width, s.height));
    });
  }
  function initMeasure() {
    measure();
    var run = function () { window.requestAnimationFrame(measure); };
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(run);
      ro.observe(document.body);
      var name = $('[data-measure]');
      if (name) ro.observe(name);
    } else {
      window.addEventListener('resize', debounce(measure, 120));
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  }

  /* ---------- Rulers ---------- */
  function initRulers() {
    var hero = $('.hero');
    var xr = $('[data-ruler="x"]');
    var yr = $('[data-ruler="y"]');
    if (!hero || !xr || !yr) return;

    function build() {
      [[xr, 'left'], [yr, 'top']].forEach(function (pair) {
        var el = pair[0], side = pair[1];
        var size = side === 'left' ? el.offsetWidth : el.offsetHeight;
        var frag = document.createDocumentFragment();
        for (var i = 0; i < size; i += 100) {
          var n = document.createElement('span');
          n.setAttribute('data-value', String(i));
          n.style[side] = i + 'px';
          frag.appendChild(n);
        }
        el.textContent = '';
        el.appendChild(frag);
      });
    }
    build();
    window.addEventListener('resize', debounce(build, 150));

    var cx = $('.ruler--x .ruler__cursor b');
    var cy = $('.ruler--y .ruler__cursor b');
    var frame = 0;
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || frame) return;
      frame = window.requestAnimationFrame(function () {
        frame = 0;
        var xb = xr.getBoundingClientRect();
        var yb = yr.getBoundingClientRect();
        var x = Math.max(0, Math.round(e.clientX - xb.left));
        var y = Math.max(0, Math.round(e.clientY - yb.top));
        hero.style.setProperty('--mx', x + 'px');
        hero.style.setProperty('--my', y + 'px');
        if (cx) setValue(cx, String(x));
        if (cy) setValue(cy, String(y));
        hero.classList.add('is-tracking');
      });
    });
    hero.addEventListener('pointerleave', function () { hero.classList.remove('is-tracking'); });
  }

  /* ---------- Layout grid overlay (button or the G key) ---------- */
  function initGrid() {
    var btn = $('[data-grid-toggle]');
    var overlay = $('.grid-overlay');
    if (!btn || !overlay) return;
    var cols = $$('span', overlay);

    function set(on) {
      btn.setAttribute('aria-pressed', String(on));
      var gsap = window.gsap;
      if (!gsap || reduceMotion.matches) { overlay.classList.toggle('is-on', on); return; }
      gsap.killTweensOf(cols);
      if (on) {
        overlay.classList.add('is-on');
        gsap.fromTo(cols, { scaleY: 0, transformOrigin: 'top' }, { scaleY: 1, duration: 0.7, ease: 'expo.out', stagger: { each: 0.035, from: 'center' } });
      } else {
        gsap.to(cols, {
          scaleY: 0, transformOrigin: 'bottom', duration: 0.45, ease: 'power2.in', stagger: { each: 0.025, from: 'edges' },
          onComplete: function () { overlay.classList.remove('is-on'); }
        });
      }
    }

    btn.addEventListener('click', function () { set(btn.getAttribute('aria-pressed') !== 'true'); });
    document.addEventListener('keydown', function (e) {
      if ((e.key !== 'g' && e.key !== 'G') || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      if (window.getComputedStyle(btn).display === 'none') return;
      set(btn.getAttribute('aria-pressed') !== 'true');
    });
  }

  /* ---------- Copy email ---------- */
  function initCopy() {
    var btn = $('[data-copy-email]');
    var link = $('[data-email]');
    var status = $('[data-copy-status]');
    var label = $('[data-copy-label]');
    if (!btn || !link) return;
    if (!navigator.clipboard || !window.isSecureContext) { btn.hidden = true; return; }

    var timer;
    btn.addEventListener('click', function () {
      var address = decodeURIComponent(link.getAttribute('href').replace(/^mailto:/i, ''));
      navigator.clipboard.writeText(address).then(function () {
        clearTimeout(timer);
        btn.classList.add('is-done');
        if (label) label.textContent = 'Copied';
        if (status) status.textContent = 'Address copied to clipboard';
        timer = setTimeout(function () {
          btn.classList.remove('is-done');
          if (label) label.textContent = 'Copy address';
          if (status) status.textContent = '';
        }, 2400);
      }, function () {
        if (status) status.textContent = 'Could not copy. The address is ' + address;
      });
    });
  }

  /* ---------- Mobile menu ---------- */
  function initMenu() {
    var btn = $('[data-menu-toggle]');
    var menu = $('#menu');
    if (!btn || !menu) return;
    var label = $('.bar__menu-label', btn);
    var outside = [$('#main'), $('.foot')].filter(Boolean);

    function open() {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      if (label) label.textContent = 'Close';
      root.classList.add('menu-open');
      outside.forEach(function (el) { el.inert = true; });
      var first = $('a', menu);
      if (first) first.focus({ preventScroll: true });
      if (window.gsap && !reduceMotion.matches) {
        window.gsap.fromTo($$('.menu__list li, .menu__mail', menu), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.05 });
      }
    }
    function close(returnFocus) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (label) label.textContent = 'Menu';
      root.classList.remove('menu-open');
      outside.forEach(function (el) { el.inert = false; });
      if (returnFocus) btn.focus();
    }

    btn.addEventListener('click', function () {
      if (btn.getAttribute('aria-expanded') === 'true') close(true); else open();
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) close(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) close(true); });
    var wide = window.matchMedia('(min-width: 900px)');
    var onWide = function (e) { if (e.matches && !menu.hidden) close(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide); else wide.addListener(onWide);
  }

  /* ---------- Current section in the nav ---------- */
  function initActiveNav() {
    var links = $$('.bar__nav a');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var targets = Object.keys(byId).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var hero = document.getElementById('top');
    if (hero) targets.push(hero);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        var link = byId[entry.target.id];
        if (link) link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ---------- Cover intro: CSS runs the motion, JS counts the measurement ---------- */
  function initCoverIntro() {
    var name = $('[data-measure]');
    var label = $('[data-measure-label]');
    var letters = $$('.hc');
    var last = letters[letters.length - 1];
    var running = last && last.getAnimations && last.getAnimations().length > 0;
    if (!running) return;
    last.addEventListener('animationend', function () { measure(); }, { once: true });

    if (!name || !label) return;
    var pill = label.getAnimations ? label.getAnimations()[0] : null;
    var delay = 1050;
    var elapsed = pill && pill.currentTime != null ? pill.currentTime : 0;
    if (elapsed > delay + 1300) return;
    measureLocked = true;
    setTimeout(function () {
      var box = name.getBoundingClientRect();
      var t0 = performance.now();
      var duration = 1300;
      (function step(now) {
        var p = Math.min(1, (now - t0) / duration);
        var e = 1 - Math.pow(1 - p, 3);
        setValue(label, formatDim(box.width * e, box.height * e));
        if (p < 1) window.requestAnimationFrame(step);
        else { measureLocked = false; measure(); }
      })(t0);
    }, Math.max(0, delay - elapsed));
  }

  /* ---------- Motion (GSAP + ScrollTrigger + SplitText) ---------- */
  function initMotion() {
    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    var Split = window.SplitText;
    if (!gsap || !ST) return;
    gsap.registerPlugin(ST);
    if (Split) gsap.registerPlugin(Split);
    ST.config({ ignoreMobileResize: true });

    var split = function (el, vars) { return Split ? Split.create(el, vars) : null; };

    var steps = [progress, heads, products, work, record, words, contact, footer];
    var mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', function (ctx) {
      motionCtx = ctx;
      // One section per task keeps each setup step short on slow phones.
      var alive = true;
      (function next(i) {
        if (!alive || i >= steps.length) return;
        ctx.add(function () { steps[i](gsap, split); });
        setTimeout(function () { next(i + 1); }, 0);
      })(0);
      return function () { alive = false; motionCtx = null; };
    });

    window.addEventListener('load', function () { ST.refresh(); });
  }

  // Build an element's animation only when it is within reach, so text splitting
  // (which forces layout) happens a little at a time instead of all at start-up.
  var motionCtx = null;
  function whenNear(el, setup) {
    window.ScrollTrigger.create({
      trigger: el, start: 'top bottom+=80%', once: true,
      onEnter: function () { if (motionCtx) motionCtx.add(setup); }
    });
  }

  function progress(gsap) {
    gsap.to('.bar__progress', {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
    });
  }

  function countTo(gsap, el, opts) {
    var end = parseFloat(el.textContent);
    if (isNaN(end)) return null;
    var o = { v: 0 };
    el.textContent = '0';
    return gsap.to(o, Object.assign({
      v: end, duration: 1.4, ease: 'power3.out',
      onUpdate: function () { el.textContent = String(Math.round(o.v)); }
    }, opts || {}));
  }

  function heads(gsap, split) {
    $$('.head').forEach(function (head) {
      var rule = $('.head__rule', head);
      var dim = $('[data-dim]', head);
      var tl = gsap.timeline({ scrollTrigger: { trigger: head, start: 'top 82%', once: true } });
      if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut' }, 0);
      tl.fromTo($$('.head__n, .head__label', head), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' }, 0.1);
      if (dim) {
        tl.add(function () {
          var m = /(\d+)\D+(\d+)/.exec(getValue(dim));
          if (!m) return;
          var o = { w: 0, h: 0 };
          dim.__counting = true;
          gsap.to(o, {
            w: +m[1], h: +m[2], duration: 1.4, ease: 'power3.out',
            onUpdate: function () { setValue(dim, formatDim(o.w, o.h)); },
            onComplete: function () { dim.__counting = false; measure(); }
          });
        }, 0.2);
      }
      var note = $('.head__note', head);
      if (note) tl.fromTo(note, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }, 0.45);
    });

    $$('[data-split]').forEach(function (title) {
      whenNear(title, function () {
        var s = split(title, { type: 'lines', mask: 'lines', linesClass: 'line' });
        if (!s) return;
        gsap.fromTo(s.lines, { yPercent: 130 }, {
          yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1,
          scrollTrigger: { trigger: title, start: 'top 85%', once: true },
          onComplete: function () { s.revert(); }
        });
      });
    });
  }

  function products(gsap, split) {
    $$('.product').forEach(function (product) {
      whenNear(product, function () {
        var text = $('.product__text', product);
        var name = $('[data-split-chars]', product);
        var visual = $('.product__visual', product);
        var tl = gsap.timeline({ scrollTrigger: { trigger: product, start: 'top 72%', once: true } });

        var s = name ? split(name, { type: 'words,chars', mask: 'words', wordsClass: 'pw' }) : null;
        if (s) {
          tl.fromTo(s.chars, { yPercent: 140 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.035, onComplete: function () { s.revert(); } }, 0.1);
        }
        tl.fromTo($$('.product__kind, .product__tagline, .product__desc, .product__figures > div, .product__features li, .product__meta, .product__links li', text),
          { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.05 }, 0.25);
        if (visual) {
          tl.fromTo(visual, { clipPath: 'inset(0% 0% 100% 0%)', y: 30 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1.3, ease: 'expo.inOut' }, 0.15);
        }
      });
    });

    var report = $('[data-report]');
    if (report) {
      var rt = gsap.timeline({ scrollTrigger: { trigger: report, start: 'top 70%', once: true } });
      $$('[data-count]', report).forEach(function (el, i) { rt.add(countTo(gsap, el, { duration: 1.6 }), 0.5 + i * 0.08); });
      rt.fromTo($$('.report__row', report), { autoAlpha: 0, x: -14 }, { autoAlpha: 1, x: 0, duration: 0.8, ease: 'power3.out', stagger: 0.15 }, 0.6)
        .fromTo($$('.report__meter span', report), { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut', stagger: 0.18 }, 0.75);
      $$('.report__pct', report).forEach(function (el, i) {
        var o = { v: 0 };
        rt.to(o, { v: 100, duration: 1.4, ease: 'expo.inOut', onUpdate: function () { el.textContent = Math.round(o.v) + '%'; } }, 0.75 + i * 0.18);
      });
    }

    var recipe = $('[data-recipe]');
    if (recipe) {
      var items = $$('.recipe__log li', recipe);
      var state = $('[data-recipe-state]', recipe);
      var bar = $('.recipe__progress span', recipe);
      var total = items.length;
      var log = $('.recipe__log', recipe);
      if (log) log.classList.add('is-pending');
      if (bar) gsap.set(bar, { scaleX: 0 });
      if (state) state.textContent = 'Ready';
      var ct = gsap.timeline({ scrollTrigger: { trigger: recipe, start: 'top 70%', once: true } });
      ct.fromTo($('.recipe__code', recipe), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0.4)
        .add(function () { if (state) state.textContent = 'Deploying 0 / ' + total; }, 0.8);
      items.forEach(function (li, i) {
        var at = 1 + i * 0.22;
        ct.add(function () { li.classList.add('is-done'); }, at)
          .to(bar, { scaleX: (i + 1) / total, duration: 0.2, ease: 'power1.out' }, at)
          .add(function () { if (state) state.textContent = (i + 1 === total ? 'Done ' : 'Deploying ') + (i + 1) + ' / ' + total; }, at);
      });
    }
  }

  function work(gsap) {
    $$('.card').forEach(function (card) {
      var win = $('.card__window', card);
      var pan = $('.card__pan', card);
      var img = $('img', card);
      var bits = $$('.card__label, .card__meta', card);

      var tl = gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 88%', once: true } });
      tl.fromTo(win, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut' }, 0)
        .fromTo(img, { scale: 1.18, transformOrigin: '50% 0%' }, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0.15)
        .fromTo(bits, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1 }, 0.55);

      gsap.fromTo(pan, { y: 0 }, {
        y: function () { return -Math.max(0, pan.offsetHeight - win.clientHeight); },
        ease: 'none',
        scrollTrigger: { trigger: win, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true }
      });
    });

    var logos = $$('.clients__grid li');
    if (logos.length) {
      gsap.fromTo(logos, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: { each: 0.04, from: 'start' },
        scrollTrigger: { trigger: '.clients', start: 'top 85%', once: true }
      });
    }
    var end = $('.work__end');
    if (end) {
      gsap.fromTo(end.children, { autoAlpha: 0, y: 20 }, {
        autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.1,
        scrollTrigger: { trigger: end, start: 'top 85%', once: true }
      });
    }
  }

  function record(gsap) {
    var avatar = $('.avatar');
    if (avatar) {
      var at = gsap.timeline({ scrollTrigger: { trigger: avatar, start: 'top 80%', once: true } });
      at.fromTo($('img', avatar), { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 1.1, ease: 'expo.out' }, 0)
        .fromTo($('.selection', avatar), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.35)
        .fromTo($$('.selection i', avatar), { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', stagger: 0.07 }, 0.4);
    }
    var bio = $$('.record__bio p');
    if (bio.length) {
      gsap.fromTo(bio, { autoAlpha: 0, y: 20 }, {
        autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.12,
        scrollTrigger: { trigger: '.record__bio', start: 'top 82%', once: true }
      });
    }

    var figures = $('.figures');
    if (figures) {
      var ft = gsap.timeline({ scrollTrigger: { trigger: figures, start: 'top 80%', once: true } });
      $$('.figures__item', figures).forEach(function (item, i) {
        ft.fromTo(item, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' }, i * 0.08);
        var n = $('[data-count]', item);
        if (n) ft.add(countTo(gsap, n, { duration: 1.6 }), 0.1 + i * 0.08);
      });
    }

    $$('.timeline__list').forEach(function (list) {
      gsap.fromTo($$('.role', list), { autoAlpha: 0, y: 22 }, {
        autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1,
        scrollTrigger: { trigger: list, start: 'top 82%', once: true }
      });
    });

    var layers = $('.layers');
    if (layers) {
      gsap.fromTo($$('summary, li', layers), { autoAlpha: 0, x: -10 }, {
        autoAlpha: 1, x: 0, duration: 0.5, ease: 'power2.out', stagger: 0.03,
        scrollTrigger: { trigger: layers, start: 'top 80%', once: true }
      });
    }

    var speed = $('.speed');
    if (speed) {
      var st = gsap.timeline({ scrollTrigger: { trigger: speed, start: 'top 80%', once: true } });
      st.fromTo($('.speed__frame', speed), { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.inOut' }, 0);
      var n = $('[data-count]', speed);
      if (n) st.add(countTo(gsap, n, { duration: 1.6 }), 0.5);
    }
  }

  function words(gsap, split) {
    var lead = $('[data-read]');
    if (lead) {
      whenNear(lead, function () {
        var big = $('.quote__big', lead);
        var bs = big ? split(big, { type: 'lines', mask: 'lines', linesClass: 'bl', tag: 'span', aria: 'none' }) : null;
        if (bs) {
          gsap.fromTo(bs.lines, { yPercent: 130 }, {
            yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1,
            scrollTrigger: { trigger: lead, start: 'top 80%', once: true },
            onComplete: function () { bs.revert(); }
          });
        }
        var restEl = $('.quote__rest', lead);
        var rest = restEl ? split(restEl, { type: 'words', wordsClass: 'qw', tag: 'span', aria: 'none' }) : null;
        if (rest) {
          gsap.fromTo(rest.words, { color: '#67645d' }, {
            color: '#151513', ease: 'none', stagger: 0.05,
            scrollTrigger: { trigger: lead, start: 'top 70%', end: 'bottom 45%', scrub: 0.5 }
          });
        }
      });
      gsap.fromTo($('.quote--lead .quote__by'), { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: '.quote--lead .quote__by', start: 'top 90%', once: true }
      });
    }

    $$('.quotes .quote').forEach(function (q) {
      gsap.fromTo(q, { autoAlpha: 0, y: 30 }, {
        autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: q, start: 'top 88%', once: true }
      });
    });
  }

  function contact(gsap) {
    var zones = $('.zones');
    if (zones) {
      var paths = $$('.zones__arcs path', zones);
      paths.forEach(function (p) { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1'; });
      var zt = gsap.timeline({ scrollTrigger: { trigger: zones, start: 'top 75%', once: true } });
      zt.fromTo($('.zones__map img', zones), { autoAlpha: 0 }, { autoAlpha: 0.7, duration: 1.2, ease: 'power2.out' }, 0)
        .fromTo($$('.pin', zones), { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(2.5)', stagger: 0.12 }, 0.3)
        .fromTo(paths, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: 'expo.inOut', stagger: 0.15 }, 0.5)
        .fromTo($$('.zones__clocks > div', zones), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 }, 0.6);
    }
    var mail = $('.contact__mail');
    if (mail) {
      gsap.fromTo(mail.children, { autoAlpha: 0, y: 20 }, {
        autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.1,
        scrollTrigger: { trigger: mail, start: 'top 85%', once: true }
      });
    }
    var list = $$('.profiles__list li');
    if (list.length) {
      gsap.fromTo(list, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.05,
        scrollTrigger: { trigger: '.profiles', start: 'top 88%', once: true }
      });
    }
  }

  function footer(gsap) {
    var spec = $('.specimen');
    if (!spec) return;
    var ft = gsap.timeline({ scrollTrigger: { trigger: spec, start: 'top 90%', once: true } });
    ft.fromTo($('.specimen__word', spec), { yPercent: 40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.4, ease: 'expo.out' }, 0)
      .fromTo($$('.g', spec), { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut', stagger: 0.12 }, 0.2)
      .fromTo($$('.g b', spec), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, stagger: 0.12 }, 0.9);
  }

  /* ---------- Boot ---------- */
  function boot() {
    var idle = window.requestIdleCallback || function (cb) { return setTimeout(cb, 1); };
    initClocks();
    initViewportTag();
    initGrid();
    initCopy();
    initMenu();
    initCoverIntro();
    idle(function () { initMeasure(); initRulers(); initActiveNav(); }, { timeout: 800 });

    if (reduceMotion.matches) return;
    var started = false;
    var start = function () {
      if (started || !window.gsap) return;
      started = true;
      var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      fontsReady.then(function () { idle(initMotion, { timeout: 1200 }); });
    };
    // This file loads before the GSAP files (all deferred), so they have run by DOMContentLoaded.
    if (window.gsap) start();
    else {
      document.addEventListener('DOMContentLoaded', start, { once: true });
      window.addEventListener('load', start, { once: true });
    }
  }

  boot();
})();
