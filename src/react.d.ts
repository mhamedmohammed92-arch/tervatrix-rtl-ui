import type { ElementType, ReactNode } from 'react';
import type { Direction } from './index.js';

export interface RtlProviderProps {
  lang: string;
  children?: ReactNode;
}
export declare function RtlProvider(props: RtlProviderProps): JSX.Element;

export interface DirectionInfo {
  lang: string;
  dir: Direction;
  isRtl: boolean;
}
export declare function useDirection(lang?: string): DirectionInfo;

export interface RtlProps {
  lang?: string;
  as?: ElementType;
  children?: ReactNode;
  [key: string]: unknown;
}
export declare function Rtl(props: RtlProps): JSX.Element;

export interface LtrProps {
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}
export declare function Ltr(props: LtrProps): JSX.Element;

export interface RtlTextProps {
  text: string;
  lang?: string;
  as?: ElementType;
  style?: Record<string, unknown>;
  [key: string]: unknown;
}
export declare function RtlText(props: RtlTextProps): JSX.Element;

declare const _default: {
  RtlProvider: typeof RtlProvider;
  useDirection: typeof useDirection;
  Rtl: typeof Rtl;
  Ltr: typeof Ltr;
  RtlText: typeof RtlText;
};
export default _default;
