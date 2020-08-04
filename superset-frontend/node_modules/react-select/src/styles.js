// @flow

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

type Props = { [key: string]: any };

// TODO: flow for state
type StyleFn = (props: Props, state: { [key: string]: any }) => {};

export type Styles = {
  clearIndicator?: StyleFn,
  container?: StyleFn,
  control?: StyleFn,
  dropdownIndicator?: StyleFn,
  group?: StyleFn,
  groupHeading?: StyleFn,
  indicatorsContainer?: StyleFn,
  indicatorSeparator?: StyleFn,
  input?: StyleFn,
  loadingIndicator?: StyleFn,
  loadingMessage?: StyleFn,
  menu?: StyleFn,
  menuList?: StyleFn,
  menuPortal?: StyleFn,
  multiValue?: StyleFn,
  multiValueLabel?: StyleFn,
  multiValueRemove?: StyleFn,
  noOptionsMessage?: StyleFn,
  option?: StyleFn,
  placeholder?: StyleFn,
  singleValue?: StyleFn,
  valueContainer: StyleFn,
};
export type StylesConfig = $Shape<Styles>;
export type GetStyles = (string, Props) => {};

export const defaultStyles: Styles = {
  clearIndicator: clearIndicatorCSS,
  container: containerCSS,
  control: controlCSS,
  dropdownIndicator: dropdownIndicatorCSS,
  group: groupCSS,
  groupHeading: groupHeadingCSS,
  indicatorsContainer: indicatorsContainerCSS,
  indicatorSeparator: indicatorSeparatorCSS,
  input: inputCSS,
  loadingIndicator: loadingIndicatorCSS,
  loadingMessage: loadingMessageCSS,
  menu: menuCSS,
  menuList: menuListCSS,
  menuPortal: menuPortalCSS,
  multiValue: multiValueCSS,
  multiValueLabel: multiValueLabelCSS,
  multiValueRemove: multiValueRemoveCSS,
  noOptionsMessage: noOptionsMessageCSS,
  option: optionCSS,
  placeholder: placeholderCSS,
  singleValue: singleValueCSS,
  valueContainer: valueContainerCSS,
};

// Merge Utility
// Allows consumers to extend a base Select with additional styles

export function mergeStyles(source: Object, target: Object = {}) {
  // initialize with source styles
  const styles = { ...source };

  // massage in target styles
  Object.keys(target).forEach(key => {
    if (source[key]) {
      styles[key] = (rsCss, props) => {
        return target[key](source[key](rsCss, props), props);
      };
    } else {
      styles[key] = target[key];
    }
  });

  return styles;
}
