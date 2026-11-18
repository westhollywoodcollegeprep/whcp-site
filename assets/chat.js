/* WHCP website assistant: chat bubble (no cookies, nothing stored after the tab closes) */
(function () {
  'use strict';
  var URL_ = "https://whcp-chat.westhollywoodcollegeprep.workers.dev/";
  if (!URL_) return;
  var PHONE = '(323) 822-7900';
  var history = [];
  var busy = false;
  var open = false;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Turn plain URLs in a reply into links (text only, never HTML from the model).
  function addText(node, text) {
    var re = /(https?:\/\/[^\s)]+[^\s).,!?])|(\(323\) 822-7900)|(info@westhollywoodschool\.com)/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = el('a', null, m[0]);
      a.href = m[1] ? m[1] : m[2] ? 'tel:+13238227900' : 'mailto:info@westhollywoodschool.com';
      if (m[1] && m[1].indexOf('westhollywoodschool.com') === -1) { a.target = '_blank'; a.rel = 'noopener'; }
      node.appendChild(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
  }

  var btn = el('button', 'wc-launch');
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'wc-panel');
  btn.setAttribute('aria-label', 'Ask WHCP a question');
  btn.innerHTML = '<span class="wc-lbl" aria-hidden="true">Ask us</span><span class="wc-owl" aria-hidden="true"><span class="wc-dot"></span></span>';

  // Welcome bubble: the owl "says hi" once per visit, with tap-to-ask topics.
  var TOPICS = [['Tuition', 'How much is tuition?'], ['Grades', 'What grades do you have?'], ['Book a tour', 'How do I schedule a tour?']];
  var peek = el('div', 'wc-peek');
  peek.hidden = true;
  var say = el('button', 'wc-say');
  say.type = 'button';
  say.innerHTML = '<b>Hi, welcome to WHCP!</b> Wondering about tuition, grades or a tour? Ask me anything.';
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
    if (remember) { try { sessionStorage.setItem('wc-peeked', '1'); } catch (e) {} }
  }
  function showPeek() {
    if (open) return;
    peek.hidden = false;
    document.documentElement.classList.add('wc-peeking');
    requestAnimationFrame(function () { peek.classList.add('wc-in'); });
    try { sessionStorage.setItem('wc-peeked', '1'); } catch (e) {}
    // On small screens it tucks itself away after a while so it doesn't cover the page.
    if (window.innerWidth < 600) peekTimer = setTimeout(function () { hidePeek(false); }, 12000);
  }
  say.addEventListener('click', function () { setOpen(true); });
  px.addEventListener('click', function () { hidePeek(true); });

  var panel = el('section', 'wc-panel');
  panel.id = 'wc-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Ask WHCP');
  panel.hidden = true;

  var head = el('div', 'wc-head');
  var hav = el('span', 'wc-hav');
  hav.setAttribute('aria-hidden', 'true');
  var title = el('div', 'wc-title');
  title.appendChild(el('b', null, 'Ask WHCP'));
  title.appendChild(el('small', null, 'Automated answers about our school'));
  var close = el('button', 'wc-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close chat');
  close.innerHTML = '&times;';
  head.appendChild(hav);
  head.appendChild(title);
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
  var go = el('button', 'wc-send', 'Send');
  go.type = 'submit';
  form.appendChild(input);
  form.appendChild(go);

  var note = el('p', 'wc-note');
  note.appendChild(document.createTextNode('AI answers can be wrong. Please don’t share private information. For anything important, call '));
  var tel = el('a', null, PHONE);
  tel.href = 'tel:+13238227900';
  note.appendChild(tel);
  note.appendChild(document.createTextNode('.'));

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(chips);
  panel.appendChild(form);
  panel.appendChild(note);

  function bubble(role, text) {
    var b = el('div', 'wc-msg wc-' + role);
    addText(b, text);
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function setOpen(v) {
    open = v;
    panel.hidden = !v;
    btn.setAttribute('aria-expanded', String(v));
    document.documentElement.classList.toggle('wc-open', v);
    if (v) {
      if (!peek.hidden) hidePeek(true);
      if (!log.childNodes.length) bubble('bot', 'Hi! I can answer questions about WHCP: programs, grades, tuition, hours and how to visit. What would you like to know?');
      setTimeout(function () { input.focus(); }, 30);
    } else {
      btn.focus();
    }
  }

  function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    busy = true;
    go.disabled = true;
    chips.hidden = true;
    bubble('user', text);
    history.push({ role: 'user', content: text });
    input.value = '';
    var wait = bubble('bot wc-wait', 'Typing…');
    fetch(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-6) }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; });
    }).then(function (res) {
      wait.remove();
      if (res.d && res.d.reply) {
        bubble('bot', res.d.reply);
        history.push({ role: 'assistant', content: res.d.reply });
      } else if (res.status === 429) {
        bubble('bot', 'That’s a lot of questions at once! Give it a few minutes, or call us at ' + PHONE + '.');
        history.pop();
      } else {
        bubble('bot', 'Sorry, I can’t answer right now. Please call us at ' + PHONE + ' or email info@westhollywoodschool.com.');
        history.pop();
      }
    }).catch(function () {
      wait.remove();
      bubble('bot', 'Sorry, I can’t connect right now. Please call us at ' + PHONE + '.');
      history.pop();
    }).then(function () {
      busy = false;
      go.disabled = false;
      if (open) input.focus();
    });
  }

  btn.addEventListener('click', function () { setOpen(!open); });
  close.addEventListener('click', function () { setOpen(false); });
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  document.addEventListener('keydown', function (e) { if (open && e.key === 'Escape') setOpen(false); });

  document.body.appendChild(peek);
  document.body.appendChild(panel);
  document.body.appendChild(btn);

  var seen = false;
  try { seen = sessionStorage.getItem('wc-peeked') === '1'; } catch (e) {}
  if (!seen) setTimeout(showPeek, 4000);
})();
