/**
 * tervatrix-rtl-ui - framework-free helpers for correct Hebrew and Arabic
 * right-to-left text in a user interface.
 *
 * Two bidi bugs ship in almost every Hebrew or Arabic interface, and both are
 * invisible until a real user screenshots them:
 *
 * 1. A phone number, price range, URL, e-mail address or opening-hours range
 *    inside an RTL sentence renders with its segments in the wrong order,
 *    because the dashes, dots, colons and slashes between digits are *neutral*
 *    characters and inherit the paragraph's right-to-left direction.
 *    `+972-52-624-7316` can display as `7316-624-52-972+`, and `09:00-18:00`
 *    can display as `18:00-09:00`, showing the closing time first.
 *    Fix: wrap each such run in a LEFT-TO-RIGHT ISOLATE (U+2066 ... U+2069) so
 *    it is laid out left-to-right while staying in place inside the sentence.
 *
 * 2. A line that *starts* with a digit or a Latin word ("2026 ...",
 *    "WhatsApp ...") is guessed as a left-to-right paragraph by the
 *    first-strong-character rule, so the whole Hebrew or Arabic line flips its
 *    alignment. Fix: prefix the line with an invisible RIGHT-TO-LEFT MARK
 *    (U+200F).
 *
 * Both fixes are pure text - no font, no browser setting, nothing to install.
 * Every range below is written as an escape on purpose: the literal characters
 * are invisible or bidi-flipping in an editor, which is how these regexes get
 * broken by a well-meaning edit.
 */

/** LEFT-TO-RIGHT ISOLATE. */
export const LRI = '\u2066';
/** POP DIRECTIONAL ISOLATE. */
export const PDI = '\u2069';
/** RIGHT-TO-LEFT MARK. */
export const RLM = '\u200F';

/**
 * Language subtags whose script runs right to left.
 * Matching is done on the primary subtag, so `he-IL` and `ar-EG` also count.
 */
export const RTL_LANGUAGES = Object.freeze(['he', 'iw', 'ar', 'fa', 'ur']);

// Hebrew block + Hebrew presentation forms.
const HEBREW = /[\u0590-\u05FF\uFB1D-\uFB4F]/g;
// Arabic, Arabic Supplement, Arabic Extended-A, and the presentation forms.
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LATIN = /[A-Za-z]/g;

// Any character that decides a paragraph's direction on its own (a "strong" RTL
// character). Used to tell whether a line already starts right to left.
const STRONG_RTL = /^[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

// One alternation, matched left to right, so a URL is never re-chewed by the
// number branch. Order matters: longest / most specific pattern first.
//   1. http(s) URL   2. bare www. host   3. e-mail address
//   4. a number-like run: a digit, then digits and the usual separators, a digit
//
// Three deliberate choices in that last branch:
//   * The separator class spells out space and tab instead of using \s, because
//     \s also matches the newline. A run allowed to cross a line break would put
//     the opening isolate on one line and the closing one on the next - and the
//     RTL mark below is applied line by line, so the pair would never balance.
//   * The colon and the en/em dash are in the class on purpose. "09:00-18:00" is
//     the classic failure: two number runs with a neutral between them, which an
//     RTL paragraph reorders into "18:00-09:00" and shows closing time first.
//   * The comma is in the class so a thousands separator cannot split the run.
//     Without it "1,250.00" isolates as "1," followed by an isolated "250.00",
//     putting the isolate boundary in the middle of a number - which is worse
//     than not touching it at all.
const LTR_ISLAND = new RegExp(
  '(https?:\\/\\/[^\\s]+' +
    '|www\\.[^\\s]+' +
    '|[^\\s@]+@[^\\s@]+\\.[A-Za-z]{2,}' +
    '|\\+?\\d[\\d:,\\u2013\\u2014()./ \\t-]{3,}\\d)',
  'g',
);

// A span that is already isolated: LRI, anything that is not a PDI, PDI.
// Used to leave hand-wrapped values alone while still processing the prose
// around them - see isolateLtrRuns().
const ISOLATED_SPAN = /\u2066[^\u2069]*\u2069/g;

function count(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Return `'he'`, `'ar'` or `'en'` from the script the text is actually written in.
 *
 * Counting characters rather than stopping at the first hit keeps a single Latin
 * brand name inside a Hebrew sentence from switching the whole string to
 * English. English is the fallback when nothing is recognised (digits only,
 * emoji only, an empty string).
 *
 * @param {string} text
 * @returns {'he'|'ar'|'en'}
 */
export function detectLanguage(text) {
  if (!text) return 'en';
  // A URL, an e-mail address or a phone number is not evidence of a language.
  // "https://example.com/prices" carries more Latin letters than a short Hebrew
  // sentence carries Hebrew ones, so counting them used to flip a Hebrew message
  // that merely contained a link all the way to 'en' - and prepareRtl() then
  // returned it untouched, with no isolate and no RTL mark, which is the exact
  // failure this package exists to prevent. Score the prose only.
  const prose = text.replace(LTR_ISLAND, ' ');
  const scores = {
    he: count(prose, HEBREW),
    ar: count(prose, ARABIC),
    en: count(prose, LATIN),
  };
  let best = 'he';
  for (const key of ['he', 'ar', 'en']) {
    if (scores[key] > scores[best]) best = key;
  }
  return scores[best] > 0 ? best : 'en';
}

/**
 * Is this language tag written right to left?
 * Accepts a bare subtag (`he`) or a full tag (`he-IL`, `ar_EG`).
 *
 * @param {string} language
 * @returns {boolean}
 */
export function isRtl(language) {
  if (!language) return false;
  const primary = String(language).toLowerCase().split(/[-_]/)[0];
  return RTL_LANGUAGES.includes(primary);
}

/**
 * `'rtl'` or `'ltr'` - ready for a `dir` attribute or a CSS `direction`.
 *
 * @param {string} language
 * @returns {'rtl'|'ltr'}
 */
export function dirFor(language) {
  return isRtl(language) ? 'rtl' : 'ltr';
}

/**
 * Wrap phone numbers, URLs, e-mail addresses and time ranges in LTR isolates.
 *
 * @param {string} text
 * @returns {string}
 */
export function isolateLtrRuns(text) {
  if (!text) return text;
  const wrap = (chunk) => chunk.replace(LTR_ISLAND, (match) => LRI + match + PDI);

  // The common case: nothing is isolated yet.
  if (!text.includes(LRI)) return wrap(text);

  // Something already is. Process only what lies OUTSIDE the existing isolate
  // spans, so two things stay true at once:
  //   * a caller may wrap one value by hand with isolate() - an order id, a
  //     short reference - and still hand the whole sentence here afterwards;
  //   * calling this twice on the same string changes nothing, because after
  //     the first pass every matchable run is already inside a span.
  let out = '';
  let last = 0;
  let found = false;
  for (const match of text.matchAll(ISOLATED_SPAN)) {
    found = true;
    out += wrap(text.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  // An opening isolate with no closing one: the text is already malformed, so
  // leave it exactly as it is rather than adding more controls to it.
  if (!found) return text;
  return out + wrap(text.slice(last));
}

/**
 * Wrap one value in an LTR isolate unconditionally.
 *
 * Use it when you already know the value is a number, an id, a URL or a time
 * range and you do not want to rely on the pattern matching - for example a
 * bare order id like `A7` that is too short for the number branch.
 *
 * @param {string|number} value
 * @returns {string}
 */
export function isolate(value) {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value);
  if (text.includes(LRI)) return text;
  return LRI + text + PDI;
}

/**
 * Format an opening-hours range so it survives an RTL paragraph.
 *
 * `formatTimeRange('09:00', '18:00')` gives an isolated `09:00-18:00` that
 * cannot be reordered into `18:00-09:00`.
 *
 * @param {string} start
 * @param {string} end
 * @param {string} [separator]
 * @returns {string}
 */
export function formatTimeRange(start, end, separator = '-') {
  return isolate(`${start}${separator}${end}`);
}

/**
 * Prefix every line that does not already begin with a strong RTL character
 * with an invisible RTL mark, so the line is laid out right to left.
 *
 * @param {string} text
 * @returns {string}
 */
export function forceRtlParagraphs(text) {
  if (!text) return text;
  return text
    .split('\n')
    .map((line) => {
      const stripped = line.replace(/^[ \t\v\f\r\u00A0]+/, '');
      if (!stripped || line.startsWith(RLM)) return line;
      if (STRONG_RTL.test(stripped[0])) return line;
      return RLM + line;
    })
    .join('\n');
}

/**
 * The single call to make on any string before it is rendered or sent.
 *
 * Left-to-right languages are returned untouched, so English strings never
 * carry invisible control characters that would show up in logs, snapshots and
 * copy-paste.
 *
 * @param {string} text
 * @param {string} [language] - defaults to the script the text is written in.
 * @returns {string}
 */
export function prepareRtl(text, language) {
  if (!text) return text;
  const lang = language === undefined || language === null ? detectLanguage(text) : language;
  if (!isRtl(lang)) return text;
  return forceRtlParagraphs(isolateLtrRuns(text));
}

/**
 * Alias of {@link prepareRtl}, under the name used by wa-agent-starter and by
 * the `tervatrix-rtl` Python package, so the same call reads the same on both
 * sides of a project.
 */
export const prepareOutbound = prepareRtl;

/**
 * Remove every bidi control character this package inserts.
 *
 * Call it before comparing strings, writing to a database, or asserting in a
 * test - the marks are invisible, so an unstripped string fails an equality
 * check for no visible reason.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripBidi(text) {
  if (!text) return text;
  return text.replace(/[\u200E\u200F\u2066-\u2069\u202A-\u202E]/g, '');
}

export default {
  LRI,
  PDI,
  RLM,
  RTL_LANGUAGES,
  detectLanguage,
  isRtl,
  dirFor,
  isolate,
  isolateLtrRuns,
  formatTimeRange,
  forceRtlParagraphs,
  prepareRtl,
  prepareOutbound,
  stripBidi,
};
