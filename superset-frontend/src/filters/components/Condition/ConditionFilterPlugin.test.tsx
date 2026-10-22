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
import { AppSection, type ChartProps } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import ConditionFilterPlugin from './ConditionFilterPlugin';
import transformProps from './transformProps';
import { ConditionValue, PluginFilterConditionProps } from './types';

const setDataMask = jest.fn();

const getProps = (
  value: ConditionValue | null = null,
  formData: Record<string, unknown> = {},
  coltype = GenericDataType.String,
) =>
  transformProps({
    formData: {
      datasource: '3__table',
      groupby: ['country'],
      vizType: 'filter_condition',
      nativeFilterId: 'NATIVE_FILTER-1',
      ...formData,
    },
    height: 20,
    width: 220,
    hooks: { setDataMask },
    filterState: { value },
    queriesData: [
      {
        rowcount: 2,
        colnames: ['country'],
        coltypes: [coltype],
        data: [{ country: 'CA' }, { country: 'US' }],
        applied_filters: [],
        rejected_filters: [],
      },
    ],
    behaviors: ['NATIVE_FILTER'],
    appSection: AppSection.Dashboard,
  } as unknown as ChartProps) as unknown as PluginFilterConditionProps;

const lastDataMask = () => setDataMask.mock.calls.at(-1)?.[0];

beforeEach(() => {
  setDataMask.mockClear();
});

test('applies a restored value on mount', async () => {
  render(<ConditionFilterPlugin {...getProps({ op: 'IS NULL' })} />);
  await waitFor(() =>
    expect(lastDataMask()).toEqual({
      extraFormData: { filters: [{ col: 'country', op: 'IS NULL' }] },
      filterState: {
        value: { op: 'IS NULL' },
        label: 'country IS NULL',
        validateStatus: undefined,
      },
    }),
  );
});

test('applies the default value when the filter state was never set', async () => {
  const props = getProps(null, { defaultValue: { op: '==', val: 'CA' } });
  render(<ConditionFilterPlugin {...props} filterState={{}} />);
  await waitFor(() =>
    expect(lastDataMask()).toEqual({
      extraFormData: { filters: [{ col: 'country', op: '==', val: 'CA' }] },
      filterState: {
        value: { op: '==', val: 'CA' },
        label: 'country == CA',
        validateStatus: undefined,
      },
    }),
  );
});

test('hides the value input for unary operators', () => {
  render(<ConditionFilterPlugin {...getProps({ op: 'IS NOT NULL' })} />);
  expect(
    screen.queryByTestId('condition-filter-value-input'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('condition-filter-value-select'),
  ).not.toBeInTheDocument();
});

test('typing a comparison value emits a numeric clause', async () => {
  render(
    <ConditionFilterPlugin
      {...getProps({ op: '>' }, {}, GenericDataType.Numeric)}
    />,
  );
  await userEvent.type(screen.getByLabelText('Condition value'), '100');
  expect(lastDataMask().extraFormData).toEqual({
    filters: [{ col: 'country', op: '>', val: 100 }],
  });
  expect(lastDataMask().filterState.label).toBe('country > 100');
});

test('clearing the value removes the filter', async () => {
  render(<ConditionFilterPlugin {...getProps({ op: 'LIKE', val: 'C%' })} />);
  await userEvent.clear(screen.getByLabelText('Condition value'));
  expect(lastDataMask()).toEqual({
    extraFormData: {},
    filterState: { value: null, label: '', validateStatus: undefined },
  });
});

test('reports an error when a required condition is empty', async () => {
  render(
    <ConditionFilterPlugin
      {...getProps({ op: 'LIKE', val: 'C%' }, { enableEmptyFilter: true })}
    />,
  );
  await userEvent.clear(screen.getByLabelText('Condition value'));
  expect(lastDataMask().filterState).toEqual(
    expect.objectContaining({ value: null, validateStatus: 'error' }),
  );
});

test('switching to IN keeps the current value as a list', async () => {
  render(<ConditionFilterPlugin {...getProps({ op: '==', val: 'CA' })} />);
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Condition operator' }),
  );
  await userEvent.click(await screen.findByTitle('IN'));
  expect(lastDataMask().extraFormData).toEqual({
    filters: [{ col: 'country', op: 'IN', val: ['CA'] }],
  });
});

test('suggests distinct column values for equality operators', async () => {
  render(<ConditionFilterPlugin {...getProps({ op: '==' })} />);
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Condition value' }),
  );
  expect(await screen.findByTitle('CA')).toBeInTheDocument();
  expect(screen.getByTitle('US')).toBeInTheDocument();
});

test('only offers operators that fit the column type', async () => {
  render(
    <ConditionFilterPlugin
      {...getProps({ op: '==' }, {}, GenericDataType.Boolean)}
    />,
  );
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Condition operator' }),
  );
  expect(await screen.findByTitle('IS NULL')).toBeInTheDocument();
  expect(screen.queryByTitle('LIKE')).not.toBeInTheDocument();
  expect(screen.queryByTitle('>')).not.toBeInTheDocument();
});

test('does not apply a saved condition that no longer fits the column type', async () => {
  // e.g. the column changed from text to numeric after the filter was saved
  render(
    <ConditionFilterPlugin
      {...getProps({ op: 'LIKE', val: 'C%' }, {}, GenericDataType.Numeric)}
    />,
  );
  await waitFor(() =>
    expect(lastDataMask()).toEqual({
      extraFormData: {},
      filterState: { value: null, label: '', validateStatus: undefined },
    }),
  );
  expect(
    screen.getByText('LIKE is not supported for this column type'),
  ).toBeInTheDocument();
});

test('shows an error for a non-numeric value on a numeric column', async () => {
  render(
    <ConditionFilterPlugin
      {...getProps({ op: '>' }, {}, GenericDataType.Numeric)}
    />,
  );
  await userEvent.type(screen.getByLabelText('Condition value'), 'abc');
  expect(
    screen.getByText('This column is numeric. Please enter a number.'),
  ).toBeInTheDocument();
  expect(setDataMask).not.toHaveBeenCalled();
});

test('an invalid edit keeps the last valid condition', async () => {
  // Otherwise Apply would silently drop the price > 100 filter.
  render(
    <ConditionFilterPlugin
      {...getProps({ op: '>', val: 100 }, {}, GenericDataType.Numeric)}
    />,
  );
  await waitFor(() =>
    expect(lastDataMask().extraFormData).toEqual({
      filters: [{ col: 'country', op: '>', val: 100 }],
    }),
  );
  setDataMask.mockClear();
  await userEvent.type(screen.getByLabelText('Condition value'), 'x');
  expect(setDataMask).not.toHaveBeenCalled();
});

test('formats temporal values in the value picker', async () => {
  const props = getProps({ op: '==' }, {}, GenericDataType.Temporal);
  render(
    <ConditionFilterPlugin
      {...props}
      data={[{ country: Date.UTC(2024, 0, 15) }]}
    />,
  );
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Condition value' }),
  );
  expect(await screen.findByTitle('2024-01-15')).toBeInTheDocument();
});

test('"Clear all" resets input that was never sent to the dashboard', async () => {
  const onClearAllComplete = jest.fn();
  const props = getProps({ op: '>' }, {}, GenericDataType.Numeric);
  const { rerender } = render(
    <ConditionFilterPlugin
      {...props}
      onClearAllComplete={onClearAllComplete}
    />,
  );
  await userEvent.type(screen.getByLabelText('Condition value'), 'abc');
  expect(
    screen.getByText('This column is numeric. Please enter a number.'),
  ).toBeInTheDocument();

  rerender(
    <ConditionFilterPlugin
      {...props}
      clearAllTrigger
      onClearAllComplete={onClearAllComplete}
    />,
  );
  expect(screen.getByLabelText('Condition value')).toHaveValue('');
  expect(
    screen.queryByText('This column is numeric. Please enter a number.'),
  ).not.toBeInTheDocument();
  expect(onClearAllComplete).toHaveBeenCalledWith('NATIVE_FILTER-1');
});
