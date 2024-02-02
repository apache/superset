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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import IndeterminateCheckbox, { IndeterminateCheckboxProps } from '.';

const mockedProps: IndeterminateCheckboxProps = {
  checked: false,
  id: 'checkbox-id',
  indeterminate: false,
  title: 'Checkbox title',
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
  expect(screen.getByTitle('Checkbox title')).toBeInTheDocument();
});

test('should render the checkbox', async () => {
  await asyncRender();
  expect(screen.getByRole('checkbox')).toBeInTheDocument();
});

test('should render the checkbox-half icon', async () => {
  const indeterminateProps = {
    ...mockedProps,
    indeterminate: true,
  };
  await asyncRender(indeterminateProps);
  expect(screen.getByRole('img')).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute(
    'aria-label',
    'checkbox-half',
  );
});

test('should render the checkbox-off icon', async () => {
  await asyncRender();
  expect(screen.getByRole('img')).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'checkbox-off');
});

test('should render the checkbox-on icon', async () => {
  const checkboxOnProps = {
    ...mockedProps,
    checked: true,
  };
  await asyncRender(checkboxOnProps);
  expect(screen.getByRole('img')).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'checkbox-on');
});

test('should call the onChange', async () => {
  await asyncRender();
  const label = screen.getByTitle('Checkbox title');
  userEvent.click(label);
  expect(mockedProps.onChange).toHaveBeenCalledTimes(1);
});
