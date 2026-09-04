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
import { render, screen, userEvent } from 'spec/helpers/testing-library';

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

  userEvent.click(selectInput);

  // Wait for and select a different color scheme
  // The scheme name should be visible in the dropdown
  const newSchemeOption = await screen.findByText(newScheme, { exact: false });
  userEvent.click(newSchemeOption);

  // Verify onChange was called with the new scheme value
  expect(onChange).toHaveBeenCalledWith(newScheme);
  expect(onChange).toHaveBeenCalledTimes(1);
});
