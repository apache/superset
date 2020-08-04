import { ComponentType, Component, ReactNode } from 'react';

import { borderRadius, colors, spacing } from '../theme';
import { CommonProps, OptionTypeBase } from '../types';

export type MultiValueProps<OptionType extends OptionTypeBase> = CommonProps<OptionType> &{
  children: ReactNode,
  components: any,
  cropWithEllipsis: boolean,
  data: OptionType,
  innerProps: any,
  isFocused: boolean,
  isDisabled: boolean,
  removeProps: {
    onTouchEnd: (event: any) => void,
    onClick: (event: any) => void,
    onMouseDown: (event: any) => void,
  },
};

export function multiValueCSS(): React.CSSProperties;
export function multiValueLabelCSS(props: MultiValueProps<any>): React.CSSProperties;
export function multiValueRemoveCSS(props: MultiValueProps<any>): React.CSSProperties;

export interface MultiValueGenericProps<OptionType extends OptionTypeBase> {
  children: ReactNode;
  data: OptionType;
  innerProps: { className?: string };
  selectProps: any;
}
export const MultiValueGeneric: ComponentType<MultiValueGenericProps<any>>;

export const MultiValueContainer: typeof MultiValueGeneric;
export const MultiValueLabel: typeof MultiValueGeneric;
export type MultiValueRemoveProps<OptionType extends OptionTypeBase> = CommonProps<OptionType> & {
  children: ReactNode,
  innerProps: {
    className: string,
    onTouchEnd: (event: any) => void,
    onClick: (event: any) => void,
    onMouseDown: (event: any) => void,
  },
  selectProps: any,
};
export class MultiValueRemove<OptionType extends OptionTypeBase> extends Component<MultiValueRemoveProps<OptionType>> {
  static defaultProps: {
    children: ReactNode,
  };
}

export class MultiValue<OptionType extends OptionTypeBase> extends Component<MultiValueProps<OptionType>> {
  static defaultProps: {
    cropWithEllipsis: boolean,
  };
}

export default MultiValue;
