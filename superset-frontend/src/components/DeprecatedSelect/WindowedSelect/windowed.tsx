/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, {
  ComponentType,
  FunctionComponent,
  ReactElement,
  forwardRef,
} from 'react';
import Select, {
  Props as SelectProps,
  OptionTypeBase,
  MenuListComponentProps,
  components as defaultComponents,
} from 'react-select';
import WindowedMenuList, { WindowedMenuListProps } from './WindowedMenuList';

const { MenuList: DefaultMenuList } = defaultComponents;

export const DEFAULT_WINDOW_THRESHOLD = 100;

export type WindowedSelectProps<OptionType extends OptionTypeBase> =
  SelectProps<OptionType> & {
    windowThreshold?: number;
  } & WindowedMenuListProps['selectProps'];

export type WindowedSelectComponentType<OptionType extends OptionTypeBase> =
  FunctionComponent<WindowedSelectProps<OptionType>>;

export function MenuList<OptionType extends OptionTypeBase>({
  children,
  ...props
}: MenuListComponentProps<OptionType> & {
  selectProps: WindowedSelectProps<OptionType>;
}) {
  const { windowThreshold = DEFAULT_WINDOW_THRESHOLD } = props.selectProps;
  if (Array.isArray(children) && children.length > windowThreshold) {
    return (
      <WindowedMenuList {...props}>
        {children as ReactElement[]}
      </WindowedMenuList>
    );
  }
  return <DefaultMenuList {...props}>{children}</DefaultMenuList>;
}

/**
 * Add "windowThreshold" option to a react-select component, turn the options
 * list into a virtualized list when appropriate.
 *
 * @param SelectComponent the React component to render Select
 */
export default function windowed<OptionType extends OptionTypeBase>(
  SelectComponent: ComponentType<SelectProps<OptionType>>,
): WindowedSelectComponentType<OptionType> {
  const WindowedSelect = forwardRef(
    (
      props: WindowedSelectProps<OptionType>,
      ref: React.RefObject<Select<OptionType>>,
    ) => {
      const { components: components_ = {}, ...restProps } = props;
      const components = { ...components_, MenuList };
      return (
        <SelectComponent components={components} ref={ref} {...restProps} />
      );
    },
  );
  return WindowedSelect;
}
