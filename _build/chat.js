/* WHCP website assistant: chat bubble (no cookies, nothing stored after the tab closes) */
(function () {
  'use strict';
  var URL_ = __CHAT_URL__;
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
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg><span>Ask us</span>';

  var panel = el('section', 'wc-panel');
  panel.id = 'wc-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Ask WHCP');
  panel.hidden = true;

  var head = el('div', 'wc-head');
  var title = el('div', 'wc-title');
  title.appendChild(el('b', null, 'Ask WHCP'));
  title.appendChild(el('small', null, 'Automated answers about our school'));
  var close = el('button', 'wc-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close chat');
  close.innerHTML = '&times;';
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

  document.body.appendChild(panel);
  document.body.appendChild(btn);
})();
