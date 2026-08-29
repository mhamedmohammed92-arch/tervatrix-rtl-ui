/** LEFT-TO-RIGHT ISOLATE, U+2066. */
export declare const LRI: string;
/** POP DIRECTIONAL ISOLATE, U+2069. */
export declare const PDI: string;
/** RIGHT-TO-LEFT MARK, U+200F. */
export declare const RLM: string;

export declare const RTL_LANGUAGES: readonly string[];

export type DetectedLanguage = 'he' | 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';

export declare function detectLanguage(text: string): DetectedLanguage;
export declare function isRtl(language: string): boolean;
export declare function dirFor(language: string): Direction;
export declare function isolateLtrRuns(text: string): string;
export declare function isolate(value: string | number | null | undefined): string;
export declare function formatTimeRange(start: string, end: string, separator?: string): string;
export declare function forceRtlParagraphs(text: string): string;
export declare function prepareRtl(text: string, language?: string | null): string;
export declare const prepareOutbound: typeof prepareRtl;
export declare function stripBidi(text: string): string;

declare const _default: {
  LRI: typeof LRI;
  PDI: typeof PDI;
  RLM: typeof RLM;
  RTL_LANGUAGES: typeof RTL_LANGUAGES;
  detectLanguage: typeof detectLanguage;
  isRtl: typeof isRtl;
  dirFor: typeof dirFor;
  isolate: typeof isolate;
  isolateLtrRuns: typeof isolateLtrRuns;
  formatTimeRange: typeof formatTimeRange;
  forceRtlParagraphs: typeof forceRtlParagraphs;
  prepareRtl: typeof prepareRtl;
  prepareOutbound: typeof prepareOutbound;
  stripBidi: typeof stripBidi;
};
export default _default;
