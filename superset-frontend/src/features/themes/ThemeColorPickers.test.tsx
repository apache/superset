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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import ThemeColorPickers, {
  CURATED_COLOR_TOKENS,
  patchThemeJsonToken,
  tryParseThemeJson,
} from './ThemeColorPickers';

test('tryParseThemeJson returns null for empty, blank, or invalid JSON', () => {
  expect(tryParseThemeJson(undefined)).toBeNull();
  expect(tryParseThemeJson('')).toBeNull();
  expect(tryParseThemeJson('   ')).toBeNull();
  expect(tryParseThemeJson('{ "token": { invalid')).toBeNull();
  expect(tryParseThemeJson('"just a string"')).toBeNull();
});

test('tryParseThemeJson returns the parsed object for valid JSON', () => {
  expect(tryParseThemeJson('{"token":{"colorPrimary":"#1890ff"}}')).toEqual({
    token: { colorPrimary: '#1890ff' },
  });
});

test('tryParseThemeJson rejects a non-object token instead of letting a picker edit corrupt it', () => {
  expect(tryParseThemeJson('{"token":"not an object"}')).toBeNull();
  expect(tryParseThemeJson('{"token":["also","not"]}')).toBeNull();
  expect(tryParseThemeJson('{"token":42}')).toBeNull();
});

test('patchThemeJsonToken never spreads a malformed token into numeric-keyed junk', () => {
  // A picker's onChange is gated on tryParseThemeJson succeeding first (see
  // ThemeColorPickers' isValid check), but patchThemeJsonToken is exported
  // and tested standalone -- it must not corrupt data even if called directly.
  const result = patchThemeJsonToken(
    '{"token":"not an object"}',
    'colorPrimary',
    '#336699',
  );
  expect(JSON.parse(result)).toEqual({ token: { colorPrimary: '#336699' } });
});

test('patchThemeJsonToken sets the token under an empty theme', () => {
  const result = patchThemeJsonToken('{}', 'colorPrimary', '#336699');
  expect(JSON.parse(result)).toEqual({ token: { colorPrimary: '#336699' } });
});

test('patchThemeJsonToken preserves every other key, curated or not', () => {
  const original = JSON.stringify({
    token: {
      colorPrimary: '#1890ff',
      colorSuccess: '#52c41a',
      someUncuratedToken: 'value',
    },
    components: { Button: { borderRadius: 4 } },
  });

  const result = patchThemeJsonToken(original, 'colorPrimary', '#ff0000');

  expect(JSON.parse(result)).toEqual({
    token: {
      colorPrimary: '#ff0000',
      colorSuccess: '#52c41a',
      someUncuratedToken: 'value',
    },
    components: { Button: { borderRadius: 4 } },
  });
});

test('patchThemeJsonToken falls back to an empty object when the input JSON is invalid', () => {
  const result = patchThemeJsonToken(
    '{ not valid json',
    'colorPrimary',
    '#336699',
  );
  expect(JSON.parse(result)).toEqual({ token: { colorPrimary: '#336699' } });
});

test('curates exactly the documented SEED + alias tokens, no more no less', () => {
  expect(CURATED_COLOR_TOKENS.map(t => t.key)).toEqual([
    'colorPrimary',
    'colorSuccess',
    'colorWarning',
    'colorError',
    'colorInfo',
    'colorLink',
    'colorText',
    'colorTextSecondary',
    'colorBgBase',
    'colorBgContainer',
    'colorBorder',
  ]);
});

test('renders a picker row for every curated token', () => {
  render(
    <ThemeColorPickers
      jsonData={JSON.stringify({ token: { colorPrimary: '#1890ff' } })}
      onChange={jest.fn()}
    />,
  );

  CURATED_COLOR_TOKENS.forEach(({ key }) => {
    expect(screen.getByTestId(`theme-color-picker-${key}`)).toBeInTheDocument();
  });
  expect(document.querySelectorAll('.ant-color-picker-trigger')).toHaveLength(
    CURATED_COLOR_TOKENS.length,
  );
});

test('shows the invalid-JSON notice and does not crash when jsonData is mid-edit', () => {
  render(
    <ThemeColorPickers
      jsonData='{ "token": { "colorPrimary"'
      onChange={jest.fn()}
    />,
  );

  expect(
    screen.getByTestId('theme-color-pickers-invalid-json-notice'),
  ).toBeInTheDocument();
  // still renders every picker row without throwing, just with no value
  expect(document.querySelectorAll('.ant-color-picker-trigger')).toHaveLength(
    CURATED_COLOR_TOKENS.length,
  );
});

test('calls onChange with the patched JSON when a picker value changes', async () => {
  const onChange = jest.fn();
  render(
    <ThemeColorPickers
      jsonData={JSON.stringify({ token: { colorPrimary: '#1890ff' } }, null, 2)}
      onChange={onChange}
    />,
  );

  const trigger = screen
    .getByTestId('theme-color-picker-colorSuccess')
    .querySelector('.ant-color-picker-trigger');
  expect(trigger).toBeInTheDocument();
  await userEvent.click(trigger!);

  await waitFor(() => {
    expect(document.querySelector('.ant-color-picker')).toBeInTheDocument();
  });

  const hexInput = document.querySelector<HTMLInputElement>(
    '.ant-color-picker-input input',
  );
  expect(hexInput).toBeInTheDocument();
  await userEvent.clear(hexInput!);
  await userEvent.type(hexInput!, '00ff00{enter}');

  await waitFor(() => {
    expect(onChange).toHaveBeenCalled();
  });
  const patched = JSON.parse(
    onChange.mock.calls[onChange.mock.calls.length - 1][0],
  );
  expect(patched.token.colorSuccess.toLowerCase()).toBe('#00ff00');
  // the pre-existing, uncurated-in-this-edit token survives untouched
  expect(patched.token.colorPrimary).toBe('#1890ff');
});

test('does not call onChange when disabled', async () => {
  const onChange = jest.fn();
  render(
    <ThemeColorPickers
      jsonData={JSON.stringify({ token: { colorPrimary: '#1890ff' } })}
      onChange={onChange}
      disabled
    />,
  );

  const trigger = screen
    .getByTestId('theme-color-picker-colorPrimary')
    .querySelector('.ant-color-picker-trigger');
  await userEvent.click(trigger!);

  await waitFor(() => {
    expect(document.querySelector('.ant-color-picker')).toBeInTheDocument();
  });
  const hexInput = document.querySelector<HTMLInputElement>(
    '.ant-color-picker-input input',
  );
  await userEvent.clear(hexInput!);
  await userEvent.type(hexInput!, '00ff00{enter}');

  expect(onChange).not.toHaveBeenCalled();
});
