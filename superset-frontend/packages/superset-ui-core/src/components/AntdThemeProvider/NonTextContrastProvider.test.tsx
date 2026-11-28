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
import { render, screen, userEvent } from '@superset-ui/core/spec';
import { AntdThemeProvider } from '.';
import { Checkbox } from '../Checkbox';
import { Divider } from '../Divider';
import { Form } from '../Form';
import { Radio } from '../Radio';
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

// A disabled flip must not remount the control: uncontrolled state survives
// and the DOM node stays the same.
type Lock = 'prop' | 'config' | 'form';

const locked = (lock: Lock, disabled: boolean, control: ReactElement) => {
  if (lock === 'config') {
    return (
      <AntdThemeProvider componentDisabled={disabled}>
        {control}
      </AntdThemeProvider>
    );
  }
  if (lock === 'form') {
    return <Form disabled={disabled}>{control}</Form>;
  }
  return control;
};

const LOCKS: Lock[] = ['prop', 'config', 'form'];

test.each(LOCKS)(
  'Checkbox keeps its checked state and node when disabled by %s',
  async lock => {
    const checkbox = (disabled: boolean) =>
      locked(
        lock,
        disabled,
        <Checkbox
          defaultChecked={false}
          {...(lock === 'prop' ? { disabled } : {})}
        />,
      );
    const { rerender } = render(checkbox(false));
    const input = screen.getByRole('checkbox');
    await userEvent.click(input);
    expect(input).toBeChecked();

    rerender(checkbox(true));

    expect(screen.getByRole('checkbox')).toBe(input);
    expect(input).toBeChecked();
    expect(input).toBeDisabled();
  },
);

test.each(LOCKS)(
  'Switch keeps its state and node when disabled by %s',
  async lock => {
    const toggle = (disabled: boolean) =>
      locked(
        lock,
        disabled,
        <Switch defaultChecked {...(lock === 'prop' ? { disabled } : {})} />,
      );
    const { rerender } = render(toggle(false));
    const button = screen.getByRole('switch');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-checked', 'false');

    rerender(toggle(true));

    expect(screen.getByRole('switch')).toBe(button);
    expect(button).toHaveAttribute('aria-checked', 'false');
    expect(button).toBeDisabled();
  },
);

test.each(LOCKS)(
  'Radio.Group keeps its selection and nodes when disabled by %s',
  async lock => {
    const group = (disabled: boolean) =>
      locked(
        lock,
        disabled,
        <Radio.Group
          defaultValue="a"
          options={[
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ]}
          {...(lock === 'prop' ? { disabled } : {})}
        />,
      );
    const { rerender } = render(group(false));
    const optionB = screen.getByRole('radio', { name: 'B' });
    await userEvent.click(optionB);
    expect(optionB).toBeChecked();

    rerender(group(true));

    expect(screen.getByRole('radio', { name: 'B' })).toBe(optionB);
    expect(optionB).toBeChecked();
    expect(optionB).toBeDisabled();
  },
);
