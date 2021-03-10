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

import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import IndeterminateCheckbox from '.';

test('Rendering correctly', () => {
  const props = {
    id: 'my-id',
    indeterminate: true,
    checked: true,
    onChange: jest.fn(),
  };

  render(<IndeterminateCheckbox {...props} />);

  expect(screen.getByTestId('CheckboxLabel')).toHaveAttribute('for', 'my-id');
  expect(screen.getByRole('checkbox')).toHaveAttribute('id', 'my-id');
  expect(screen.getByRole('checkbox')).toBeChecked();
});

test('calling onChange', () => {
  const props = {
    id: 'my-id',
    indeterminate: true,
    checked: false,
    onChange: jest.fn(),
  };

  render(<IndeterminateCheckbox {...props} />);

  expect(props.onChange).toBeCalledTimes(0);

  userEvent.click(screen.getByTestId('CheckboxLabel'));
  expect(props.onChange).toBeCalledTimes(1);

  userEvent.click(screen.getByRole('checkbox'));
  expect(props.onChange).toBeCalledTimes(2);
});

test('Should be a controlled component', () => {
  const props = {
    id: 'my-id',
    indeterminate: true,
    checked: false,
    onChange: jest.fn(),
  };

  const { rerender } = render(<IndeterminateCheckbox {...props} />);

  expect(screen.getByRole('checkbox')).not.toBeChecked();

  userEvent.click(screen.getByTestId('CheckboxLabel'));
  expect(screen.getByRole('checkbox')).not.toBeChecked();

  userEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('checkbox')).not.toBeChecked();

  rerender(<IndeterminateCheckbox {...{ ...props, checked: true }} />);
  expect(screen.getByRole('checkbox')).toBeChecked();
});
