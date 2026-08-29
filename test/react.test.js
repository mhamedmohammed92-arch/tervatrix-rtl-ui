/**
 * The React wrapper is optional, so React is an optional peer dependency and
 * may simply not be installed. These tests skip themselves in that case rather
 * than failing - `npm test` must pass on a clean clone with no install.
 *
 * Where React IS present they assert on the element tree that the components
 * return, which needs `react` alone. No react-dom, no jsdom, no test renderer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

let React = null;
try {
  React = (await import('react')).default ?? (await import('react'));
} catch {
  React = null;
}

const wrapper = React ? await import('../src/react.js') : null;
const skip = React ? false : 'react is not installed (optional peer dependency)';

test('Ltr renders a bidi-isolating <bdi> with the number class', { skip }, () => {
  const element = wrapper.Ltr({ children: '+972-4-000-0000' });
  assert.equal(element.type, 'bdi');
  assert.equal(element.props.dir, 'ltr');
  assert.ok(element.props.className.includes('rtl-ui-num'));
  assert.equal(element.props.children, '+972-4-000-0000');
});

test('Ltr keeps a caller className alongside its own', { skip }, () => {
  const element = wrapper.Ltr({ children: '42', className: 'price' });
  assert.equal(element.props.className, 'rtl-ui-num price');
});

test('Ltr can render as another element', { skip }, () => {
  assert.equal(wrapper.Ltr({ as: 'span', children: '42' }).type, 'span');
});

test('RtlProvider renders a context provider carrying the language', { skip }, () => {
  const element = wrapper.RtlProvider({ lang: 'he', children: null });
  assert.equal(element.props.value, 'he');
});

test('the module exports exactly the documented surface', { skip }, () => {
  for (const name of ['RtlProvider', 'useDirection', 'Rtl', 'Ltr', 'RtlText']) {
    assert.equal(typeof wrapper[name], 'function', `${name} must be exported`);
  }
});

test('the wrapper imports React only from the "react" specifier', { skip: false }, async () => {
  // Guards the promise in the README: importing the package root never loads
  // React. Only this one file may mention it.
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const root = stripComments(
    readFileSync(fileURLToPath(new URL('../src/index.js', import.meta.url)), 'utf8'),
  );
  assert.equal(/from\s+['"]react/.test(root), false, 'the root entry must stay framework-free');

  const react = stripComments(
    readFileSync(fileURLToPath(new URL('../src/react.js', import.meta.url)), 'utf8'),
  );
  const imports = [...react.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(imports)].sort(), ['./index.js', 'react']);
});
