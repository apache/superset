// @flow
import type { Ref } from 'react';

export type OptionType = {
  [string]: any,
};

export type OptionsType = Array<OptionType>;

export type GroupType = {
  options: OptionsType,
  [string]: any,
};

export type ValueType = OptionType | OptionsType | null | void;

export type FocusEventHandler = (SyntheticFocusEvent<HTMLElement>) => void;
export type MouseEventHandler = (SyntheticMouseEvent<HTMLElement>) => void;
export type KeyboardEventHandler = (
  SyntheticKeyboardEvent<HTMLElement>
) => void;

export type InnerRef = Ref<*>;
export type PropsWithInnerRef = {
  /** The inner reference. */
  innerRef: Ref<*>,
};

type ThemeSpacing = {
  baseUnit: number,
  controlHeight: number,
  menuGutter: number,
};

export type Theme = {
  borderRadius: number,
  colors: { [key: string]: string },
  spacing: ThemeSpacing,
};

export type PropsWithStyles = {
  /**
    Get the styles of a particular part of the select. Pass in the name of the
    property as the first argument, and the current props as the second argument.
    See the `styles` object for the properties available.
  */
  getStyles: (string, any) => {},
  theme: Theme,
};

export type ClassNameList = Array<string>;
export type ClassNamesState = { [string]: boolean } | void;

export type CommonProps = {
  clearValue: () => void,
  className?: string,
  cx: (
    state: ClassNamesState | void,
    className: string | void
  ) => string | void,
  /**
    Get the styles of a particular part of the select. Pass in the name of the
    property as the first argument, and the current props as the second argument.
    See the `styles` object for the properties available.
  */
  getStyles: (string, any) => {},
  theme: Theme,
  getValue: () => ValueType,
  hasValue: boolean,
  isMulti: boolean,
  options: OptionsType,
  selectOption: OptionType => void,
  selectProps: any,
  setValue: (ValueType, ActionTypes) => void,
};

export type ActionTypes =
  | 'select-option'
  | 'deselect-option'
  | 'remove-value'
  | 'pop-value'
  | 'set-value'
  | 'clear'
  | 'create-option';

export type ActionMeta = {
  action: ActionTypes,
};

export type InputActionTypes =
  | 'set-value'
  | 'input-change'
  | 'input-blur'
  | 'menu-close';

export type InputActionMeta = {|
  action: InputActionTypes,
|};

export type MenuPlacement = 'auto' | 'bottom' | 'top';
export type MenuPosition = 'absolute' | 'fixed';

export type FocusDirection =
  | 'up'
  | 'down'
  | 'pageup'
  | 'pagedown'
  | 'first'
  | 'last';

export type OptionProps = PropsWithInnerRef & {
  data: any,
  id: number,
  index: number,
  isDisabled: boolean,
  isFocused: boolean,
  isSelected: boolean,
  label: string,
  onClick: MouseEventHandler,
  onMouseOver: MouseEventHandler,
  value: any,
};
