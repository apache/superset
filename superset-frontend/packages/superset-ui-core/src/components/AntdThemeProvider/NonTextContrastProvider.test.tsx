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
import type { ReactElement } from 'react';
import type { ThemeConfig } from 'antd';
import { supersetTheme } from '@apache-superset/core/theme';
import { render, screen } from '@superset-ui/core/spec';
import { AntdThemeProvider } from '.';
import { Checkbox } from '../Checkbox';
import { Divider } from '../Divider';
import { Input } from '../Input';
import { Switch } from '../Switch';

const primaryColors = (testId: string) =>
  new Set(
    Array.from(
      screen.getByTestId(testId).querySelectorAll('[class*="-css-var"]'),
    ).map(el =>
      getComputedStyle(el)
        .getPropertyValue('--ant-color-primary')
        .toLowerCase(),
    ),
  );

test('controls under differently themed providers keep their own theme tokens', () => {
  render(
    <>
      <AntdThemeProvider theme={{ token: { colorPrimary: '#ff0000' } }}>
        <div data-test="red-theme">
          <Input />
          <Checkbox />
          <Switch />
        </div>
      </AntdThemeProvider>
      <AntdThemeProvider theme={{ token: { colorPrimary: '#00ff00' } }}>
        <div data-test="green-theme">
          <Input />
          <Checkbox />
          <Switch />
        </div>
      </AntdThemeProvider>
    </>,
  );

  expect(primaryColors('red-theme')).toEqual(new Set(['#ff0000']));
  expect(primaryColors('green-theme')).toEqual(new Set(['#00ff00']));
});

// Custom properties inherit; resolve the value the element actually uses.
const inheritedVar = (el: Element | null, name: string): string => {
  const value = el ? getComputedStyle(el).getPropertyValue(name) : '';
  return value || !el?.parentElement
    ? value
    : inheritedVar(el.parentElement, name);
};

const AUTHOR_COLOR = '#595959';

test.each<[string, ThemeConfig, ReactElement, string, string]>([
  [
    'token.colorBorder',
    { token: { colorBorder: AUTHOR_COLOR } },
    <Input key="input" />,
    '.ant-input',
    '--ant-color-border',
  ],
  [
    'components.Input.colorBorder',
    { components: { Input: { colorBorder: AUTHOR_COLOR } } },
    <Input key="input" />,
    '.ant-input',
    '--ant-color-border',
  ],
  [
    'components.Divider.colorSplit',
    { components: { Divider: { colorSplit: AUTHOR_COLOR } } },
    <Divider key="divider" />,
    '.ant-divider',
    '--ant-color-split',
  ],
  [
    'token.colorTextQuaternary',
    { token: { colorTextQuaternary: AUTHOR_COLOR } },
    <Switch key="switch" />,
    '.ant-switch',
    '--ant-color-text-quaternary',
  ],
])(
  'a theme setting %s keeps its own value',
  (_, theme, element, selector, variable) => {
    const { container } = render(
      <AntdThemeProvider theme={theme}>{element}</AntdThemeProvider>,
    );
    expect(inheritedVar(container.querySelector(selector), variable)).toBe(
      AUTHOR_COLOR,
    );
  },
);

test('a theme Checkbox border is kept for disabled group options', () => {
  const { container } = render(
    <AntdThemeProvider
      theme={{ components: { Checkbox: { colorBorder: AUTHOR_COLOR } } }}
    >
      <Checkbox.Group options={[{ label: 'A', value: 'a', disabled: true }]} />
    </AntdThemeProvider>,
  );
  expect(
    inheritedVar(
      container.querySelector('.ant-checkbox-disabled'),
      '--ant-color-border',
    ),
  ).toBe(AUTHOR_COLOR);
});

test('a theme without its own border setting gets the contrast border', () => {
  const { container } = render(
    <AntdThemeProvider theme={{ token: { colorPrimary: '#ff0000' } }}>
      <Input />
    </AntdThemeProvider>,
  );
  expect(
    inheritedVar(container.querySelector('.ant-input'), '--ant-color-border'),
  ).toBe(supersetTheme.colorTextTertiary);
});
