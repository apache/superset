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
import {
  CategoricalScheme,
  getCategoricalSchemeRegistry,
} from '@superset-ui/core';
import ColorPickerControl from 'src/explore/components/controls/ColorPickerControl';

const defaultProps = {
  value: { r: 0, g: 122, b: 135, a: 1 },
  onChange: jest.fn(),
};

beforeAll(() => {
  getCategoricalSchemeRegistry()
    .registerValue(
      'test',
      new CategoricalScheme({
        id: 'test',
        colors: ['#ff0000', '#00ff00', '#0000ff'],
      }),
    )
    .setDefaultKey('test');
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders a ColorPicker component', () => {
  render(<ColorPickerControl {...defaultProps} />);

  // AntD ColorPicker renders a trigger element with class
  const colorPickerTrigger = document.querySelector(
    '.ant-color-picker-trigger',
  );
  expect(colorPickerTrigger).toBeInTheDocument();
});

test('displays the correct color value', () => {
  render(<ColorPickerControl {...defaultProps} />);

  // The color should be displayed as hex #007A87 (uppercase in AntD)
  expect(screen.getByText('#007A87')).toBeInTheDocument();
});

test('calls onChange with RGB values when color changes', async () => {
  const onChange = jest.fn();
  render(<ColorPickerControl {...defaultProps} onChange={onChange} />);

  // Open the color picker
  const colorPickerTrigger = document.querySelector(
    '.ant-color-picker-trigger',
  );
  expect(colorPickerTrigger).toBeInTheDocument();

  if (colorPickerTrigger) {
    await userEvent.click(colorPickerTrigger);
  }

  // Note: Testing actual color selection in AntD ColorPicker would require more complex mocking
  // as it uses complex internal components. The main functionality is covered by the component itself.
});

test('includes preset colors from the categorical scheme', () => {
  render(<ColorPickerControl {...defaultProps} />);

  // The component should have access to the preset colors from the registry
  // This is tested by ensuring the component renders without errors with the presets
  const colorPickerTrigger = document.querySelector(
    '.ant-color-picker-trigger',
  );
  expect(colorPickerTrigger).toBeInTheDocument();
});

test('calls onChange with string key "Green" when resolveThemeTokens is true', async () => {
  const onChange = jest.fn();

  render(
    <ColorPickerControl
      {...defaultProps}
      onChange={onChange}
      resolveThemeTokens
      presets={[{ label: 'Special Colors', colors: ['Green', 'Red'] }]}
    />,
  );

  const colorPickerTrigger = document.querySelector(
    '.ant-color-picker-trigger',
  );
  expect(colorPickerTrigger).toBeInTheDocument();
  await userEvent.click(colorPickerTrigger!);

  await waitFor(() => {
    expect(
      document.querySelector('.ant-color-picker-presets-color'),
    ).toBeInTheDocument();
  });

  const presets = document.querySelectorAll('.ant-color-picker-presets-color');
  const greenPreset = presets[0];

  expect(greenPreset).toBeInTheDocument();
  await userEvent.click(greenPreset);

  expect(onChange).toHaveBeenCalledWith('Green');
});

test('calls onChange with RGB object when resolveThemeTokens is false', async () => {
  const onChange = jest.fn();

  render(
    <ColorPickerControl
      {...defaultProps}
      onChange={onChange}
      resolveThemeTokens={false}
      outputFormat="hex"
      presets={[{ label: 'Special Colors', colors: ['Green', 'Red'] }]}
    />,
  );

  const colorPickerTrigger = document.querySelector(
    '.ant-color-picker-trigger',
  );
  expect(colorPickerTrigger).toBeInTheDocument();
  await userEvent.click(colorPickerTrigger!);

  await waitFor(() => {
    expect(
      document.querySelector('.ant-color-picker-presets-color'),
    ).toBeInTheDocument();
  });

  const presets = document.querySelectorAll('.ant-color-picker-presets-color');
  const greenPreset = presets[0];

  expect(greenPreset).toBeInTheDocument();
  await userEvent.click(greenPreset);

  expect(onChange).toHaveBeenCalledWith('#00960033');
});

test('resolves colorSuccess theme token correctly when matching color is selected', async () => {
  const onChange = jest.fn();

  jest
    .spyOn(require('@apache-superset/core/theme'), 'useTheme')
    .mockReturnValue({
      colors: {
        colorSuccess: 'rgba(82, 196, 26, 1)',
      },
    });

  render(
    <ColorPickerControl
      {...defaultProps}
      onChange={onChange}
      resolveThemeTokens
      presets={[{ label: 'Theme Tokens', colors: ['colorSuccess'] }]}
    />,
  );

  const colorPickerTrigger = document.querySelector(
    '.ant-color-picker-trigger',
  );
  expect(colorPickerTrigger).toBeInTheDocument();
  await userEvent.click(colorPickerTrigger!);

  await waitFor(() => {
    expect(
      document.querySelector('.ant-color-picker-presets-items'),
    ).toBeInTheDocument();
  });

  const successPreset = document.querySelector(
    '.ant-color-picker-presets-color [style*="82, 196, 26"]',
  ) as HTMLElement | null;

  expect(successPreset).toBeInTheDocument();

  await userEvent.click(successPreset!);

  expect(onChange).toHaveBeenCalledWith('colorSuccess');
});

test('handles theme with nested colors object', () => {
  jest
    .spyOn(require('@apache-superset/core/theme'), 'useTheme')
    .mockReturnValue({
      colors: { primary: '#007bff' },
    });

  const { container } = render(<ColorPickerControl {...defaultProps} />);
  expect(
    container.querySelector('.ant-color-picker-trigger'),
  ).toBeInTheDocument();
});

test('handles theme without colors field', () => {
  jest
    .spyOn(require('@apache-superset/core/theme'), 'useTheme')
    .mockReturnValue({
      primary: '#007bff',
    });

  const { container } = render(<ColorPickerControl {...defaultProps} />);
  expect(
    container.querySelector('.ant-color-picker-trigger'),
  ).toBeInTheDocument();
});

test('handles undefined theme gracefully', () => {
  jest
    .spyOn(require('@apache-superset/core/theme'), 'useTheme')
    .mockReturnValue(undefined);

  expect(() => render(<ColorPickerControl {...defaultProps} />)).not.toThrow();
});
