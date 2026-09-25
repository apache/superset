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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';

import { MAX_TAG_COUNT } from '@superset-ui/core/components';

import { DynamicFieldControl, MultiEnumControl } from './jsonFormsHelpers';
import {
  LARGE_CATALOG_SIZE,
  largeMetricEnum,
  largeMultiEnumFieldSchema,
  duplicateLabelEnumSchema,
} from './testFixtures';

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
  // The wrapped Select alphabetises options by label.
  expect(Array.from(options).map(el => el.textContent)).toEqual([
    'green',
    'red',
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
  // The wrapped Select renders loading as a Spin suffix icon.
  expect(container.querySelector('.ant-spin')).toBeTruthy();
});

test('treats non-array data as an empty selection without crashing', () => {
  render(<MultiEnumControl {...baseProps({ data: undefined })} />);
  // No tags rendered when data is missing
  expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  expect(screen.queryByText('Banana')).not.toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Large-catalog regression tests (sc-107832). The wrapped Select virtualizes
// its dropdown above 20 options, so interactions go through search-then-click
// or prop-driven values — never option-DOM counting.
// ---------------------------------------------------------------------------

test('caps rendered tags at large selection counts while keeping the full value', () => {
  const { container } = render(
    <MultiEnumControl
      {...baseProps({
        schema: largeMultiEnumFieldSchema,
        data: largeMetricEnum,
      })}
    />,
  );
  const tags = container.querySelectorAll('.ant-select-selection-item');
  // Exactly MAX_TAG_COUNT tags plus one overflow summary tag — never one
  // per selection. The cap comes from the wrapped Select's exported default.
  expect(tags.length).toBe(MAX_TAG_COUNT + 1);
  const overflow = Array.from(tags).find(el =>
    /\+\s*\d+/.test(el.textContent ?? ''),
  );
  expect(overflow?.textContent).toMatch(
    new RegExp(`\\+\\s*${LARGE_CATALOG_SIZE - MAX_TAG_COUNT}`),
  );
});

test('propagates the full selection array when adding to a large selection', async () => {
  const handleChange = jest.fn();
  const allButOne = largeMetricEnum.slice(0, LARGE_CATALOG_SIZE - 1);
  render(
    <MultiEnumControl
      {...baseProps({
        schema: largeMultiEnumFieldSchema,
        data: allButOne,
        handleChange,
      })}
    />,
  );
  const combobox = screen.getByRole('combobox');
  await userEvent.click(combobox);
  // Search-then-click: virtualization renders only a window of options.
  await userEvent.type(combobox, 'metric_499');
  const option = await waitFor(() => {
    const el = Array.from(
      document.querySelectorAll('.ant-select-item-option'),
    ).find(e => e.getAttribute('title') === 'metric_499');
    if (!el) throw new Error('option not rendered yet');
    return el;
  });
  await userEvent.click(option);
  // Assert the exact resulting set, not just length + the new member: a
  // component that dropped an existing selection while adding a new one
  // could otherwise still satisfy a length check.
  const lastValue = handleChange.mock.calls.at(-1)?.[1] as string[];
  expect(lastValue).toHaveLength(LARGE_CATALOG_SIZE);
  expect([...lastValue].sort()).toEqual([...largeMetricEnum].sort());
});

test('does not render a Select-all bulk affordance', async () => {
  render(
    <MultiEnumControl
      {...baseProps({ schema: largeMultiEnumFieldSchema, data: [] })}
    />,
  );
  await userEvent.click(screen.getByRole('combobox'));
  expect(screen.queryByText(/Select all/i)).not.toBeInTheDocument();
});

test('keeps duplicated display labels individually selectable', async () => {
  const handleChange = jest.fn();
  render(
    <MultiEnumControl
      {...baseProps({ schema: duplicateLabelEnumSchema, handleChange })}
    />,
  );
  const combobox = screen.getByRole('combobox');
  await userEvent.click(combobox);
  const revenues = await screen.findAllByText('Revenue');
  expect(revenues.length).toBeGreaterThanOrEqual(2);
  await userEvent.click(revenues[0]);
  expect(handleChange).toHaveBeenLastCalledWith('tags', ['metric_a_v1']);
});

test('DynamicFieldControl handles a 500-option enum via search (FR-006 sibling)', async () => {
  const handleChange = jest.fn();
  const props = baseProps({
    handleChange,
    path: 'mode',
    schema: {
      type: 'string',
      enum: largeMetricEnum,
      'x-dynamic': true,
      'x-dependsOn': [],
    } as ControlProps['schema'],
    data: undefined,
  });
  render(<DynamicFieldControl {...props} />);
  const combobox = screen.getByRole('combobox');
  await userEvent.click(combobox);
  await userEvent.type(combobox, 'metric_042');
  const option = await waitFor(() => {
    const el = Array.from(
      document.querySelectorAll('.ant-select-item-option'),
    ).find(e => e.getAttribute('title') === 'metric_042');
    if (!el) throw new Error('option not rendered yet');
    return el;
  });
  await userEvent.click(option);
  expect(handleChange).toHaveBeenLastCalledWith('mode', 'metric_042');
});

test('renders options alphabetically for an unsorted backend enum', async () => {
  // The renderers dropped their manual sort because the wrapped Select
  // alphabetises by label; pin that inherited behaviour here so a future
  // change to the shared component surfaces in this feature's suite.
  const props = baseProps({
    schema: { type: 'array', items: { enum: ['zebra', 'apple', 'mango'] } },
  });
  const { container } = render(<MultiEnumControl {...props} />);
  await userEvent.click(screen.getByRole('combobox'));
  await screen.findAllByText('apple');
  const labels = Array.from(
    container.ownerDocument.querySelectorAll('.ant-select-item-option-content'),
  ).map(el => el.textContent);
  expect(labels).toEqual(['apple', 'mango', 'zebra']);
});
