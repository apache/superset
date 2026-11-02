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

import { ColorSchemeControl } from '../src/plugin/controls';
import {
  CategoricalD3,
  CategoricalModernSunset,
  getCategoricalSchemeRegistry,
} from '@superset-ui/core';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';

const setup = (props = {}) => {
  const defaultProps = {
    name: 'color_scheme',
    value: '',
    onChange: jest.fn(),
  };
  return render(<ColorSchemeControl {...defaultProps} {...props} />);
};

test('renders color scheme control', () => {
  setup();
  // The Select component has an aria-label - use role to find the input specifically
  expect(
    screen.getByRole('combobox', { name: 'Select color scheme' }),
  ).toBeInTheDocument();
});

test('renders select with value', () => {
  // Get a color scheme from the registry to use as a test value
  const { getCategoricalSchemeRegistry } = require('@superset-ui/core');
  const registry = getCategoricalSchemeRegistry();
  const firstScheme = registry.keys()[0];

  setup({ value: firstScheme });
  // Use role to find the input specifically
  const select = screen.getByRole('combobox', { name: 'Select color scheme' });
  expect(select).toBeInTheDocument();
});

test('calls onChange when value changes', async () => {
  const onChange = jest.fn();
  const { getCategoricalSchemeRegistry } = require('@superset-ui/core');
  const registry = getCategoricalSchemeRegistry();
  const schemes = registry.keys();

  if (schemes.length < 2) {
    // Skip if there aren't enough schemes to test
    return;
  }

  const initialScheme = schemes[0];
  const newScheme = schemes[1];

  setup({ onChange, value: initialScheme });

  // Find the select input using role
  const selectInput = screen.getByRole('combobox', {
    name: 'Select color scheme',
  });

  await userEvent.click(selectInput);

  // Wait for and select a different color scheme
  // The scheme name should be visible in the dropdown
  const newSchemeOption = await screen.findByText(newScheme, { exact: false });
  await userEvent.click(newSchemeOption);

  // Verify onChange was called with the new scheme value
  expect(onChange).toHaveBeenCalledWith(newScheme);
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('portals the grouped palette popup outside the control with styles on its root', async () => {
  const registry = getCategoricalSchemeRegistry();
  [...CategoricalD3, ...CategoricalModernSunset].forEach(scheme =>
    registry.registerValue(scheme.id, scheme),
  );
  const { container } = setup({
    choices: registry.keys().map(s => [s, s]),
    schemes: registry.getMap(),
    clearable: true,
  });
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Select color scheme' }),
  );
  await waitFor(() => {
    expect(screen.getByText('Featured color palettes')).toBeInTheDocument();
  });
  const popup = document.querySelector('.ant-select-dropdown')!;
  expect(container.contains(popup)).toBe(false);
  expect(document.body.contains(popup)).toBe(true);
  const emotionClass = Array.from(popup.classList).find(cls =>
    /^(superset|css)-(?!dev-only|var)/.test(cls),
  );
  expect(emotionClass).toBeDefined();
  const styleText = Array.from(document.styleSheets)
    .flatMap(sheet => Array.from(sheet.cssRules).map(rule => rule.cssText))
    .join('\n');
  expect(styleText).toContain(
    `.${emotionClass} .ant-select-item-option-grouped`,
  );
  registry.clear();
});
