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
import React, { CSSProperties } from 'react';
import { css, SerializedStyles } from '@emotion/core';
import { supersetTheme } from '@superset-ui/style';
import {
  Styles,
  Theme,
  SelectComponentsConfig,
  components as defaultComponents,
} from 'react-select';
import { colors as reactSelectColros } from 'react-select/src/theme';
import { supersetColors } from 'src/components/styles';

export const DEFAULT_CLASS_NAME = 'Select';
export const DEFAULT_CLASS_NAME_PREFIX = 'Select';

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type ThemeConfig = {
  borderRadius: number;
  // z-index for menu dropdown
  // (the same as `@z-index-above-dashboard-charts + 1` in variables.less)
  zIndex: number;
  colors: {
    // add known colors
    [key in keyof typeof reactSelectColros]: string;
  } &
    {
      [key in keyof typeof supersetColors]: string;
    } & {
      [key: string]: string; // any other colors
    };
  spacing: Theme['spacing'] & {
    // line height and font size must be pixels for easier computation
    // of option item height in WindowedMenuList
    lineHeight: number;
    fontSize: number;
    // other relative size must be string
    minWidth: string;
  };
};

export type PartialThemeConfig = RecursivePartial<ThemeConfig>;

export const DEFAULT_THEME: PartialThemeConfig = {
  borderRadius: supersetTheme.borderRadius,
  zIndex: 11,
  colors: {
    ...supersetColors,
    dangerLight: supersetColors.warning,
  },
  spacing: {
    baseUnit: 3,
    menuGutter: 0,
    controlHeight: 28,
    lineHeight: 19,
    fontSize: 14,
    minWidth: '7.5em', // just enough to display 'No options'
  },
};

// let styles accept serialized CSS, too
type CSSStyles = CSSProperties | SerializedStyles;
type styleFnWithSerializedStyles = (
  base: CSSProperties,
  state: any,
) => CSSStyles | CSSStyles[];

export type StylesConfig = {
  [key in keyof Styles]: styleFnWithSerializedStyles;
};
export type PartialStylesConfig = Partial<StylesConfig>;

export const DEFAULT_STYLES: PartialStylesConfig = {
  container: (
    provider,
    {
      theme: {
        spacing: { minWidth },
      },
    },
  ) => [
    provider,
    css`
      min-width: ${minWidth};
    `,
  ],
  placeholder: provider => [
    provider,
    css`
      white-space: nowrap;
    `,
  ],
  indicatorSeparator: () => css`
    display: none;
  `,
  indicatorsContainer: provider => [
    provider,
    css`
      i {
        width: 1em;
        display: inline-block;
      }
    `,
  ],
  clearIndicator: provider => [
    provider,
    css`
      padding-right: 0;
    `,
  ],
  control: (
    provider,
    { isFocused, menuIsOpen, theme: { borderRadius, colors } },
  ) => {
    const isPseudoFocused = isFocused && !menuIsOpen;
    let borderColor = '#ccc';
    if (isPseudoFocused) {
      borderColor = '#000';
    } else if (menuIsOpen) {
      borderColor = `${colors.grayBorderDark} ${colors.grayBorder} ${colors.grayBorderLight}`;
    }
    return [
      provider,
      css`
        border-color: ${borderColor};
        box-shadow: ${isPseudoFocused
          ? 'inset 0 1px 1px rgba(0,0,0,.075), 0 0 0 3px rgba(0,0,0,.1)'
          : 'none'};
        border-radius: ${menuIsOpen
          ? `${borderRadius}px ${borderRadius}px 0 0`
          : `${borderRadius}px`};
        &:hover {
          border-color: ${borderColor};
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
        }
      `,
    ];
  },
  menu: (provider, { theme: { borderRadius, zIndex, colors } }) => [
    provider,
    css`
      border-radius: 0 0 ${borderRadius}px ${borderRadius}px;
      border: 1px solid #ccc;
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
      margin-top: -1px;
      border-top-color: ${colors.grayBorderLight};
      min-width: 100%;
      width: auto;
      z-index: ${zIndex}; /* override at least multi-page pagination */
    `,
  ],
  menuList: (provider, { theme: { borderRadius } }) => [
    provider,
    css`
      border-radius: 0 0 ${borderRadius}px ${borderRadius}px;
      padding-top: 0;
      padding-bottom: 0;
    `,
  ],
  option: (
    provider,
    {
      isDisabled,
      isFocused,
      isSelected,
      theme: {
        colors,
        spacing: { lineHeight, fontSize },
      },
    },
  ) => {
    let color = colors.textDefault;
    let backgroundColor = colors.lightest;
    if (isFocused) {
      backgroundColor = colors.grayBgDarker;
    } else if (isDisabled) {
      color = '#ccc';
    }
    return [
      provider,
      css`
        cursor: pointer;
        line-height: ${lineHeight}px;
        font-size: ${fontSize}px;
        background-color: ${backgroundColor};
        color: ${color};
        font-weight: ${isSelected ? 600 : 400};
        white-space: nowrap;
        &:hover:active {
          background-color: ${colors.grayBg};
        }
      `,
    ];
  },
  valueContainer: (
    provider,
    {
      isMulti,
      hasValue,
      theme: {
        spacing: { baseUnit },
      },
    },
  ) => [
    provider,
    css`
      padding-left: ${isMulti && hasValue ? 1 : baseUnit * 3}px;
    `,
  ],
  multiValueLabel: (
    provider,
    {
      theme: {
        spacing: { baseUnit },
      },
    },
  ) => ({
    ...provider,
    paddingLeft: baseUnit * 1.2,
    paddingRight: baseUnit * 1.2,
  }),
};

const { ClearIndicator, DropdownIndicator, Option } = defaultComponents;

export const DEFAULT_COMPONENTS: SelectComponentsConfig<any> = {
  Option: ({ children, innerProps, data, ...props }) => (
    <Option
      {...props}
      data={data}
      innerProps={{
        ...innerProps,
        // `@types/react-select` didn't define `style` for `innerProps`
        // @ts-ignore
        style: data && data.style ? data.style : null,
      }}
    >
      {children}
    </Option>
  ),
  ClearIndicator: props => (
    <ClearIndicator {...props}>
      <i className="fa">×</i>
    </ClearIndicator>
  ),
  DropdownIndicator: props => (
    <DropdownIndicator {...props}>
      <i
        className={`fa fa-caret-${
          props.selectProps.menuIsOpen ? 'up' : 'down'
        }`}
      />
    </DropdownIndicator>
  ),
};

export const VALUE_LABELED_STYLES: PartialStylesConfig = {
  valueContainer: (
    provider,
    {
      getValue,
      theme: {
        spacing: { baseUnit },
      },
    },
  ) => ({
    ...provider,
    paddingLeft: getValue().length > 0 ? 1 : baseUnit * 3,
  }),
  // render single value as is they are multi-value
  singleValue: (provider, props) => {
    const { getStyles } = props;
    return {
      ...getStyles('multiValue', props),
      '.metric-option': getStyles('multiValueLabel', props),
    };
  },
};
