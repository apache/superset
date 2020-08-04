import { ComponentType, ReactNode, Ref as ElementRef } from 'react';

import { borderRadius, colors, spacing } from '../theme';
import { CommonProps, OptionTypeBase, PropsWithStyles } from '../types';

interface State {
  /** Whether the select is disabled. */
  isDisabled: boolean;
  /** Whether the select is focused. */
  isFocused: boolean;
}

export type ControlProps<OptionType extends OptionTypeBase> = CommonProps<OptionType> &
  PropsWithStyles &
  State & {
    /** Children to render. */
    children: ReactNode,
    innerRef: ElementRef<any>,
    /** The mouse down event and the innerRef to pass down to the controller element. */
    innerProps: {
      onMouseDown: (event: React.MouseEvent<HTMLElement>) => void,
    },
  };

export function css(state: State): React.CSSProperties;

declare const Control: ComponentType<ControlProps<any>>;

export default Control;
