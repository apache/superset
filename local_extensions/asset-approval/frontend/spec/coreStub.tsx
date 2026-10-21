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

/**
 * @fileoverview Stands in for `@apache-superset/core`, which the host
 * supplies through Module Federation and which therefore does not exist on
 * disk for this extension.
 *
 * Stubbing it is also the right boundary: these tests are about what the page
 * does with the host's navigation and the review API, not about the host's
 * own theming.
 */

import emotionStyled from '@emotion/styled';

/** A theme with the handful of tokens the page's styled blocks read. */
const theme = {
  borderRadius: 4,
  colorBgContainer: '#888',
  colorBgLayout: '#888',
  colorErrorBg: '#888',
  colorInfoBg: '#888',
  colorPrimary: '#888',
  colorSplit: '#888',
  colorSuccessBg: '#888',
  colorSuccessText: '#888',
  colorText: '#888',
  colorTextSecondary: '#888',
  colorTextTertiary: '#888',
  colorWarningBg: '#888',
  colorWarningBorder: '#888',
  colorWarningText: '#888',
  fontFamilyCode: '#888',
  fontSizeSM: 4,
  fontSizeXL: 4,
  fontWeightNormal: 4,
  fontWeightStrong: 4,
  sizeUnit: 4,
};

const withTheme = (Component: never) => Component;

export const pages = {
  useSubPath: jest.fn(() => '/'),
  useNavigate: jest.fn(() => jest.fn()),
  registerPage: jest.fn(),
};

// The host's `t` interpolates; the real signature takes substitutions.
export const translation = {
  t: (value: string, ...args: unknown[]) =>
    args.reduce<string>(
      (text, arg) => text.replace('%s', String(arg)),
      value,
    ),
};

export const theme_ = theme;
export { withTheme };

/**
 * `styled` with the theme pre-bound, so a styled block's `({ theme })` call
 * resolves without the host's ThemeProvider.
 */
const styled = new Proxy(emotionStyled, {
  get(target, tag: string) {
    const base = (target as never as Record<string, never>)[tag];
    return (...args: never[]) =>
      (base as never as (...a: never[]) => never)(
        ...(args.map(arg =>
          typeof arg === 'function'
            ? (props: Record<string, unknown>) =>
                (arg as never as (p: unknown) => unknown)({ ...props, theme })
            : arg,
        ) as never[]),
      );
  },
}) as typeof emotionStyled;

export const themeNamespace = { styled };
export { themeNamespace as theme };
