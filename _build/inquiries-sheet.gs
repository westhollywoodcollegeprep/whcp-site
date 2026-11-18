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
 * Questions the website chat could not answer go to the "Chat questions" tab
 * (question text only: no names, emails, phone numbers or IP addresses).
 * Visit the /exec URL in a browser to check it is running.
 */

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
  var email = String(p.email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply_('ignored');

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
