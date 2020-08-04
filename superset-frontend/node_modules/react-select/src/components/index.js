// @flow
import { type ComponentType, type Element } from 'react';
import {
  type IndicatorContainerProps,
  type ContainerProps,
  type ValueContainerProps,
  IndicatorsContainer,
  SelectContainer,
  ValueContainer,
} from './containers';
import {
  type IndicatorProps,
  type LoadingIconProps,
  ClearIndicator,
  DropdownIndicator,
  LoadingIndicator,
  IndicatorSeparator,
  DownChevron,
  CrossIcon,
} from './indicators';

import Control, { type ControlProps } from './Control';
import Group, { type GroupProps, GroupHeading } from './Group';
import Input, { type InputProps } from './Input';
import Menu, {
  type MenuProps,
  MenuList,
  type MenuListComponentProps,
  MenuPortal,
  type MenuPortalProps,
  type NoticeProps,
  NoOptionsMessage,
  LoadingMessage,
} from './Menu';
import MultiValue, {
  type MultiValueProps,
  MultiValueContainer,
  MultiValueLabel,
  MultiValueRemove,
} from './MultiValue';
import Option, { type OptionProps } from './Option';
import Placeholder, { type PlaceholderProps } from './Placeholder';
import SingleValue, { type SingleValueProps } from './SingleValue';

export type PlaceholderOrValue =
  | Element<ComponentType<PlaceholderProps>>
  | Element<ComponentType<SingleValueProps>>
  | Array<Element<ComponentType<MultiValueProps>>>;

type IndicatorComponentType = ComponentType<IndicatorProps>;

export type SelectComponents = {
  ClearIndicator: IndicatorComponentType | null,
  Control: ComponentType<ControlProps>,
  DropdownIndicator: IndicatorComponentType | null,
  DownChevron: ComponentType<any>,
  CrossIcon: ComponentType<any>,
  Group: ComponentType<GroupProps>,
  GroupHeading: ComponentType<any>,
  IndicatorsContainer: ComponentType<IndicatorContainerProps>,
  IndicatorSeparator: IndicatorComponentType | null,
  Input: ComponentType<InputProps>,
  LoadingIndicator: ComponentType<LoadingIconProps> | null,
  Menu: ComponentType<MenuProps>,
  MenuList: ComponentType<MenuListComponentProps>,
  MenuPortal: ComponentType<MenuPortalProps>,
  LoadingMessage: ComponentType<NoticeProps>,
  NoOptionsMessage: ComponentType<NoticeProps>,
  MultiValue: ComponentType<MultiValueProps>,
  MultiValueContainer: ComponentType<any>,
  MultiValueLabel: ComponentType<any>,
  MultiValueRemove: ComponentType<any>,
  Option: ComponentType<OptionProps>,
  Placeholder: ComponentType<PlaceholderProps>,
  SelectContainer: ComponentType<ContainerProps>,
  SingleValue: ComponentType<SingleValueProps>,
  ValueContainer: ComponentType<ValueContainerProps>,
};

export type SelectComponentsConfig = $Shape<SelectComponents>;

export const components = {
  ClearIndicator: ClearIndicator,
  Control: Control,
  DropdownIndicator: DropdownIndicator,
  DownChevron: DownChevron,
  CrossIcon: CrossIcon,
  Group: Group,
  GroupHeading: GroupHeading,
  IndicatorsContainer: IndicatorsContainer,
  IndicatorSeparator: IndicatorSeparator,
  Input: Input,
  LoadingIndicator: LoadingIndicator,
  Menu: Menu,
  MenuList: MenuList,
  MenuPortal: MenuPortal,
  LoadingMessage: LoadingMessage,
  NoOptionsMessage: NoOptionsMessage,
  MultiValue: MultiValue,
  MultiValueContainer: MultiValueContainer,
  MultiValueLabel: MultiValueLabel,
  MultiValueRemove: MultiValueRemove,
  Option: Option,
  Placeholder: Placeholder,
  SelectContainer: SelectContainer,
  SingleValue: SingleValue,
  ValueContainer: ValueContainer,
};

type Props = {
  components: SelectComponentsConfig,
};

export const defaultComponents = (props: Props) => ({
  ...components,
  ...props.components,
});
