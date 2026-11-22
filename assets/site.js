/* West Hollywood College Preparatory School — shared site script.
   Each page is a real HTML file now, so there is no client-side router. */
(function () {
  'use strict';

  /* Old bookmarks like /#calendar or /?p=... from the single-page version: send to the real page. */
  var ROUTES = ["about", "accessibility", "admissions", "after-school", "calendar", "careers", "contact", "early-childhood", "elementary", "giving", "home", "individual", "international", "middle-high", "mission", "parents", "principals-message", "privacy", "programs", "students", "terms", "transcripts", "tutoring"];
  var SHEET_URL = "https://script.google.com/macros/s/AKfycbxJmwCwu1NM00LCD87KhHaC608bkLGOoXIZK-ZNzmGt0DYXbrO9MFa7IINx9oaTvTSHiw/exec";  // Google Apps Script web app (set in build.py); empty = off
  var h = location.hash.replace(/^#\/?/, '');
  if (h === 'k-elementary') h = 'elementary';  // route was renamed
  if (h && h !== 'app' && ROUTES.indexOf(h) !== -1) {
    location.replace(h === 'home' ? '/' : '/' + h);
    return;
  }

  /* Masthead shadow on scroll */
  var masthead = document.getElementById('masthead');
  if (masthead) {
    window.addEventListener('scroll', function () {
      masthead.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });
  }

  /* Mobile menu */
  var burger = document.getElementById('burger');
  var mobnav = document.getElementById('mobnav');
  if (burger && mobnav) {
    burger.addEventListener('click', function () {
      var open = mobnav.classList.toggle('open');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  /* Hero slideshow (home page only) */
  // Which slides show today (Los Angeles date):
  //   data-from / data-until or data-when="MM-DD:MM-DD,MM-DD:MM-DD" limit a slide to those dates;
  //   data-group="program" slides take turns: one in-season program slide shows at a time;
  //   dots are made for whatever is left.
  (function () {
    var box = document.getElementById('heroSlides');
    if (!box) return;
    var la = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    var pad = function (n) { return ('0' + n).slice(-2); };
    var md = pad(la.getMonth() + 1) + '-' + pad(la.getDate());
    var today = la.getFullYear() + '-' + md;
    var inSeason = function (s) {
      var when = s.getAttribute('data-when');
      if (!when && s.getAttribute('data-from')) when = s.getAttribute('data-from') + ':' + s.getAttribute('data-until');
      if (!when) return true;
      return when.split(',').some(function (r) { var x = r.split(':'); return md >= x[0] && md <= x[1]; });
    };
    var drop = function (s) { s.parentNode.removeChild(s); };
    var slides = Array.prototype.slice.call(box.querySelectorAll('.hero-slide'));
    var programs = [], fallback = null;
    slides.forEach(function (s) {
      if (s.getAttribute('data-group') === 'program') {
        if (s.hasAttribute('data-fallback')) fallback = s;
        else if (inSeason(s)) programs.push(s); else drop(s);
      } else if (!inSeason(s)) drop(s);
    });
    // When several program slides are in season, they take turns week by week.
    if (programs.length) {
      var week = Math.floor(Date.UTC(la.getFullYear(), la.getMonth(), la.getDate()) / 6048e5);
      var keep = programs[week % programs.length];
      programs.forEach(function (s) { if (s !== keep) drop(s); });
      if (fallback) drop(fallback);
    }
    Array.prototype.forEach.call(box.querySelectorAll('[data-year]'), function (el) { el.textContent = la.getFullYear(); });
    var ind = document.getElementById('heroInd');
    if (ind) {
      ind.innerHTML = '';
      Array.prototype.forEach.call(box.querySelectorAll('.hero-slide'), function (s, i) {
        var bt = document.createElement('button'); bt.type = 'button'; bt.setAttribute('aria-label', 'Slide ' + (i + 1));
        if (i === 0) bt.className = 'active';
        ind.appendChild(bt);
      });
    }
  })();
  var slides = document.querySelectorAll('#heroSlides .hero-slide');
  var dots = document.querySelectorAll('#heroInd button');
  var hero = document.querySelector('.hero');
  var current = 0, timer = null;
  function goSlide(n, manual) {
    if (!slides.length) return;
    slides[current].classList.remove('active');
    if (dots[current]) dots[current].classList.remove('active');
    current = n % slides.length;
    slides[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('active');
    // A slide with its own words (like the toy drive) hides the usual welcome text while it shows.
    var own = slides[current].classList.contains('hero-slide--own');
    if (hero) hero.classList.toggle('hero--own', own);
    if (hero) hero.classList.toggle('hero--dark', own && slides[current].classList.contains('is-dark'));
    Array.prototype.forEach.call(slides, function (s, i) { if (s.classList.contains('hero-slide--own')) { s.setAttribute('aria-hidden', i === current ? 'false' : 'true'); if (i === current) s.removeAttribute('inert'); else s.setAttribute('inert', ''); } });
    restart();
  }
  // Each slide shows for 6.5 seconds; data-hold="2" keeps one up twice as long (the toy drive).
  function restart() {
    if (timer) clearTimeout(timer);
    var hold = +(slides[current].getAttribute('data-hold') || 1);
    timer = setTimeout(function () { goSlide(current + 1); }, 6500 * hold);
  }
  if (slides.length) {
    dots.forEach(function (b, i) { b.addEventListener('click', function () { goSlide(i, true); }); });
    restart();
  }

  /* Toy drive slide: a gift jumps, pops its lid and sparkles when the mouse goes over it (or it's tapped) */
  var giftArt = document.querySelector('.toy-gifts');
  if (giftArt) {
    var popGift = function (g) {
      if (g.classList.contains('pop')) return;
      var key = (g.getAttribute('class').match(/\bg\d\b/) || [''])[0];
      var moving = [g];
      if (key === 'g2') { var top = giftArt.querySelector('.gift.g1'); if (top) moving.push(top); }   // the bottom box carries the one stacked on it
      var burst = giftArt.querySelector('.burst.b-' + key);
      moving.forEach(function (m) { m.classList.add('pop'); });
      if (burst) burst.classList.add('pop');
      setTimeout(function () { moving.forEach(function (m) { m.classList.remove('pop'); }); if (burst) burst.classList.remove('pop'); }, 950);
    };
    var onGift = function (e) { var g = e.target.closest && e.target.closest('.gift'); if (g) popGift(g); };
    giftArt.addEventListener('pointerover', onGift);
    giftArt.addEventListener('click', onGift);
  }

  /* "How did you hear about us?": show the details box for referrals and Other */
  document.querySelectorAll('select[data-more]').forEach(function (sel) {
    var wrap = document.getElementById(sel.getAttribute('data-more'));
    if (!wrap) return;
    var update = function () {
      wrap.hidden = !/referral|other/i.test(sel.value);
      if (wrap.hidden) wrap.querySelector('input').value = '';
    };
    sel.addEventListener('change', update);
    sel.form.addEventListener('reset', function () { setTimeout(update, 0); });
  });

  /* Copy each inquiry into the school's Google Sheet (fire-and-forget; Formspree email still sends) */
  function sendToSheet(form, type) {
    if (!SHEET_URL) return;
    var p = new URLSearchParams();
    new FormData(form).forEach(function (v, k) { if (k.charAt(0) !== '_') p.append(k, v); });
    if (!p.has('newsletter_opt_in')) p.append('newsletter_opt_in', 'No');
    p.append('form', type);
    p.append('page', location.pathname);
    try {
      if (!(navigator.sendBeacon && navigator.sendBeacon(SHEET_URL, p))) {
        fetch(SHEET_URL, { method: 'POST', mode: 'no-cors', body: p, keepalive: true });
      }
    } catch (err) { /* never block the form */ }
  }

  /* Forms (Formspree) */
  document.addEventListener('submit', async function (e) {
    var form = e.target;
    if (form.id !== 'contact-form' && form.id !== 'admissions-form') return;
    e.preventDefault();
    var isAdm = form.id === 'admissions-form';
    if (!form.querySelector('[name="_gotcha"]').value) sendToSheet(form, isAdm ? 'Admissions' : 'Contact');
    var btn = form.querySelector('[type="submit"]');
    var status = document.getElementById(isAdm ? 'admissions-status' : 'contact-status');
    var idle = isAdm ? 'Submit Inquiry' : 'Send Message';
    btn.disabled = true;
    btn.textContent = 'Sending…';
    status.className = 'form-status';
    try {
      var res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error();
      status.textContent = isAdm
        ? "Thank you for your inquiry. We'll be in touch within 1–2 business days."
        : "Thank you for reaching out. We'll be in touch within 1–2 business days.";
      status.className = 'form-status ok';
      form.reset();
    } catch (err) {
      status.textContent = 'Something went wrong. Please call us at (323) 822-7900.';
      status.className = 'form-status err';
    }
    btn.disabled = false;
    btn.textContent = idle;
  });
})();
