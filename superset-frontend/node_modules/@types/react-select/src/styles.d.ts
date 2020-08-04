import {
  containerCSS,
  indicatorsContainerCSS,
  valueContainerCSS,
} from './components/containers';
import { css as controlCSS } from './components/Control';
import { groupCSS, groupHeadingCSS } from './components/Group';
import {
  clearIndicatorCSS,
  dropdownIndicatorCSS,
  loadingIndicatorCSS,
  indicatorSeparatorCSS,
} from './components/indicators';
import { inputCSS } from './components/Input';
import { placeholderCSS } from './components/Placeholder';
import { optionCSS } from './components/Option';
import {
  menuCSS,
  menuListCSS,
  menuPortalCSS,
  noOptionsMessageCSS,
  loadingMessageCSS,
} from './components/Menu';
import { css as singleValueCSS } from './components/SingleValue';
import {
  multiValueCSS,
  multiValueLabelCSS,
  multiValueRemoveCSS,
} from './components/MultiValue';
import { CSSProperties } from 'react';

export interface Props { [key: string]: any; }

/**
 * @param base -- the component's default style
 * @param state -- the component's current state e.g. `isFocused`
 * @returns
 */
export type styleFn = (base: CSSProperties, state: any) => CSSProperties;

export interface Styles {
  clearIndicator?: styleFn;
  container?: styleFn;
  control?: styleFn;
  dropdownIndicator?: styleFn;
  group?: styleFn;
  groupHeading?: styleFn;
  indicatorsContainer?: styleFn;
  indicatorSeparator?: styleFn;
  input?: styleFn;
  loadingIndicator?: styleFn;
  // TODO loadingMessageCSS?: styleFn;
  loadingMessage?: styleFn;
  menu?: styleFn;
  menuList?: styleFn;
  menuPortal?: styleFn;
  multiValue?: styleFn;
  multiValueLabel?: styleFn;
  multiValueRemove?: styleFn;
  // TODO noOptionsMessageCSS?: styleFn;
  noOptionsMessage?: styleFn;
  option?: styleFn;
  placeholder?: styleFn;
  singleValue?: styleFn;
  valueContainer?: styleFn;
}
export type StylesConfig = Partial<Styles>;
export type GetStyles = (a: string, b: Props) => CSSProperties;

export const defaultStyles: Styles;

// Merge Utility
// Allows consumers to extend a base Select with additional styles

export function mergeStyles(source: StylesConfig, target: StylesConfig): StylesConfig;
