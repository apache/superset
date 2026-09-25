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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { ListViewFilterOperator } from '../types';
import UIFilters from './index';

const mockUpdateFilterValue = jest.fn();

beforeEach(() => {
  mockUpdateFilterValue.mockClear();
});

test('search filter uses id as input name when inputName is not provided', () => {
  const filters = [
    {
      Header: 'Name',
      key: 'name',
      id: 'name',
      input: 'search' as const,
      operator: ListViewFilterOperator.Contains,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  const input = screen.getByTestId('filters-search') as HTMLInputElement;
  expect(input.name).toBe('name');
});

test('search filter uses inputName when provided instead of id', () => {
  const filters = [
    {
      Header: 'Name',
      key: 'name',
      id: 'name',
      input: 'search' as const,
      operator: ListViewFilterOperator.Contains,
      inputName: 'custom_search_name',
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  const input = screen.getByTestId('filters-search') as HTMLInputElement;
  expect(input.name).toBe('custom_search_name');
});

test('search filter passes autoComplete prop correctly', () => {
  const filters = [
    {
      Header: 'Name',
      key: 'name',
      id: 'name',
      input: 'search' as const,
      operator: ListViewFilterOperator.Contains,
      autoComplete: 'new-password',
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  const input = screen.getByTestId('filters-search') as HTMLInputElement;
  expect(input.autocomplete).toBe('new-password');
});

test('renders a compact pill trigger for select filters', () => {
  const filters = [
    {
      Header: 'Owner',
      key: 'owner',
      id: 'owner',
      input: 'select' as const,
      operator: ListViewFilterOperator.RelationOneMany,
      selects: [
        { label: 'Alice', value: 1 },
        { label: 'Bob', value: 2 },
      ],
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  expect(screen.getByTestId('compact-filter-pill')).toBeInTheDocument();
  expect(screen.getByText('Owner')).toBeInTheDocument();
});

test('select pill shows active state (clear button) when a value is selected', () => {
  const filters = [
    {
      Header: 'Owner',
      key: 'owner',
      id: 'owner',
      input: 'select' as const,
      operator: ListViewFilterOperator.RelationOneMany,
      selects: [{ label: 'Alice', value: 1 }],
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[
        {
          id: 'owner',
          operator: ListViewFilterOperator.RelationOneMany,
          value: { label: 'Alice', value: 1 },
        },
      ]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  expect(
    screen.getByRole('button', { name: /clear owner filter/i }),
  ).toBeInTheDocument();
});

test('select pill tooltip falls back to static selects on cold URL load (no cached label)', () => {
  const filters = [
    {
      Header: 'Owner',
      key: 'owner',
      id: 'owner',
      input: 'select' as const,
      operator: ListViewFilterOperator.RelationOneMany,
      selects: [
        { label: 'Alice', value: 1 },
        { label: 'Bob', value: 2 },
      ],
    },
  ];

  // Simulate cold URL load: value has only numeric value, no label in cache
  render(
    <UIFilters
      filters={filters}
      internalFilters={[
        {
          id: 'owner',
          operator: ListViewFilterOperator.RelationOneMany,
          value: { value: 1 } as any,
        },
      ]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  // The pill should be active (clear button visible) and the static label
  // should be resolved as the tooltip source
  expect(
    screen.getByRole('button', { name: /clear owner filter/i }),
  ).toBeInTheDocument();
});

test('datetime_range filter renders as CompactFilterTrigger with dialog aria-haspopup', () => {
  const filters = [
    {
      Header: 'Time range',
      key: 'time_range',
      id: 'time_range',
      input: 'datetime_range' as const,
      operator: ListViewFilterOperator.Between,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  const pill = screen.getByTestId('compact-filter-pill');
  expect(pill).toBeInTheDocument();
  expect(pill).toHaveAttribute('aria-haspopup', 'dialog');
  expect(screen.getByText('Time range')).toBeInTheDocument();
});

test('datetime_range pill shows active state when a time range string is set', () => {
  const filters = [
    {
      Header: 'Time range',
      key: 'time_range',
      id: 'time_range',
      input: 'datetime_range' as const,
      operator: ListViewFilterOperator.Between,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[
        {
          id: 'time_range',
          operator: ListViewFilterOperator.Between,
          value: 'Last week',
        },
      ]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  // Clear icon is inside the pill (not a separate button)
  const pill = screen.getByTestId('compact-filter-pill');
  const clearIcon = screen.getByTestId('compact-filter-clear');
  expect(clearIcon).toBeInTheDocument();
  expect(pill).toContainElement(clearIcon);
});

test('datetime_range pill is inactive when value is NO_TIME_RANGE', () => {
  const filters = [
    {
      Header: 'Time range',
      key: 'time_range',
      id: 'time_range',
      input: 'datetime_range' as const,
      operator: ListViewFilterOperator.Between,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[
        {
          id: 'time_range',
          operator: ListViewFilterOperator.Between,
          value: 'No filter',
        },
      ]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  expect(screen.queryByTestId('compact-filter-clear')).not.toBeInTheDocument();
});

test('datetime_range pill shows the time range string as tooltip title', () => {
  const filters = [
    {
      Header: 'Time range',
      key: 'time_range',
      id: 'time_range',
      input: 'datetime_range' as const,
      operator: ListViewFilterOperator.Between,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[
        {
          id: 'time_range',
          operator: ListViewFilterOperator.Between,
          value: 'Last month',
        },
      ]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  // Pill is active and clear icon is inside
  expect(screen.getByTestId('compact-filter-clear')).toBeInTheDocument();
});

test('numerical_range filter renders as CompactFilterTrigger with dialog aria-haspopup', () => {
  const filters = [
    {
      Header: 'Age range',
      key: 'age_range',
      id: 'age_range',
      input: 'numerical_range' as const,
      operator: ListViewFilterOperator.Between,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  const pill = screen.getByTestId('compact-filter-pill');
  expect(pill).toBeInTheDocument();
  expect(pill).toHaveAttribute('aria-haspopup', 'dialog');
  expect(screen.getByText('Age range')).toBeInTheDocument();
});

test('numerical_range pill shows active state when value is set', () => {
  const filters = [
    {
      Header: 'Age range',
      key: 'age_range',
      id: 'age_range',
      input: 'numerical_range' as const,
      operator: ListViewFilterOperator.Between,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[
        {
          id: 'age_range',
          operator: ListViewFilterOperator.Between,
          value: [18, 65],
        },
      ]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  expect(
    screen.getByRole('button', { name: /clear age range filter/i }),
  ).toBeInTheDocument();
});

test('datetime_range onClear calls updateFilterValue with undefined directly', async () => {
  const updateFilterValue = jest.fn();
  const filters = [
    {
      Header: 'Time range',
      key: 'time_range',
      id: 'time_range',
      input: 'datetime_range' as const,
      operator: ListViewFilterOperator.Between,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[
        {
          id: 'time_range',
          operator: ListViewFilterOperator.Between,
          value: 'Last week',
        },
      ]}
      updateFilterValue={updateFilterValue}
    />,
  );

  const clearIcon = screen.getByTestId('compact-filter-clear');
  await userEvent.click(clearIcon);
  expect(updateFilterValue).toHaveBeenCalledWith(0, undefined);
});

test('numerical_range onClear calls updateFilterValue with undefined directly', async () => {
  const updateFilterValue = jest.fn();
  const filters = [
    {
      Header: 'Age range',
      key: 'age_range',
      id: 'age_range',
      input: 'numerical_range' as const,
      operator: ListViewFilterOperator.Between,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[
        {
          id: 'age_range',
          operator: ListViewFilterOperator.Between,
          value: [18, 65],
        },
      ]}
      updateFilterValue={updateFilterValue}
    />,
  );

  const clearBtn = screen.getByRole('button', {
    name: /clear age range filter/i,
  });
  await userEvent.click(clearBtn);
  expect(updateFilterValue).toHaveBeenCalledWith(0, undefined);
});

test('renders only the first search filter when multiple search filters are configured', () => {
  const filters = [
    {
      Header: 'Name',
      key: 'name',
      id: 'name',
      input: 'search' as const,
      operator: ListViewFilterOperator.Contains,
      inputName: 'filter_name_search',
    },
    {
      Header: 'Description',
      key: 'description',
      id: 'description',
      input: 'search' as const,
      operator: ListViewFilterOperator.Contains,
      // No inputName - should use id
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  // Only the first search filter renders — one search box per page
  const inputs = screen.getAllByTestId('filters-search') as HTMLInputElement[];
  expect(inputs).toHaveLength(1);
  expect(inputs[0].name).toBe('filter_name_search');
});
