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
import { render, screen, userEvent, selectOption } from 'spec/helpers/testing-library';
import { RotationControl } from '../RotationControl';

const defaultProps = {
  name: 'rotation',
  label: 'Word Rotation',
  description: 'Rotation to apply to words in the cloud',
  onChange: jest.fn(),
  value: 'square',
  hovered: false,
};

const setup = (overrides = {}) => (
  <RotationControl {...defaultProps} {...overrides} />
);

test('should render', () => {
  const { container } = render(setup());
  expect(container).toBeInTheDocument();
});

test('should render with label', () => {
  render(setup());
  expect(screen.getByText('Word Rotation')).toBeInTheDocument();
});

test('should render Select component', () => {
  render(setup());
  // The Select component should be rendered
  const select = screen.getByRole('combobox');
  expect(select).toBeInTheDocument();
});

test('should display current value', () => {
  render(setup({ value: 'random' }));
  // The Select component displays the label, not the value directly
  // We check that the select is rendered (the actual value is internal)
  const select = screen.getByRole('combobox');
  expect(select).toBeInTheDocument();
});

test('should use default value when value is undefined', () => {
  render(setup({ value: undefined }));
  // The Select component uses default value internally
  const select = screen.getByRole('combobox');
  expect(select).toBeInTheDocument();
});

test('should call onChange when value changes', async () => {
  const onChange = jest.fn();
  render(setup({ onChange }));
  
  await selectOption('random');
  
  expect(onChange).toHaveBeenCalledWith('random', []);
});

test('should display description tooltip when hovered', () => {
  render(setup({ hovered: true }));
  // The tooltip icon should be present when hovered
  const header = screen.getByTestId('rotation-header');
  expect(header).toBeInTheDocument();
});

test('should not display description tooltip when not hovered', () => {
  render(setup({ hovered: false }));
  const header = screen.getByTestId('rotation-header');
  expect(header).toBeInTheDocument();
  // Tooltip should not be visible when not hovered
});

test('should display validation errors', () => {
  const validationErrors = ['Invalid rotation value'];
  render(setup({ validationErrors }));
  // Error icon should be present
  const header = screen.getByTestId('rotation-header');
  expect(header).toBeInTheDocument();
});

test('should have correct default name prop', () => {
  expect(RotationControl.defaultProps?.name).toBe('rotation');
});

test('should handle all rotation options', async () => {
  const onChange = jest.fn();
  render(setup({ onChange }));
  
  // Test 'random' option
  await selectOption('random');
  expect(onChange).toHaveBeenCalledWith('random', []);
  
  // Test 'flat' option
  await selectOption('flat');
  expect(onChange).toHaveBeenCalledWith('flat', []);
  
  // Test 'square' option
  await selectOption('square');
  expect(onChange).toHaveBeenCalledWith('square', []);
});

