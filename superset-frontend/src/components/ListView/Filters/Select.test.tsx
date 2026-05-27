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
import { createRef } from 'react';
import {
  render,
  screen,
  selectOption,
  waitFor,
} from 'spec/helpers/testing-library';
import { ListViewFilterOperator } from '../types';
import UIFilters from './index';
import SelectFilter from './Select';
import type { FilterHandler } from './types';

const mockUpdateFilterValue = jest.fn();

beforeEach(() => {
  mockUpdateFilterValue.mockClear();
});

test('select filter with ReactNode label uses option title when serializing selection', async () => {
  // Regression for sc-104554: the chart-list Owner filter renders options
  // with ReactNode labels (name + email). The value passed to
  // updateFilterValue is serialized into URL / filter state and re-used to
  // render the filter pill on return. It must carry the plain-text name
  // (from `title`) and not fall back to the numeric user id.
  const ReactNodeLabel = (
    <div>
      <span>John Doe</span>
      <span>john@example.com</span>
    </div>
  );

  const fetchSelects = jest.fn().mockResolvedValue({
    data: [
      {
        label: ReactNodeLabel,
        value: 42,
        title: 'John Doe',
      },
    ],
    totalCount: 1,
  });

  const filters = [
    {
      Header: 'Owner',
      key: 'owner',
      id: 'owners',
      input: 'select' as const,
      operator: ListViewFilterOperator.RelationManyMany,
      unfilteredLabel: 'All',
      fetchSelects,
      paginate: true,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  await selectOption('John Doe', 'Owner');

  await waitFor(() => {
    expect(mockUpdateFilterValue).toHaveBeenCalledWith(0, {
      label: 'John Doe',
      value: 42,
    });
  });
});

test('select filter falls back to stringified value when no string label or title is available', async () => {
  const fetchSelects = jest.fn().mockResolvedValue({
    data: [
      {
        label: <span>123</span>,
        value: 123,
      },
    ],
    totalCount: 1,
  });

  const filters = [
    {
      Header: 'Something',
      key: 'something',
      id: 'something',
      input: 'select' as const,
      operator: ListViewFilterOperator.RelationOneMany,
      unfilteredLabel: 'All',
      fetchSelects,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  await selectOption('123', 'Something');

  await waitFor(() => {
    expect(mockUpdateFilterValue).toHaveBeenCalledWith(0, {
      label: '123',
      value: 123,
    });
  });
});

test('plain select with string label passes label through unchanged', async () => {
  // Happy-path coverage for the typeof-string branch in onChange, exercised
  // through the non-async Select wrapper (selects array, no fetchSelects).
  const filters = [
    {
      Header: 'Status',
      key: 'status',
      id: 'status',
      input: 'select' as const,
      operator: ListViewFilterOperator.Equals,
      unfilteredLabel: 'All',
      selects: [
        { label: 'Published', value: 7 },
        { label: 'Draft', value: 8 },
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

  await selectOption('Published', 'Status');

  await waitFor(() => {
    expect(mockUpdateFilterValue).toHaveBeenCalledWith(0, {
      label: 'Published',
      value: 7,
    });
  });
});

test('plain select with ReactNode label uses option title when serializing selection', async () => {
  // Parallel coverage to the AsyncSelect ReactNode-with-title test, against
  // the non-async Select wrapper. Guards against the two wrappers ever
  // diverging on antd's two-arg onChange shape.
  const ReactNodeLabel = (
    <div>
      <span>Jane Roe</span>
      <span>jane@example.com</span>
    </div>
  );

  const filters = [
    {
      Header: 'Owner',
      key: 'owner',
      id: 'owners',
      input: 'select' as const,
      operator: ListViewFilterOperator.RelationManyMany,
      unfilteredLabel: 'All',
      selects: [{ label: ReactNodeLabel, value: 99, title: 'Jane Roe' }],
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  await selectOption('Jane Roe', 'Owner');

  await waitFor(() => {
    expect(mockUpdateFilterValue).toHaveBeenCalledWith(0, {
      label: 'Jane Roe',
      value: 99,
    });
  });
});

test('clearFilter notifies onSelect with undefined and isClear=true', () => {
  // The isClear flag is what allows the parent (Filters/index) to suppress
  // onFilterUpdate side-effects when the user clears the filter rather than
  // picking a new value. Lock that contract in.
  const mockOnSelect = jest.fn();
  const ref = createRef<FilterHandler>();

  render(
    <SelectFilter
      Header="Owner"
      initialValue={{ label: 'John Doe', value: 42 }}
      onSelect={mockOnSelect}
      selects={[{ label: 'John Doe', value: 42, title: 'John Doe' }]}
      ref={ref}
    />,
  );

  ref.current?.clearFilter();

  expect(mockOnSelect).toHaveBeenCalledWith(undefined, true);
});

test('rehydrates filter pill from initialValue with plain-string label', async () => {
  // The user-visible regression: after URL/state rehydration the filter pill
  // must render the human-readable name, not the numeric user id. The fix
  // ensures the persisted label is a string; this test asserts that string
  // is what surfaces in the rendered combobox selection.
  const filters = [
    {
      Header: 'Owner',
      key: 'owner',
      id: 'owners',
      input: 'select' as const,
      operator: ListViewFilterOperator.RelationManyMany,
      unfilteredLabel: 'All',
      fetchSelects: jest.fn().mockResolvedValue({ data: [], totalCount: 0 }),
      paginate: true,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[
        {
          id: 'owners',
          operator: ListViewFilterOperator.RelationManyMany,
          value: { label: 'John Doe', value: 42 },
        },
      ]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
