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
  useRef,
  useEffect,
  Component,
  FunctionComponent,
  RefObject,
} from 'react';
import {
  ListChildComponentProps,
  FixedSizeList as WindowedList,
} from 'react-window';
import {
  OptionTypeBase,
  OptionProps,
  MenuListComponentProps,
} from 'react-select';
import { ThemeConfig } from '../styles';

export type WindowedMenuListProps = {
  selectProps: {
    windowListRef?: RefObject<WindowedList>;
    optionHeight?: number;
  };
};

/**
 * MenuListComponentProps should always have `children` elements, as guaranteed
 * by https://github.com/JedWatson/react-select/blob/32ad5c040bdd96cd1ca71010c2558842d684629c/packages/react-select/src/Select.js#L1686-L1719
 *
 * `children` may also be `Component<NoticeProps<OptionType>>` if options are not
 * provided (e.g., when async list is still loading, or no results), but that's
 * not possible because this MenuList will only be rendered when
 * optionsLength > windowThreshold.
 *
 * If may also be `Component<GroupProps<OptionType>>[]` but we are not supporting
 * grouped options just yet.
 */
export type MenuListProps<
  OptionType extends OptionTypeBase
> = MenuListComponentProps<OptionType> & {
  children: Component<OptionProps<OptionType>>[];
  // theme is not present with built-in @types/react-select, but is actually
  // available via CommonProps.
  theme?: ThemeConfig;
  className?: string;
} & WindowedMenuListProps;

const DEFAULT_OPTION_HEIGHT = 30;

/**
 * Get the index of the last selected option.
 */
function getLastSelected(children: Component<any>[]) {
  return Array.isArray(children)
    ? children.findIndex(
        ({ props: { isFocused = false } = {} }) => isFocused,
      ) || 0
    : -1;
}

/**
 * Calculate probable option height as set in theme configs
 */
function detectHeight({ spacing: { baseUnit, lineHeight } }: ThemeConfig) {
  // Option item expects 2 * baseUnit for each of top and bottom padding.
  return baseUnit * 4 + lineHeight;
}

export default function WindowedMenuList<OptionType extends OptionTypeBase>({
  children,
  ...props
}: MenuListProps<OptionType>) {
  const {
    maxHeight,
    selectProps,
    theme,
    getStyles,
    cx,
    innerRef,
    isMulti,
    className,
  } = props;
  const {
    // Expose react-window VariableSizeList instance and HTML elements
    windowListRef = useRef(null),
    windowListInnerRef,
  } = selectProps;

  // try get default option height from theme configs
  let { optionHeight } = selectProps;
  if (!optionHeight) {
    optionHeight = theme ? detectHeight(theme) : DEFAULT_OPTION_HEIGHT;
  }

  const itemCount = children.length;
  const totalHeight = optionHeight * itemCount;
  const listRef: RefObject<WindowedList> = windowListRef || useRef(null);

  const Row: FunctionComponent<ListChildComponentProps> = ({
    data,
    index,
    style,
  }) => {
    return <div style={style}>{data[index]}</div>;
  };

  useEffect(() => {
    const lastSelected = getLastSelected(children);
    if (listRef.current && lastSelected) {
      listRef.current.scrollToItem(lastSelected);
    }
  }, [children]);

  return (
    <WindowedList
      css={getStyles('menuList', props)}
      // @ts-ignore
      className={cx(
        {
          'menu-list': true,
          'menu-list--is-multi': isMulti,
        },
        className,
      )}
      ref={listRef}
      outerRef={innerRef}
      innerRef={windowListInnerRef}
      height={Math.min(totalHeight, maxHeight)}
      width="100%"
      itemData={children}
      itemCount={children.length}
      itemSize={optionHeight}
    >
      {Row}
    </WindowedList>
  );
}
