import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LRI,
  PDI,
  RLM,
  RTL_LANGUAGES,
  detectLanguage,
  dirFor,
  forceRtlParagraphs,
  formatTimeRange,
  isRtl,
  isolate,
  isolateLtrRuns,
  prepareOutbound,
  prepareRtl,
  stripBidi,
} from '../src/index.js';

// Written as escapes on purpose. Literal RTL words reorder the surrounding
// source line in an editor, which is exactly how tests like these get silently
// broken by an unrelated edit.
const HEBREW = 'שלום'; // shalom
const ARABIC = 'مرحبا'; // marhaba

test('control characters have the documented code points', () => {
  assert.equal(LRI.codePointAt(0), 0x2066, 'LRI must be LEFT-TO-RIGHT ISOLATE');
  assert.equal(PDI.codePointAt(0), 0x2069, 'PDI must be POP DIRECTIONAL ISOLATE');
  assert.equal(RLM.codePointAt(0), 0x200f, 'RLM must be RIGHT-TO-LEFT MARK');
});

test('detectLanguage reads Hebrew', () => {
  assert.equal(detectLanguage(HEBREW), 'he');
});

test('detectLanguage reads Arabic', () => {
  assert.equal(detectLanguage(ARABIC), 'ar');
});

test('detectLanguage reads English', () => {
  assert.equal(detectLanguage('what are your hours?'), 'en');
});

test('one Latin brand name does not flip a Hebrew sentence', () => {
  assert.equal(detectLanguage(`${HEBREW} WhatsApp ${HEBREW}`), 'he');
});

test('a link does not flip a Hebrew sentence to English', () => {
  // Regression: a URL carries more Latin letters than a short Hebrew sentence
  // carries Hebrew ones, so counting them flipped the whole message to 'en'
  // and prepareRtl() returned it untouched - no isolate, no RTL mark. The
  // single most common real WhatsApp message shape is "text plus a link".
  const text = `${HEBREW} https://example.com/prices ${HEBREW}`;
  assert.equal(detectLanguage(text), 'he');
  assert.ok(
    prepareRtl(text).includes(`${LRI}https://example.com/prices${PDI}`),
    'the URL must be isolated when no language is passed',
  );
});

test('an e-mail address or a phone number does not flip detection either', () => {
  assert.equal(detectLanguage(`${HEBREW} orders@example.com`), 'he');
  assert.equal(detectLanguage(`${ARABIC} +972-4-000-0000`), 'ar');
});

test('a thousands separator does not split the number run', () => {
  // Regression: without the comma in the separator class this isolated as
  // "1," + LRI "250.00" PDI, putting the isolate boundary inside the number -
  // which reorders worse than leaving it alone.
  assert.equal(
    isolateLtrRuns(`${HEBREW} 1,250.00`),
    `${HEBREW} ${LRI}1,250.00${PDI}`,
  );
  assert.equal(
    isolateLtrRuns(`${HEBREW} 1,250,000.50 ${HEBREW}`),
    `${HEBREW} ${LRI}1,250,000.50${PDI} ${HEBREW}`,
  );
});

test('no recognised script at all falls back to English', () => {
  assert.equal(detectLanguage('2026'), 'en');
  assert.equal(detectLanguage(''), 'en');
  assert.equal(detectLanguage(null), 'en');
});

test('isRtl accepts bare subtags and full locale tags', () => {
  for (const tag of ['he', 'HE', 'he-IL', 'ar', 'ar_EG', 'fa-IR', 'ur']) {
    assert.equal(isRtl(tag), true, `${tag} should be RTL`);
  }
  for (const tag of ['en', 'en-US', 'ru', '', null, undefined]) {
    assert.equal(isRtl(tag), false, `${tag} should not be RTL`);
  }
});

test('RTL_LANGUAGES is frozen so a caller cannot corrupt it', () => {
  assert.equal(Object.isFrozen(RTL_LANGUAGES), true);
});

test('dirFor returns a value usable straight in a dir attribute', () => {
  assert.equal(dirFor('he-IL'), 'rtl');
  assert.equal(dirFor('ar'), 'rtl');
  assert.equal(dirFor('en'), 'ltr');
});

test('a phone number is wrapped in an LTR isolate', () => {
  const out = prepareRtl(`${HEBREW} +972-4-000-0000`, 'he');
  assert.ok(out.includes(`${LRI}+972-4-000-0000${PDI}`));
});

test('a URL is wrapped in an LTR isolate', () => {
  const out = prepareRtl(`${ARABIC} https://example.com/prices`, 'ar');
  assert.ok(out.includes(`${LRI}https://example.com/prices${PDI}`));
});

test('a bare www host is wrapped in an LTR isolate', () => {
  const out = isolateLtrRuns(`${HEBREW} www.example.com`);
  assert.ok(out.includes(`${LRI}www.example.com${PDI}`));
});

test('an e-mail address is wrapped in an LTR isolate', () => {
  const out = isolateLtrRuns(`${ARABIC} hello@example.com`);
  assert.ok(out.includes(`${LRI}hello@example.com${PDI}`));
});

test('a time range is isolated as ONE run, not two', () => {
  // The bug this guards: an RTL paragraph reorders "09:00 - 18:00" into
  // "18:00 - 09:00" and shows the closing time first; every form is one run.
  const out = isolateLtrRuns(`${HEBREW} 09:00-18:00`);
  assert.ok(out.includes(`${LRI}09:00-18:00${PDI}`));
  assert.equal((out.match(new RegExp(LRI, 'g')) || []).length, 1);
});

test('a line starting with a digit gets an RTL mark', () => {
  const out = prepareRtl(`2026 ${HEBREW}`, 'he');
  assert.ok(out.startsWith(RLM));
});

test('a line starting with a Latin word gets an RTL mark', () => {
  const out = prepareRtl(`WhatsApp ${HEBREW}`, 'he');
  assert.ok(out.startsWith(RLM));
});

test('a line that already starts RTL is left alone', () => {
  assert.equal(prepareRtl(HEBREW, 'he'), HEBREW);
});

test('every line of a multi-line string is handled on its own', () => {
  const out = prepareRtl(`${HEBREW}\n2026 ${HEBREW}\n\n${ARABIC}`, 'he');
  const lines = out.split('\n');
  assert.equal(lines[0], HEBREW, 'a strong-RTL line stays untouched');
  assert.ok(lines[1].startsWith(RLM), 'a digit-first line gets the mark');
  assert.equal(lines[2], '', 'an empty line stays empty');
  assert.equal(lines[3], ARABIC, 'an Arabic line stays untouched');
});

test('an isolate never crosses a line break', () => {
  // A pair split over two lines would never balance, because the RTL mark is
  // applied line by line.
  const out = prepareRtl(`${HEBREW} 09:00\n18:00 ${HEBREW}`, 'he');
  for (const line of out.split('\n')) {
    const opens = (line.match(new RegExp(LRI, 'g')) || []).length;
    const closes = (line.match(new RegExp(PDI, 'g')) || []).length;
    assert.equal(opens, closes, `unbalanced isolates on line: ${JSON.stringify(line)}`);
  }
});

test('English is returned byte-for-byte untouched', () => {
  const text = 'Call +972-4-000-0000 or visit https://example.com';
  assert.equal(prepareRtl(text, 'en'), text);
});

test('running twice does not nest isolates', () => {
  const once = prepareRtl(`${HEBREW} +972-4-000-0000`, 'he');
  assert.equal(prepareRtl(once, 'he'), once);
});

test('a hand-wrapped value composes with prepareRtl', () => {
  // The reason this matters: a caller isolates a short id the pattern is too
  // strict to catch, then hands the whole sentence to prepareRtl. If prepareRtl
  // bailed out on seeing an isolate, everything else in the sentence - the
  // phone number, the URL, the time range - would silently go unprotected.
  const text = `${HEBREW} ${isolate('A7')} ${HEBREW} 09:00-18:00`;
  const out = prepareRtl(text, 'he');
  assert.ok(out.includes(`${LRI}A7${PDI}`), 'the hand-wrapped id must survive untouched');
  assert.ok(out.includes(`${LRI}09:00-18:00${PDI}`), 'the time range must still be isolated');
  assert.equal((out.match(new RegExp(LRI, 'g')) || []).length, 2, 'exactly two isolates');
  assert.equal(prepareRtl(out, 'he'), out, 'and it is still idempotent');
});

test('a hand-wrapped value is never wrapped a second time', () => {
  const text = `${HEBREW} ${isolate('+972-4-000-0000')}`;
  const out = prepareRtl(text, 'he');
  assert.equal((out.match(new RegExp(LRI, 'g')) || []).length, 1);
  assert.ok(out.includes(`${LRI}+972-4-000-0000${PDI}`));
});

test('an unbalanced isolate is left alone rather than made worse', () => {
  // Malformed input: an opening isolate with no closing one. Adding more
  // controls to it cannot help and makes the damage harder to see.
  const broken = `${HEBREW} ${LRI}+972-4-000-0000`;
  assert.equal(isolateLtrRuns(broken), broken);
});

test('language may be omitted and is then read from the script', () => {
  const out = prepareRtl(`${HEBREW} +972-4-000-0000`);
  assert.ok(out.includes(LRI), 'Hebrew text should be prepared');
  assert.equal(prepareRtl('Call +972-4-000-0000'), 'Call +972-4-000-0000');
});

test('empty and nullish input survive every entry point', () => {
  for (const fn of [isolateLtrRuns, forceRtlParagraphs, stripBidi]) {
    assert.equal(fn(''), '');
    assert.equal(fn(null), null);
    assert.equal(fn(undefined), undefined);
  }
  assert.equal(prepareRtl('', 'he'), '');
  assert.equal(isolate(''), '');
  assert.equal(isolate(null), '');
});

test('isolate() wraps a value the pattern is too strict to catch', () => {
  // "A7" is an order id, not a number run - the pattern needs 5+ characters.
  assert.equal(isolateLtrRuns(`${HEBREW} A7`).includes(LRI), false);
  assert.equal(isolate('A7'), `${LRI}A7${PDI}`);
});

test('isolate() accepts a number and does not double-wrap', () => {
  assert.equal(isolate(42), `${LRI}42${PDI}`);
  assert.equal(isolate(isolate(42)), `${LRI}42${PDI}`);
});

test('formatTimeRange produces one isolated run', () => {
  assert.equal(formatTimeRange('09:00', '18:00'), `${LRI}09:00-18:00${PDI}`);
  assert.equal(formatTimeRange('09:00', '18:00', ' - '), `${LRI}09:00 - 18:00${PDI}`);
});

test('prepareOutbound is the same function under the wa-agent-starter name', () => {
  assert.equal(prepareOutbound, prepareRtl);
});

test('stripBidi is the exact inverse for equality checks', () => {
  const original = `${HEBREW} 09:00-18:00\n2026 ${HEBREW}`;
  assert.equal(stripBidi(prepareRtl(original, 'he')), original);
});

test('output is byte-identical to the tervatrix-rtl Python package', () => {
  // The exact strings asserted on the Python side, in
  // tervatrix-rtl/tests/test_rtl.py::ParityWithJavaScriptTest. If either
  // implementation drifts, one of these fails and names the drift.
  const cases = [
    [`${HEBREW} +972-4-000-0000`, 'he', `${HEBREW} ${LRI}+972-4-000-0000${PDI}`],
    [
      `${ARABIC} https://example.com/prices`,
      'ar',
      `${ARABIC} ${LRI}https://example.com/prices${PDI}`,
    ],
    [`${HEBREW} 09:00-18:00`, 'he', `${HEBREW} ${LRI}09:00-18:00${PDI}`],
    [`2026 ${HEBREW}`, 'he', `${RLM}2026 ${HEBREW}`],
    [
      'Call +972-4-000-0000 or visit https://example.com',
      'en',
      'Call +972-4-000-0000 or visit https://example.com',
    ],
    // A thousands separator must not split the number run.
    [`${HEBREW} 1,250.00`, 'he', `${HEBREW} ${LRI}1,250.00${PDI}`],
  ];
  for (const [text, lang, expected] of cases) {
    assert.equal(prepareRtl(text, lang), expected, `drift on ${JSON.stringify(text)}`);
  }

  // Language detection is part of the shared contract too: both sides must
  // agree on what an un-tagged string is written in. Mirrored in
  // ParityWithJavaScriptTest.DETECT_CASES.
  const detection = [
    [`${HEBREW} https://example.com/prices`, 'he'],
    [`${ARABIC} https://shop.example.com/orders/12345`, 'ar'],
    [`${HEBREW} WhatsApp ${HEBREW}`, 'he'],
    ['what are your hours?', 'en'],
    ['2026', 'en'],
  ];
  for (const [text, expected] of detection) {
    assert.equal(detectLanguage(text), expected, `detection drift on ${JSON.stringify(text)}`);
  }
});

test('stripBidi removes legacy embedding marks too', () => {
  // RLE, PDF and LRM - the pre-isolate way of doing the same job, still found
  // in old translation files.
  const legacy = '‫x‬‎y';
  assert.equal(stripBidi(legacy), 'xy');
});
