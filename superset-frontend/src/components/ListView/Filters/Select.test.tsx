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
import { render, selectOption, waitFor } from 'spec/helpers/testing-library';
import { ListViewFilterOperator } from '../types';
import UIFilters from './index';

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
    expect(mockUpdateFilterValue).toHaveBeenCalledWith({
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
    expect(mockUpdateFilterValue).toHaveBeenCalledWith({
      label: '123',
      value: 123,
    });
  });
});
