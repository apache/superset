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
import '@testing-library/jest-dom';
import { render, screen, userEvent } from '@superset-ui/core/spec';
import { GenericDataType } from '@apache-superset/core/api/core';
import GroupingHeaders from './index';
import { DataColumnMeta } from '../../../types';

const mockColumnsMeta: DataColumnMeta[] = [
  {
    key: 'name',
    label: 'Current',
    dataType: GenericDataType.String,
  },
  {
    key: 'name__previous_year',
    label: 'Previous year',
    dataType: GenericDataType.String,
    originalLabel: 'Revenue',
  },
  {
    key: 'name__previous_month',
    label: 'Previous month',
    dataType: GenericDataType.String,
    originalLabel: 'Revenue',
  },
];

const mockFilteredColumnsMeta: DataColumnMeta[] = mockColumnsMeta;

const mockGroupHeaderColumns = {
  __previous_year: [1],
  __previous_month: [2],
};

test('renders table row with grouping headers', () => {
  const onHideComparisonKeysChange = jest.fn();
  const { container } = render(
    <table>
      <thead>
        <GroupingHeaders
          groupHeaderColumns={mockGroupHeaderColumns}
          filteredColumnsMeta={mockFilteredColumnsMeta}
          columnsMeta={mockColumnsMeta}
          hideComparisonKeys={[]}
          onHideComparisonKeysChange={onHideComparisonKeysChange}
        />
      </thead>
    </table>,
  );

  const tr = container.querySelector('tr.grouping-headers');
  expect(tr).toHaveClass('grouping-headers');
  expect(tr?.querySelectorAll('th').length).toBeGreaterThan(0);
});

test('renders headers with correct labels', () => {
  const onHideComparisonKeysChange = jest.fn();
  render(
    <table>
      <thead>
        <GroupingHeaders
          groupHeaderColumns={mockGroupHeaderColumns}
          filteredColumnsMeta={mockFilteredColumnsMeta}
          columnsMeta={mockColumnsMeta}
          hideComparisonKeys={[]}
          onHideComparisonKeysChange={onHideComparisonKeysChange}
        />
      </thead>
    </table>,
  );

  const revenueHeaders = screen.getAllByText('Revenue');
  expect(revenueHeaders.length).toBeGreaterThan(0);
});

test('renders placeholder headers before grouped headers', () => {
  const onHideComparisonKeysChange = jest.fn();
  const { container } = render(
    <table>
      <thead>
        <GroupingHeaders
          groupHeaderColumns={mockGroupHeaderColumns}
          filteredColumnsMeta={mockFilteredColumnsMeta}
          columnsMeta={mockColumnsMeta}
          hideComparisonKeys={[]}
          onHideComparisonKeysChange={onHideComparisonKeysChange}
        />
      </thead>
    </table>,
  );

  const placeholders = container.querySelectorAll('th[aria-label^="Header-"]');
  expect(placeholders.length).toBeGreaterThan(0);
});

test('shows minus icon when column group is not hidden', () => {
  const onHideComparisonKeysChange = jest.fn();
  const { container } = render(
    <table>
      <thead>
        <GroupingHeaders
          groupHeaderColumns={mockGroupHeaderColumns}
          filteredColumnsMeta={mockFilteredColumnsMeta}
          columnsMeta={mockColumnsMeta}
          hideComparisonKeys={[]}
          onHideComparisonKeysChange={onHideComparisonKeysChange}
        />
      </thead>
    </table>,
  );

  const minusIcons = container.querySelectorAll('.anticon-minus-circle');
  expect(minusIcons.length).toBeGreaterThan(0);
});

test('shows plus icon when column group is hidden', () => {
  const onHideComparisonKeysChange = jest.fn();
  const { container } = render(
    <table>
      <thead>
        <GroupingHeaders
          groupHeaderColumns={mockGroupHeaderColumns}
          filteredColumnsMeta={mockFilteredColumnsMeta}
          columnsMeta={mockColumnsMeta}
          hideComparisonKeys={['__previous_year']}
          onHideComparisonKeysChange={onHideComparisonKeysChange}
        />
      </thead>
    </table>,
  );

  const plusIcons = container.querySelectorAll('.anticon-plus-circle');
  expect(plusIcons.length).toBeGreaterThan(0);
});

test('calls onHideComparisonKeysChange to hide column when minus icon is clicked', () => {
  const onHideComparisonKeysChange = jest.fn();
  const { container } = render(
    <table>
      <thead>
        <GroupingHeaders
          groupHeaderColumns={mockGroupHeaderColumns}
          filteredColumnsMeta={mockFilteredColumnsMeta}
          columnsMeta={mockColumnsMeta}
          hideComparisonKeys={[]}
          onHideComparisonKeysChange={onHideComparisonKeysChange}
        />
      </thead>
    </table>,
  );

  const minusIcon = container.querySelector('.anticon-minus-circle');
  expect(minusIcon).toBeTruthy();
  userEvent.click(minusIcon!);
  expect(onHideComparisonKeysChange).toHaveBeenCalled();
});

test('calls onHideComparisonKeysChange to show column when plus icon is clicked', () => {
  const onHideComparisonKeysChange = jest.fn();
  const { container } = render(
    <table>
      <thead>
        <GroupingHeaders
          groupHeaderColumns={mockGroupHeaderColumns}
          filteredColumnsMeta={mockFilteredColumnsMeta}
          columnsMeta={mockColumnsMeta}
          hideComparisonKeys={['__previous_year']}
          onHideComparisonKeysChange={onHideComparisonKeysChange}
        />
      </thead>
    </table>,
  );

  const plusIcon = container.querySelector('.anticon-plus-circle');
  expect(plusIcon).toBeTruthy();
  userEvent.click(plusIcon!);
  expect(onHideComparisonKeysChange).toHaveBeenCalled();
});

test('sets correct colspan for grouped headers', () => {
  const onHideComparisonKeysChange = jest.fn();
  const groupHeaderColumnsWithMultipleColumns = {
    __previous_year: [1, 2],
  };
  const { container } = render(
    <table>
      <thead>
        <GroupingHeaders
          groupHeaderColumns={groupHeaderColumnsWithMultipleColumns}
          filteredColumnsMeta={mockFilteredColumnsMeta}
          columnsMeta={mockColumnsMeta}
          hideComparisonKeys={[]}
          onHideComparisonKeysChange={onHideComparisonKeysChange}
        />
      </thead>
    </table>,
  );

  const headerWithColspan = container.querySelector('th[colspan="2"]');
  expect(headerWithColspan).toHaveAttribute('colspan', '2');
  expect(headerWithColspan).toHaveTextContent('Revenue');
});
