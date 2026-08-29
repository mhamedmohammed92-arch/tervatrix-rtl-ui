/**
 * @tervatrix/rtl-ui/react - the optional React wrapper.
 *
 * This entry point is the ONLY file in the package that touches React.
 * Importing `@tervatrix/rtl-ui` never loads it, so the package stays
 * framework-free for everyone else. React is an optional peer dependency.
 *
 *   import { RtlProvider, Rtl, Ltr, RtlText, useDirection } from '@tervatrix/rtl-ui/react';
 */

import { createContext, createElement, useContext, useMemo } from 'react';
import { detectLanguage, dirFor, isRtl, prepareRtl } from './index.js';

const LanguageContext = createContext('en');

/**
 * Put the page language in context once, near the root.
 * Everything below can then read it without prop-drilling.
 *
 * @param {{ lang: string, children?: any }} props
 */
export function RtlProvider({ lang, children }) {
  return createElement(LanguageContext.Provider, { value: lang }, children);
}

/**
 * `{ lang, dir, isRtl }` for the nearest RtlProvider, or for an explicit
 * language you pass in.
 *
 * @param {string} [lang]
 */
export function useDirection(lang) {
  const inherited = useContext(LanguageContext);
  const language = lang || inherited;
  return useMemo(
    () => ({ lang: language, dir: dirFor(language), isRtl: isRtl(language) }),
    [language],
  );
}

/**
 * A container that carries the right `dir` and `lang` attributes.
 *
 * `<Rtl lang="he">...</Rtl>` renders `<div dir="rtl" lang="he">`.
 * Pass `as` to render something other than a div.
 *
 * @param {{ lang?: string, as?: any, children?: any, [key: string]: any }} props
 */
export function Rtl({ lang, as = 'div', children, ...rest }) {
  const { lang: language, dir } = useDirection(lang);
  return createElement(as, { dir, lang: language, ...rest }, children);
}

/**
 * One left-to-right island inside right-to-left prose: a phone number, a price,
 * an order id, a URL, an e-mail address, an opening-hours range.
 *
 * Renders a `<bdi>`, the HTML element whose entire job is bidi isolation, so no
 * control characters end up in the DOM text and copy-paste stays clean.
 *
 * @param {{ as?: any, children?: any, [key: string]: any }} props
 */
export function Ltr({ as = 'bdi', children, className, ...rest }) {
  return createElement(
    as,
    {
      dir: 'ltr',
      className: className ? `rtl-ui-num ${className}` : 'rtl-ui-num',
      ...rest,
    },
    children,
  );
}

/**
 * A block of text run through {@link prepareRtl} before it is rendered.
 *
 * Use it for text you did not author - a message from a database, an API, or a
 * translation file - where you cannot wrap the numbers by hand. Newlines are
 * preserved with `white-space: pre-line`.
 *
 * @param {{ text: string, lang?: string, as?: any, [key: string]: any }} props
 */
export function RtlText({ text, lang, as = 'span', style, ...rest }) {
  const language = lang || detectLanguage(text || '');
  const prepared = useMemo(() => prepareRtl(text || '', language), [text, language]);
  return createElement(
    as,
    {
      dir: dirFor(language),
      lang: language,
      style: { whiteSpace: 'pre-line', ...style },
      ...rest,
    },
    prepared,
  );
}

export default { RtlProvider, useDirection, Rtl, Ltr, RtlText };
