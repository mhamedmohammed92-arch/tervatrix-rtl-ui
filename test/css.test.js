/**
 * The stylesheet's one promise is that it contains no physical left/right
 * property, so a single sheet lays out correctly in both directions. That is a
 * promise a linter cannot make for you and a human forgets on the third edit,
 * so it is asserted here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS_PATH = fileURLToPath(new URL('../css/rtl-ui.css', import.meta.url));
const css = readFileSync(CSS_PATH, 'utf8');

// Strip comments before scanning, so prose explaining the physical properties
// does not trip the check.
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

// Physical properties that have a logical equivalent and must never appear.
const FORBIDDEN = [
  'margin-left',
  'margin-right',
  'padding-left',
  'padding-right',
  'border-left',
  'border-right',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'text-align: left',
  'text-align: right',
  'float: left',
  'float: right',
];

for (const property of FORBIDDEN) {
  test(`the stylesheet never uses the physical property "${property}"`, () => {
    assert.equal(
      rules.includes(property),
      false,
      `${property} does not mirror in RTL - use its inline-start / inline-end equivalent`,
    );
  });
}

test('bare "left:" and "right:" offsets are not used for positioning', () => {
  // `inset-inline-start` is the logical form. A bare `left:` pins an element to
  // the physical left edge even on an RTL page.
  assert.equal(/(^|[;{\s])left\s*:/m.test(rules), false);
  assert.equal(/(^|[;{\s])right\s*:/m.test(rules), false);
});

test('every utility class is namespaced, so nothing collides with the host app', () => {
  const classNames = rules.match(/\.[A-Za-z][\w-]*/g) || [];
  const stray = [...new Set(classNames)].filter((name) => !name.startsWith('.rtl-ui-'));
  assert.deepEqual(stray, [], `unnamespaced class names: ${stray.join(', ')}`);
});

test('the documented utilities are all present', () => {
  const expected = [
    '.rtl-ui-rtl',
    '.rtl-ui-ltr',
    '.rtl-ui-isolate',
    '.rtl-ui-num',
    '.rtl-ui-code',
    '.rtl-ui-auto',
    '.rtl-ui-text-start',
    '.rtl-ui-text-end',
    '.rtl-ui-ms-auto',
    '.rtl-ui-me-auto',
    '.rtl-ui-ps-4',
    '.rtl-ui-pe-4',
    '.rtl-ui-border-s',
    '.rtl-ui-border-e',
    '.rtl-ui-round-s',
    '.rtl-ui-round-e',
    '.rtl-ui-inset-s-0',
    '.rtl-ui-inset-e-0',
    '.rtl-ui-float-s',
    '.rtl-ui-float-e',
    '.rtl-ui-flip-icon',
    '.rtl-ui-input-ltr',
    '.rtl-ui-table',
    '.rtl-ui-prose',
    '.rtl-ui-scroll-x',
  ];
  for (const name of expected) {
    assert.ok(rules.includes(`${name} `) || rules.includes(`${name},`) || rules.includes(`${name}\n`), `${name} is missing`);
  }
});

test('braces are balanced, so the file parses as CSS', () => {
  const opens = (rules.match(/{/g) || []).length;
  const closes = (rules.match(/}/g) || []).length;
  assert.equal(opens, closes);
  assert.ok(opens > 40, 'the stylesheet should not have shrunk to nothing');
});

test('the isolate utilities really set unicode-bidi', () => {
  for (const name of ['.rtl-ui-isolate', '.rtl-ui-num', '.rtl-ui-code']) {
    const block = rules.slice(rules.indexOf(name));
    const body = block.slice(block.indexOf('{'), block.indexOf('}'));
    assert.ok(body.includes('unicode-bidi'), `${name} must isolate`);
  }
});
