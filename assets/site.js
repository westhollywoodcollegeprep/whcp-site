/* West Hollywood College Preparatory School — shared site script.
   Each page is a real HTML file now, so there is no client-side router. */
(function () {
  'use strict';

  /* Old bookmarks like /#calendar or /?p=... from the single-page version: send to the real page. */
  var ROUTES = ["about", "accessibility", "admissions", "after-school", "calendar", "careers", "contact", "early-childhood", "elementary", "giving", "home", "individual", "international", "middle-high", "mission", "parents", "principals-message", "privacy", "programs", "students", "terms", "tutoring"];
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
  var slides = document.querySelectorAll('#heroSlides .hero-slide');
  var dots = document.querySelectorAll('#heroInd button');
  var current = 0, timer = null;
  function goSlide(n, manual) {
    if (!slides.length) return;
    slides[current].classList.remove('active');
    if (dots[current]) dots[current].classList.remove('active');
    current = n % slides.length;
    slides[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('active');
    if (manual) restart();
  }
  function restart() {
    if (timer) clearInterval(timer);
    timer = setInterval(function () { goSlide(current + 1); }, 6500);
  }
  if (slides.length) {
    dots.forEach(function (b, i) { b.addEventListener('click', function () { goSlide(i, true); }); });
    restart();
  }

  /* Forms (Formspree) */
  document.addEventListener('submit', async function (e) {
    var form = e.target;
    if (form.id !== 'contact-form' && form.id !== 'admissions-form') return;
    e.preventDefault();
    var isAdm = form.id === 'admissions-form';
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
