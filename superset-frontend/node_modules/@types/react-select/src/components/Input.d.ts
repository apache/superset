import { ComponentType, Ref as ElementRef } from 'react';

import { colors, spacing } from '../theme';

import { PropsWithStyles, ClassNamesState } from '../types';

export type InputProps = PropsWithStyles & {
  cx: (a: string | null, b: ClassNamesState, c: string) => string | void,
  /** Reference to the internal element */
  innerRef: (element: ElementRef<any>) => void,
  /** Set whether the input should be visible. Does not affect input size. */
  isHidden: boolean,
  /** Whether the input is disabled */
  isDisabled?: boolean,
  className?: string,
};

export function inputCSS(props: InputProps): React.CSSProperties;
export function inputStyle(isHidden: boolean): React.CSSProperties;

export const Input: ComponentType<InputProps>;

export default Input;
