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

import { RotationControl } from '../src/plugin/controls';
import { render, screen, userEvent } from 'spec/helpers/testing-library';

const setup = (props = {}) => {
  const defaultProps = {
    name: 'rotation',
    value: 'square',
    onChange: jest.fn(),
  };
  return render(<RotationControl {...defaultProps} {...props} />);
};

test('renders rotation control with label', () => {
  setup();
  expect(screen.getByText('Word Rotation')).toBeInTheDocument();
});

test('renders select with default value', () => {
  setup({ value: 'flat' });
  // Check that the select is rendered (implementation depends on Select component)
  expect(screen.getByRole('combobox')).toBeInTheDocument();
});

test('calls onChange when value changes', async () => {
  const onChange = jest.fn();
  setup({ onChange, value: 'square' });

  // Find the select input and open the dropdown
  const selectInput = screen.getByRole('combobox');

  await userEvent.click(selectInput);

  // Wait for and select a different option
  const flatOption = await screen.findByText('flat', { exact: false });
  await userEvent.click(flatOption);

  // Verify onChange was called with the string value
  expect(onChange).toHaveBeenCalledWith('flat');
  expect(onChange).toHaveBeenCalledTimes(1);
});
