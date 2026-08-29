# @tervatrix/rtl-ui

Framework-free helpers and logical-property CSS for Hebrew and Arabic
interfaces. No dependencies, no build step, no configuration.

It fixes the four bidi bugs that ship in almost every RTL interface and are
invisible in review, because they only appear once real data lands in the
layout:

| what the user sees | why | the fix in this package |
|---|---|---|
| `+972-4-000-0000` renders as `0000-000-4-972+` | the dashes are *neutral* characters and inherit the paragraph's RTL direction | `prepareRtl()` / `<Ltr>` / `.rtl-ui-num` |
| opening hours `09:00-18:00` render as `18:00-09:00`, closing time first | two number runs with a neutral between them get reordered as a unit | the same - the pattern treats a time range as **one** run |
| a whole Hebrew line flips to left-aligned because it starts with `2026` or `WhatsApp` | the first-strong-character rule guesses the paragraph direction | `prepareRtl()` prefixes an invisible RTL mark |
| the sidebar, the icons and the padding are on the wrong side | the stylesheet uses `margin-left` / `right:` | `rtl-ui.css`, which contains no physical left/right property at all |

Extracted from a WhatsApp agent answering Hebrew, Arabic and English customers
in production. MIT licensed.

---

## Install

```bash
npm install @tervatrix/rtl-ui
```

Node 18.17 or newer. React is optional and only needed for the `/react` entry
point.

---

## The 30-second version

```js
import { prepareRtl } from '@tervatrix/rtl-ui';

const message = 'שעות פתיחה: 09:00-18:00\nלשאלות: +972-4-000-0000';

element.textContent = prepareRtl(message, 'he');
```

That one call wraps the time range and the phone number in left-to-right
isolates and marks the line that starts with a digit. Nothing else changes, and
an English string is returned **byte for byte untouched** - so English never
carries invisible control characters into your logs, your snapshots or your
database.

---

## API

Everything is a named export. There is also a default export carrying the same
members, for CommonJS-style destructuring.

### `prepareRtl(text, language?)`

The single call to make on any string before you render or send it. Runs
`isolateLtrRuns` then `forceRtlParagraphs`. Returns LTR languages unchanged.

Omit `language` and it is detected from the script the text is written in.

Also exported as **`prepareOutbound`** - the same function under the name used
by [wa-agent-starter](https://github.com/mhamedmohammed92-arch/wa-agent-starter)
and by the [`tervatrix-rtl`](https://pypi.org/project/tervatrix-rtl/) Python
package, so a full-stack project reads the same on both sides.

### `isolateLtrRuns(text)`

Wraps URLs, `www.` hosts, e-mail addresses, phone numbers, prices and time
ranges in `U+2066 … U+2069`.

Idempotent, and **composable**: it processes only what lies outside any isolate
that is already there. So you can wrap one value by hand with `isolate()`, drop
it into a sentence, and still pass the whole sentence through `prepareRtl()` —
the hand-wrapped value survives untouched and everything around it is still
protected.

### `forceRtlParagraphs(text)`

Prefixes `U+200F` to every line that does not already begin with a strong RTL
character. Applied line by line, which is why an isolate is never allowed to
cross a newline - a pair split over two lines would never balance.

### `isolate(value)`

Wraps one value unconditionally. Use it when you already know what the value is
and the pattern is deliberately too strict to catch it - a bare order id like
`A7`, a two-digit table number.

```js
`הזמנה ${isolate(order.id)} מוכנה`
```

### `formatTimeRange(start, end, separator = '-')`

`formatTimeRange('09:00', '18:00')` gives an isolated `09:00-18:00` that cannot
be reordered.

### `detectLanguage(text)` → `'he' | 'ar' | 'en'`

Counts characters per script rather than stopping at the first hit, so one Latin
brand name inside a Hebrew sentence does not switch the whole string to English.
URLs, e-mail addresses and phone numbers are removed before counting - they are
not evidence of a language, and a single link otherwise carries enough Latin
letters to flip a short Hebrew message to English.
Falls back to `'en'` for digits-only, emoji-only and empty input.

### `isRtl(language)` and `dirFor(language)`

`isRtl` accepts a bare subtag or a full tag: `he`, `he-IL`, `ar_EG`, `fa-IR`,
`ur`. `dirFor` returns `'rtl'` or `'ltr'`, ready to drop into a `dir`
attribute.

### `stripBidi(text)`

Removes every bidi control character, including the legacy embedding marks
(`U+202A`–`U+202E`) found in old translation files.

**Call this before comparing strings.** The marks are invisible, so an
unstripped string fails an equality check for no visible reason - in a test
assertion, a database `WHERE`, a de-duplication key. `stripBidi(prepareRtl(x))`
is exactly `x`.

### `LRI`, `PDI`, `RLM`, `RTL_LANGUAGES`

The control characters (`U+2066`, `U+2069`, `U+200F`) and the frozen list of RTL
primary subtags, exported so you can assert on them in your own tests.

---

## The stylesheet

```js
import '@tervatrix/rtl-ui/css';
```

or

```html
<link rel="stylesheet" href="node_modules/@tervatrix/rtl-ui/css/rtl-ui.css">
```

Then set the direction on a container and the utilities follow it:

```html
<div dir="rtl" lang="he" class="rtl-ui-prose">
  <p>שעות פתיחה: <span class="rtl-ui-num">09:00-18:00</span></p>
</div>
```

Every rule uses CSS **logical** properties (`margin-inline-start`,
`inset-inline-end`, `border-start-start-radius`) instead of physical ones. A
logical property follows the element's writing direction, so one stylesheet lays
out correctly in both directions and there is no mirrored copy to keep in sync.
There is a test in this repository that fails if a physical `left` or `right`
ever gets back in.

| class | what it does |
|---|---|
| `.rtl-ui-rtl` / `.rtl-ui-ltr` | set direction and `text-align: start` |
| `.rtl-ui-num` | an isolated LTR island with tabular figures - numbers, prices, phone numbers, time ranges |
| `.rtl-ui-code` | an isolated LTR island in a monospace face - URLs, paths, ids |
| `.rtl-ui-auto` | `unicode-bidi: plaintext` for user-supplied text of unknown script - a name, a message, a search term |
| `.rtl-ui-isolate` | isolation only, direction untouched |
| `.rtl-ui-text-start` / `-end` / `-center` | logical text alignment |
| `.rtl-ui-ms-*` / `-me-*` / `-ps-*` / `-pe-*` | inline-axis margin and padding on a 0–6 scale, plus `-auto` |
| `.rtl-ui-border-s` / `-e`, `.rtl-ui-round-s` / `-e` | inline-axis borders and radii |
| `.rtl-ui-inset-s-0` / `-e-0` / `-x-0`, `.rtl-ui-float-s` / `-e` | inline-axis positioning |
| `.rtl-ui-flip-icon` | mirrors a glyph in RTL - arrows, chevrons, send. Opt-in per element, because a clock, a logo, a checkmark and a play button must **not** mirror |
| `.rtl-ui-input-ltr` | keeps a `tel` / `email` / `url` / `number` field left-to-right while aligning it to the inline start |
| `.rtl-ui-table` | `text-align: start` headers, with `.rtl-ui-num-cell` for isolated numeric columns |
| `.rtl-ui-prose` | line-height 1.7 and kills `letter-spacing`, `text-transform` and small caps in RTL, where they have no meaning and break connected Arabic script |
| `.rtl-ui-scroll-x` | contains a wide table or code block so the page body never scrolls sideways |

Sizes come from `--rtl-ui-space-0` … `--rtl-ui-space-6` on `:root`. Redefine
them to match your own scale. Every class is namespaced `rtl-ui-`, and a test
fails if an unnamespaced one appears.

---

## React (optional)

The `/react` entry point is the only file in the package that touches React.
Importing the package root never loads it.

```jsx
import { RtlProvider, Rtl, Ltr, RtlText, useDirection } from '@tervatrix/rtl-ui/react';
import '@tervatrix/rtl-ui/css';

function Card({ order }) {
  const { dir } = useDirection();          // reads the nearest RtlProvider
  return (
    <Rtl className="rtl-ui-prose">
      <h2>הזמנה <Ltr>{order.id}</Ltr></h2>
      <p>נאסוף בין <Ltr>{'09:00-18:00'}</Ltr></p>
      <RtlText text={order.customerNote} />
    </Rtl>
  );
}

export default function App() {
  return (
    <RtlProvider lang="he">
      <Card order={{ id: 'A7', customerNote: 'תתקשרו ל 054-000-0000' }} />
    </RtlProvider>
  );
}
```

- **`<RtlProvider lang>`** puts the language in context once, near the root.
- **`useDirection(lang?)`** returns `{ lang, dir, isRtl }`.
- **`<Rtl>`** renders a container with the right `dir` and `lang`. Pass `as` for
  a different element.
- **`<Ltr>`** renders a `<bdi>` - the HTML element whose entire job is bidi
  isolation. No control characters end up in the DOM text, so copy-paste stays
  clean. Prefer it over `isolate()` whenever the value has its own element.
- **`<RtlText text lang?>`** runs `prepareRtl` on text you did not author - from
  a database, an API, a translation file - where you cannot wrap the numbers by
  hand.

---

## Tests

No framework to install. The tests use `node:test`, which ships with Node.

```bash
npm test
```

They cover language detection, isolate placement, idempotency, isolate/newline
balance, the round trip through `stripBidi`, the React element tree (skipped if
React is not installed), and the stylesheet's promise that it contains no
physical `left` or `right`.

---

## Licence

MIT — see [LICENSE](LICENSE). Use it commercially, fork it, ship it. No
warranty.

---

## Where this came from

This package is the RTL layer of a WhatsApp agent that answers Hebrew, Arabic
and English customers on the official Meta Cloud API. Two more pieces of it are
public and free:

- **[`tervatrix-rtl`](https://pypi.org/project/tervatrix-rtl/)** — the identical
  logic in Python, for your backend. Same function names, same behaviour, so a
  string prepared on either side is byte-identical.
- **[`wa-agent-starter`](https://github.com/mhamedmohammed92-arch/wa-agent-starter)**
  — a complete, working WhatsApp agent in FastAPI: Meta webhook, HMAC signature
  verification, language detection, keyword FAQ, this RTL handling, and 50
  passing tests. MIT, self-hosted, no account with us.

If you need more than a keyword bot, **wa-agent-kit** is the paid version. It
adds a Qdrant knowledge base so the agent answers questions nobody wrote a
keyword for, multi-tenant support for many business numbers on one deployment,
human handover, an admin panel, an AI-provider abstraction, and 12 months of
updates.

→ **[Get wa-agent-kit](https://github.com/mhamedmohammed92-arch/wa-agent-starter#what-the-paid-kit-adds)**
