import { Component, ReactNode, ComponentType } from 'react';
import { spacing } from '../theme';
import { CommonProps, KeyboardEventHandler, OptionTypeBase } from '../types';

// ==============================
// Root Container
// ==============================

export interface ContainerState {
  /** Whether the select is disabled. */
  isDisabled: boolean;
  /** Whether the text in the select is indented from right to left. */
  isRtl: boolean;
}

export type ContainerProps<OptionType extends OptionTypeBase> = CommonProps<OptionType> &
  ContainerState & {
    /** The children to be rendered. */
    children: ReactNode,
    /** Inner props to be passed down to the container. */
    innerProps: { onKeyDown: KeyboardEventHandler },
  };
export function containerCSS(state: ContainerState): React.CSSProperties;
export const SelectContainer: ComponentType<ContainerProps<any>>;

// ==============================
// Value Container
// ==============================

export type ValueContainerProps<OptionType extends OptionTypeBase> = CommonProps<OptionType> & {
  /** Set when the value container should hold multiple values */
  isMulti: boolean,
  /** Whether the value container currently holds a value. */
  hasValue: boolean,
  /** The children to be rendered. */
  children: ReactNode,
};
export function valueContainerCSS(): React.CSSProperties;
export class ValueContainer extends Component<ValueContainerProps<any>> {}

// ==============================
// Indicator Container
// ==============================

export interface IndicatorsState {
  /** Whether the text should be rendered right to left. */
  isRtl: boolean;
}

export type IndicatorContainerProps<OptionType extends OptionTypeBase> = CommonProps<OptionType> &
  IndicatorsState & {
    /** The children to be rendered. */
    children: ReactNode,
  };

export function indicatorsContainerCSS(): React.CSSProperties;
export const IndicatorsContainer: ComponentType<IndicatorContainerProps<any>>;
