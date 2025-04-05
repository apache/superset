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
import IndeterminateCheckbox, { IndeterminateCheckboxProps } from '.';

const mockedProps: IndeterminateCheckboxProps = {
  checked: false,
  id: 'checkbox-id',
  indeterminate: false,
  title: 'Checkbox title',
  labelText: 'Checkbox Label',
  onChange: jest.fn(),
};

const asyncRender = (props = mockedProps) =>
  waitFor(() => render(<IndeterminateCheckbox {...props} />));

test('should render', async () => {
  const { container } = await asyncRender();
  expect(container).toBeInTheDocument();
});

test('should render the label', async () => {
  await asyncRender();
  expect(screen.getByText('Checkbox Label')).toBeInTheDocument();
});

test('should render the checkbox', async () => {
  await asyncRender();
  expect(screen.getByRole('checkbox')).toBeInTheDocument();
});

test('should render as indeterminate when indeterminate is true', async () => {
  const indeterminateProps = { ...mockedProps, indeterminate: true };
  await asyncRender(indeterminateProps);
  const checkbox = screen.getByRole('checkbox');

  expect(checkbox).toBeInTheDocument();
  expect((checkbox as HTMLInputElement).indeterminate).toBe(true);
});

test('should render as checked when checked is true', async () => {
  const checkedProps = { ...mockedProps, checked: true };
  await asyncRender(checkedProps);
  const checkbox = screen.getByRole('checkbox');
  expect(checkbox).toBeChecked();
});

test('should call the onChange handler when clicked', async () => {
  await asyncRender();
  const checkbox = screen.getByRole('checkbox');
  await userEvent.click(checkbox);
  expect(mockedProps.onChange).toHaveBeenCalledTimes(1);
});
