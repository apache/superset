import {
  ComponentType,
  ReactElement as Element,
} from 'react';
import {
  IndicatorContainerProps,
  ContainerProps,
  ValueContainerProps,
  IndicatorsContainer,
  SelectContainer,
  ValueContainer,
} from './containers';
import {
  IndicatorProps,
  LoadingIconProps,
  ClearIndicator,
  DropdownIndicator,
  LoadingIndicator,
  IndicatorSeparator,
  DownChevron,
  CrossIcon,
} from './indicators';

import Control, { ControlProps } from './Control';
import Group, { GroupProps, GroupHeading } from './Group';
import Input, { InputProps } from './Input';
import Menu, {
  MenuProps,
  MenuList,
  MenuListComponentProps,
  MenuPortal,
  MenuPortalProps,
  NoticeProps,
  NoOptionsMessage,
  LoadingMessage,
} from './Menu';
import MultiValue, {
  MultiValueProps,
  MultiValueContainer,
  MultiValueLabel,
  MultiValueRemove,
} from './MultiValue';
import Option, { OptionProps } from './Option';
import Placeholder, { PlaceholderProps } from './Placeholder';
import SingleValue, { SingleValueProps } from './SingleValue';
import { OptionTypeBase } from '../types';

export type PlaceholderOrValue<OptionType extends OptionTypeBase> =
  | Element<ComponentType<PlaceholderProps<OptionType>>>
  | Element<ComponentType<SingleValueProps<OptionType>>>
  | Array<Element<ComponentType<MultiValueProps<OptionType>>>>;

export type IndicatorComponentType<OptionType extends OptionTypeBase> = ComponentType<IndicatorProps<OptionType>>;

export interface SelectComponents<OptionType extends OptionTypeBase> {
  ClearIndicator: IndicatorComponentType<OptionType> | null;
  Control: ComponentType<ControlProps<OptionType>>;
  DropdownIndicator: IndicatorComponentType<OptionType> | null;
  DownChevron: ComponentType<any>;
  CrossIcon: ComponentType<any>;
  Group: ComponentType<GroupProps<OptionType>>;
  GroupHeading: ComponentType<any>;
  IndicatorsContainer: ComponentType<IndicatorContainerProps<OptionType>>;
  IndicatorSeparator: IndicatorComponentType<OptionType> | null;
  Input: ComponentType<InputProps>;
  LoadingIndicator: ComponentType<LoadingIconProps<OptionType>> | null;
  Menu: ComponentType<MenuProps<OptionType>>;
  MenuList: ComponentType<MenuListComponentProps<OptionType>>;
  MenuPortal: ComponentType<MenuPortalProps<OptionType>>;
  LoadingMessage: ComponentType<NoticeProps<OptionType>>;
  NoOptionsMessage: ComponentType<NoticeProps<OptionType>>;
  MultiValue: ComponentType<MultiValueProps<OptionType>>;
  MultiValueContainer: ComponentType<any>;
  MultiValueLabel: ComponentType<any>;
  MultiValueRemove: ComponentType<any>;
  Option: ComponentType<OptionProps<OptionType>>;
  Placeholder: ComponentType<PlaceholderProps<OptionType>>;
  SelectContainer: ComponentType<ContainerProps<OptionType>>;
  SingleValue: ComponentType<SingleValueProps<OptionType>>;
  ValueContainer: ComponentType<ValueContainerProps<OptionType>>;
}

export type SelectComponentsConfig<OptionType extends OptionTypeBase> = Partial<SelectComponents<OptionType>>;

export type DeepNonNullable<T> = {
    [P in keyof T]-?: NonNullable<T[P]>;
};

export const components: Required<DeepNonNullable<SelectComponents<any>>>;

export interface Props<OptionType extends OptionTypeBase> {
  components: SelectComponentsConfig<OptionType>;
}

export function defaultComponents<OptionType extends OptionTypeBase>(props: Props<OptionType>): SelectComponents<OptionType>;
