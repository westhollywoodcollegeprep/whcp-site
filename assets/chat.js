/* WHCP website assistant: chat bubble.
   No cookies. The conversation is kept in this browser tab only (sessionStorage) so it
   survives clicking a link to another page, and is cleared when the tab is closed. */
(function () {
  'use strict';
  var URL_ = "https://whcp-chat.westhollywoodcollegeprep.workers.dev/";
  if (!URL_) return;
  var PHONE = '(323) 822-7900';
  var GREETING = 'Hi! I’m Athena, WHCP’s AI assistant. I can answer questions about programs, grades, tuition, hours, and how to visit. What would you like to know?';
  var history = [];
  var busy = false;
  var open = false;
  var pushedState = false;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function store(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

  // Page names the chat mentions ("our Admissions page") become links.
  var PAGES = [
    ['Middle & High School', '/middle-high'], ['Middle and High School', '/middle-high'],
    ['Early Childhood', '/early-childhood'], ['Elementary School', '/elementary'], ['Elementary', '/elementary'],
    ['After School Programs', '/after-school'], ['After School Program', '/after-school'], ['After School', '/after-school'],
    ['Tutoring Center', '/tutoring'], ['Tutoring', '/tutoring'], ['Individual Programs', '/individual'],
    ['International Students', '/international'], ['International', '/international'],
    ['Admissions', '/admissions'], ['Contact', '/contact'], ['About', '/about'], ['Programs', '/programs'],
    ['Calendar', '/calendar'], ['Careers', '/careers'], ['Giving', '/giving'], ['Parents', '/parents'],
    ['Students', '/students'], ['Mission', '/mission'], ['Principal’s Message', '/principals-message'],
    ["Principal's Message", '/principals-message'], ['Privacy Policy', '/privacy'],
    ['Transcripts & Diplomas', '/transcripts'], ['Transcripts and Diplomas', '/transcripts'],
  ];
  var pageIndex = {};
  PAGES.forEach(function (p) { pageIndex[p[0].toLowerCase()] = p[1]; });
  var pageAlt = PAGES.map(function (p) { return p[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
  var LINK_RE = new RegExp('(https?:\\/\\/[^\\s)]+[^\\s).,!?:;])|(\\(323\\) 822-7900)|(info@westhollywoodschool\\.com)|\\b(' + pageAlt + ')( page)\\b', 'gi');

  // Turn URLs, the phone number, the email and page names into links (text only, never HTML from the model).
  function addText(node, text) {
    var last = 0, m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text))) {
      if (m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = el('a', null, m[0]);
      if (m[1]) {
        a.href = m[1];
        if (m[1].indexOf('westhollywoodschool.com') === -1) { a.target = '_blank'; a.rel = 'noopener'; }
      } else if (m[2]) {
        a.href = 'tel:+13238227900';
      } else if (m[3]) {
        a.href = 'mailto:info@westhollywoodschool.com';
      } else {
        a.href = pageIndex[m[4].toLowerCase()] || '/';
      }
      node.appendChild(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
  }

  var SPK = '<svg class="wc-spk" viewBox="0 0 40 40"><path class="s1" d="M26 2c.9 6.2 3.3 8.6 9.5 9.5-6.2.9-8.6 3.3-9.5 9.5-.9-6.2-3.3-8.6-9.5-9.5C22.7 10.6 25.1 8.2 26 2z"/><path class="s2" d="M11 14c.5 3.4 1.8 4.7 5.2 5.2-3.4.5-4.7 1.8-5.2 5.2-.5-3.4-1.8-4.7-5.2-5.2 3.4-.5 4.7-1.8 5.2-5.2z"/><path class="s3" d="M34 24c.4 2.6 1.4 3.6 4 4-2.6.4-3.6 1.4-4 4-.4-2.6-1.4-3.6-4-4 2.6-.4 3.6-1.4 4-4z"/></svg>';
  var btn = el('button', 'wc-launch');
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'wc-panel');
  btn.setAttribute('aria-label', 'Chat with Athena, WHCP’s AI assistant');
  btn.innerHTML = '<span class="wc-owl" aria-hidden="true"><span class="wc-owl-art"></span><svg class="wc-spk" viewBox="0 0 40 40"><path class="s1" d="M26 2c.9 6.2 3.3 8.6 9.5 9.5-6.2.9-8.6 3.3-9.5 9.5-.9-6.2-3.3-8.6-9.5-9.5C22.7 10.6 25.1 8.2 26 2z"/><path class="s2" d="M11 14c.5 3.4 1.8 4.7 5.2 5.2-3.4.5-4.7 1.8-5.2 5.2-.5-3.4-1.8-4.7-5.2-5.2 3.4-.5 4.7-1.8 5.2-5.2z"/><path class="s3" d="M34 24c.4 2.6 1.4 3.6 4 4-2.6.4-3.6 1.4-4 4-.4-2.6-1.4-3.6-4-4 2.6-.4 3.6-1.4 4-4z"/></svg></span>';

  // Welcome bubble: the owl "says hi" once per visit, with tap-to-ask topics.
  var TOPICS = [['Tuition', 'How much is tuition?'], ['Grades', 'What grades do you have?'], ['Book a tour', 'How do I schedule a tour?']];
  var peek = el('div', 'wc-peek');
  peek.hidden = true;
  var say = el('button', 'wc-say');
  say.type = 'button';
  say.innerHTML = '<b>Hi, I’m Athena!</b> Wondering about tuition, grades, or a tour? Ask me anything.';
  var px = el('button', 'wc-px');
  px.type = 'button';
  px.setAttribute('aria-label', 'Dismiss');
  px.innerHTML = '&times;';
  var ptop = el('div', 'wc-saywrap');
  ptop.appendChild(say);
  ptop.appendChild(px);
  var pchips = el('div', 'wc-pchips');
  TOPICS.forEach(function (t) {
    var c = el('button', 'wc-pchip', t[0]);
    c.type = 'button';
    c.addEventListener('click', function () { setOpen(true); send(t[1]); });
    pchips.appendChild(c);
  });
  peek.appendChild(ptop);
  peek.appendChild(pchips);
  var peekTimer;
  function hidePeek(remember) {
    clearTimeout(peekTimer);
    peek.classList.remove('wc-in');
    setTimeout(function () { peek.hidden = true; document.documentElement.classList.remove('wc-peeking'); }, 250);
    if (remember) store('wc-peeked', '1');
  }
  function showPeek() {
    if (open) return;
    peek.hidden = false;
    document.documentElement.classList.add('wc-peeking');
    requestAnimationFrame(function () { peek.classList.add('wc-in'); });
    store('wc-peeked', '1');
    // On small screens it tucks itself away after a while so it doesn't cover the page.
    if (window.innerWidth < 600) peekTimer = setTimeout(function () { hidePeek(false); }, 12000);
  }
  say.addEventListener('click', function () { setOpen(true); });
  px.addEventListener('click', function () { hidePeek(true); });

  var panel = el('section', 'wc-panel');
  panel.id = 'wc-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Chat with Athena, WHCP’s AI assistant');
  panel.hidden = true;

  var head = el('div', 'wc-head');
  var hav = el('span', 'wc-hav');
  hav.setAttribute('aria-hidden', 'true');
  hav.innerHTML = '<span class="wc-owl-art"></span>' + SPK;
  var title = el('div', 'wc-title');
  title.appendChild(el('b', null, 'Athena'));
  title.appendChild(el('small', null, 'Powered by AI'));
  var close = el('button', 'wc-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close chat');
  close.innerHTML = '&times;';
  var fresh = el('button', 'wc-new');
  fresh.type = 'button';
  fresh.setAttribute('aria-label', 'Start a new chat');
  fresh.title = 'New chat';
  fresh.hidden = true;
  fresh.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.7h3.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  head.appendChild(hav);
  head.appendChild(title);
  head.appendChild(fresh);
  head.appendChild(close);

  var log = el('div', 'wc-log');
  log.setAttribute('aria-live', 'polite');

  var chips = el('div', 'wc-chips');
  ['What grades do you have?', 'How much is tuition?', 'How do I schedule a tour?', 'Do you have after school?'].forEach(function (q) {
    var c = el('button', 'wc-chip', q);
    c.type = 'button';
    c.addEventListener('click', function () { send(q); });
    chips.appendChild(c);
  });

  var form = el('form', 'wc-form');
  var input = el('input');
  input.type = 'text';
  input.maxLength = 500;
  input.placeholder = 'Type a question…';
  input.setAttribute('aria-label', 'Your question');
  input.autocomplete = 'off';
  var go = el('button', 'wc-send');
  go.type = 'submit';
  go.setAttribute('aria-label', 'Send');
  go.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  form.appendChild(input);
  form.appendChild(go);

  var note = el('p', 'wc-note');
  note.appendChild(document.createTextNode('For adults. Don’t share private info. Chats are saved to improve answers. '));
  var pol = el('a', null, 'Privacy Policy');
  pol.href = '/privacy';
  note.appendChild(pol);

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(chips);
  panel.appendChild(form);
  panel.appendChild(note);

  var lastWho = '';
  function bubble(role, text) {
    var who = role.split(' ')[0];
    if (who !== lastWho) log.appendChild(el('div', 'wc-name wc-name-' + who, who === 'user' ? 'You' : 'Athena'));
    lastWho = who;
    var b = el('div', 'wc-msg wc-' + role);
    addText(b, text);
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  // "Talk to a person" buttons under the latest real answer.
  function addActions(opt) {
    var old = log.querySelector('.wc-acts');
    if (old) old.remove();
    opt = opt || {};
    var a = opt.actions || {}, next = opt.next || [];
    if (!a.call && !a.tour && !next.length) return;
    var acts = el('div', 'wc-acts');
    next.forEach(function (q) {
      var c = el('button', 'wc-chip', q);
      c.type = 'button';
      c.addEventListener('click', function () { send(q); });
      acts.appendChild(c);
    });
    if (a.call) { var call = el('a', 'wc-act wc-act--solid', 'Call us'); call.href = 'tel:+13238227900'; acts.appendChild(call); }
    if (a.tour) { var tour = el('a', 'wc-act wc-act--solid', 'Schedule a tour'); tour.href = '/contact'; acts.appendChild(tour); }
    log.appendChild(acts);
    log.scrollTop = log.scrollHeight;
  }

  // A random id per conversation, so the chat log can show each conversation in order.
  function chatId() {
    var id = load('wc-id');
    if (!id) { id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); store('wc-id', id); }
    return id;
  }
  if (!load('wc-ref')) store('wc-ref', (document.referrer && document.referrer.indexOf(location.host) === -1 ? document.referrer : 'direct').slice(0, 300));

  function save() {
    store('wc-hist', JSON.stringify(history.slice(-24)));
    fresh.hidden = !history.length;
  }

  // Start over: clear the conversation and show the greeting again.
  fresh.addEventListener('click', function () {
    history = [];
    save();
    store('wc-next', '');
    store('wc-id', '');
    log.innerHTML = '';
    lastWho = '';
    bubble('bot', GREETING);
    chips.hidden = false;
    input.value = '';
    input.focus();
  });

  function setOpen(v, fromBack) {
    open = v;
    panel.hidden = !v;
    btn.setAttribute('aria-expanded', String(v));
    document.documentElement.classList.toggle('wc-open', v);
    store('wc-isopen', v ? '1' : '0');
    if (v) {
      if (!peek.hidden) hidePeek(true);
      if (!log.childNodes.length) bubble('bot', GREETING);
      // On phones the chat fills the screen, so the back button should close it, not leave the page.
      if (window.innerWidth <= 480 && !pushedState) {
        try { window.history.pushState({ wcChat: 1 }, ''); pushedState = true; } catch (e) {}
      }
      setTimeout(function () { input.focus(); }, 30);
    } else {
      if (pushedState && !fromBack) {
        pushedState = false;
        try { window.history.back(); } catch (e) {}
      }
      pushedState = false;
      btn.focus();
    }
  }

  function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    busy = true;
    go.disabled = true;
    chips.hidden = true;
    var old = log.querySelector('.wc-acts');
    if (old) old.remove();
    bubble('user', text);
    history.push({ role: 'user', content: text });
    save();
    input.value = '';
    var wait = bubble('bot wc-wait', '');
    wait.innerHTML = '<span class="wc-dots"><i></i><i></i><i></i></span><span class="wc-sr">Typing…</span>';
    fetch(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-12), page: location.pathname, chatId: chatId(), ref: load('wc-ref') || '' }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; });
    }).then(function (res) {
      wait.remove();
      if (res.d && res.d.reply) {
        bubble('bot', res.d.reply);
        history.push({ role: 'assistant', content: res.d.reply });
        save();
        addActions({ actions: res.d.actions, next: res.d.next });
        store('wc-next', JSON.stringify({ actions: res.d.actions || {}, next: res.d.next || [] }));
      } else {
        history.pop();
        save();
        bubble('bot', res.status === 429
          ? 'That’s a lot of questions at once! Give it a few minutes, or call us at ' + PHONE + '.'
          : 'Sorry, I can’t answer right now. Please call us at ' + PHONE + ' or email info@westhollywoodschool.com.');
      }
    }).catch(function () {
      wait.remove();
      history.pop();
      save();
      bubble('bot', 'Sorry, I can’t connect right now. Please call us at ' + PHONE + '.');
    }).then(function () {
      busy = false;
      go.disabled = false;
      if (open) input.focus();
    });
  }

  btn.addEventListener('click', function () { setOpen(!open); });
  close.addEventListener('click', function () { setOpen(false); });
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  window.addEventListener('popstate', function () { if (open && pushedState) { pushedState = false; setOpen(false, true); } });
  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    // Keep keyboard focus inside the chat while it's open.
    if (e.key === 'Tab') {
      var f = Array.prototype.filter.call(panel.querySelectorAll('a[href], button:not([disabled]), input'), function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && (document.activeElement === lastEl || !panel.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  });

  document.body.appendChild(peek);
  document.body.appendChild(panel);
  document.body.appendChild(btn);

  // Pick the conversation back up after moving to another page in the same tab.
  try { history = JSON.parse(load('wc-hist') || '[]').filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'; }); } catch (e) { history = []; }
  if (history.length) {
    bubble('bot', GREETING);
    history.forEach(function (m) { bubble(m.role === 'user' ? 'user' : 'bot', m.content); });
    chips.hidden = true;
    fresh.hidden = false;
    if (history[history.length - 1].role === 'assistant') { try { addActions(JSON.parse(load('wc-next') || '{}')); } catch (e) {} }
    // Reopen it on wider screens; on phones it would cover the page they just went to.
    if (load('wc-isopen') === '1' && window.innerWidth >= 600) setOpen(true);
  }

  if (load('wc-peeked') !== '1' && !history.length) setTimeout(showPeek, 4000);
})();
