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
import type { ControlProps } from '@jsonforms/core';
import { render, screen, userEvent } from 'spec/helpers/testing-library';

import { MultiEnumControl } from './jsonFormsHelpers';

const baseProps = (overrides: Partial<ControlProps> = {}): ControlProps =>
  ({
    label: 'Tags',
    path: 'tags',
    enabled: true,
    schema: {
      type: 'array',
      items: {
        enum: ['a', 'b', 'c'],
        'x-enumNames': ['Apple', 'Banana', 'Cherry'],
      },
    },
    uischema: { type: 'Control', scope: '#/properties/tags', options: {} },
    data: [],
    handleChange: jest.fn(),
    config: {},
    ...overrides,
  }) as unknown as ControlProps;

test('renders enum labels from items.x-enumNames', async () => {
  render(<MultiEnumControl {...baseProps()} />);
  await userEvent.click(screen.getByRole('combobox'));
  expect(await screen.findByText('Apple')).toBeInTheDocument();
  expect(screen.getByText('Banana')).toBeInTheDocument();
  expect(screen.getByText('Cherry')).toBeInTheDocument();
});

test('falls back to raw enum values when x-enumNames is absent', async () => {
  const props = baseProps({
    schema: { type: 'array', items: { enum: ['red', 'green'] } },
  });
  const { container } = render(<MultiEnumControl {...props} />);
  await userEvent.click(screen.getByRole('combobox'));
  await screen.findAllByText('red');
  const options = container.ownerDocument.querySelectorAll(
    '.ant-select-item-option-content',
  );
  expect(Array.from(options).map(el => el.textContent)).toEqual([
    'red',
    'green',
  ]);
});

test('emits the new array via handleChange when an option is picked', async () => {
  const handleChange = jest.fn();
  render(<MultiEnumControl {...baseProps({ handleChange })} />);
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByText('Banana'));
  expect(handleChange).toHaveBeenLastCalledWith('tags', ['b']);
});

test('renders existing data as selected tags using x-enumNames labels', () => {
  render(<MultiEnumControl {...baseProps({ data: ['a', 'c'] })} />);
  // Selected items render in a hidden listbox with role=option,
  // but the tag text is the user-visible label.
  expect(screen.getByText('Apple')).toBeInTheDocument();
  expect(screen.getByText('Cherry')).toBeInTheDocument();
  expect(screen.queryByText('Banana')).not.toBeInTheDocument();
});

test('shows a loading state when config.refreshingSchema is true', () => {
  const { container } = render(
    <MultiEnumControl {...baseProps({ config: { refreshingSchema: true } })} />,
  );
  expect(container.querySelector('.ant-select-arrow-loading')).toBeTruthy();
});

test('treats non-array data as an empty selection without crashing', () => {
  render(<MultiEnumControl {...baseProps({ data: undefined })} />);
  // No tags rendered when data is missing
  expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  expect(screen.queryByText('Banana')).not.toBeInTheDocument();
});
