/**
 * WHCP website inquiries -> Google Sheet
 *
 * Setup (one time, in the school's Google account):
 *   1. Create a Google Sheet, e.g. "WHCP Website Inquiries".
 *   2. Extensions > Apps Script. Delete the sample code, paste this whole file, Save.
 *   3. Deploy > New deployment > type "Web app".
 *        Execute as: Me      Who has access: Anyone
 *      Click Deploy, approve the permissions, and copy the Web app URL (ends in /exec).
 *   4. Send that URL to Claude (it goes into SHEET_URL in _build/build.py).
 *
 * Each website form submission adds one row to the "Inquiries" tab.
 * Questions the website chat could not answer go to the "Chat questions" tab.
 * Every chat exchange goes to the "Chat log" tab: question, answer, any email or phone
 * typed, page, how they found the site, approximate location, device, language and IP.
 * Visit the /exec URL in a browser to check it is running.
 *
 * Flood protection: the sheet keeps at most 10 form rows per 10 minutes (100 a day) and
 * 15 chat questions per 10 minutes (150 a day), and skips a chat question it already logged
 * in the last hour. Real inquiries still arrive by email through the form service either way.
 */

var LIMITS = {
  form: { per10min: 10, perDay: 100 },
  chat: { per10min: 15, perDay: 150 },
  chatlog: { per10min: 80, perDay: 800 }
};

var CHAT_LOG_SHEET = 'Chat log';
var CHAT_LOG_COLUMNS = ['Time', 'Chat ID', 'Question', 'Athena\'s answer', 'Email typed', 'Phone typed', 'Page',
  'How they found us', 'City', 'Region', 'Country', 'Device', 'Language', 'IP address', 'Answer type'];

var SHEET_NAME = 'Inquiries';

// [form field name, column heading]
var COLUMNS = [
  ['timestamp', 'Submitted'],
  ['form', 'Form'],
  ['parent_name', 'Parent / Guardian'],
  ['first_name', 'First Name'],
  ['last_name', 'Last Name'],
  ['student_first_name', 'Student First Name'],
  ['student_last_name', 'Student Last Name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['program', 'Program of Interest'],
  ['subject', 'Subject'],
  ['heard_about', 'How They Heard About Us'],
  ['heard_about_details', 'Details'],
  ['newsletter_opt_in', 'Newsletter Opt-in'],
  ['message', 'Message'],
  ['page', 'Page'],
];

function doPost(e) {
  var p = (e && e.parameter) || {};
  if (p._gotcha) return reply_('ok');                       // spam trap filled: ignore
  if (p.form === 'chat_unanswered') return logChat_(p);
  if (p.form === 'chat_log') return logChatAll_(p);
  var email = String(p.email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply_('ignored');
  if (overLimit_('form')) return reply_('busy');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet_();
    var row = COLUMNS.map(function (c) {
      if (c[0] === 'timestamp') return new Date();
      if (c[0] === 'newsletter_opt_in') return p.newsletter_opt_in === 'Yes' ? 'Yes' : 'No';
      return clean_(p[c[0]]);
    });
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return reply_('ok');
}

// A question the website chat couldn't answer: date, question, what the chat said.
function logChat_(p) {
  var q = clean_(p.question).slice(0, 500);
  if (!q) return reply_('ignored');
  var cache = CacheService.getScriptCache();
  var seen = 'q_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, q.toLowerCase()));
  if (cache.get(seen)) return reply_('ok');                 // same question in the last hour
  if (overLimit_('chat')) return reply_('busy');
  cache.put(seen, '1', 3600);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Chat questions') || ss.insertSheet('Chat questions');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Asked', 'Question the chat could not answer', 'What the chat said', 'Page']);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(2, 380);
      sheet.setColumnWidth(3, 420);
    }
    sheet.appendRow([new Date(), q, clean_(p.reply).slice(0, 800), clean_(p.page).slice(0, 200)]);
  } finally {
    lock.releaseLock();
  }
  return reply_('ok');
}

// Counts submissions in the current 10-minute window and the current day; true once either is full.
function logChatAll_(p) {
  var q = clean_(p.question).slice(0, 1000);
  if (!q) return reply_('ignored');
  if (overLimit_('chatlog')) return reply_('busy');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CHAT_LOG_SHEET) || ss.insertSheet(CHAT_LOG_SHEET);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(CHAT_LOG_COLUMNS);
      sheet.getRange(1, 1, 1, CHAT_LOG_COLUMNS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(3, 360);
      sheet.setColumnWidth(4, 420);
    }
    sheet.appendRow([new Date(), clean_(p.chat_id).slice(0, 40), q, clean_(p.reply).slice(0, 1500),
      clean_(p.email).slice(0, 200), clean_(p.phone).slice(0, 120), clean_(p.page).slice(0, 200),
      clean_(p.referrer).slice(0, 300), clean_(p.city).slice(0, 80), clean_(p.region).slice(0, 80),
      clean_(p.country).slice(0, 10), clean_(p.device).slice(0, 20), clean_(p.language).slice(0, 20),
      clean_(p.ip).slice(0, 60), clean_(p.kind).slice(0, 20)]);
  } finally {
    lock.releaseLock();
  }
  return reply_('ok');
}

function overLimit_(kind) {
  var cache = CacheService.getScriptCache(), now = Date.now(), lim = LIMITS[kind];
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var k10 = kind + '_10_' + Math.floor(now / 600000), kDay = kind + '_d_' + Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyyMMdd');
    var n10 = Number(cache.get(k10) || 0), nDay = Number(cache.get(kDay) || 0);
    if (n10 >= lim.per10min || nDay >= lim.perDay) return true;
    cache.put(k10, String(n10 + 1), 660);
    cache.put(kDay, String(nDay + 1), 21600);
    return false;
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return reply_('WHCP inquiries endpoint is running.');
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS.map(function (c) { return c[1]; }));
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Trim, cap length, and stop text being read as a spreadsheet formula.
function clean_(v) {
  var s = String(v == null ? '' : v).trim().slice(0, 3000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reply_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}
