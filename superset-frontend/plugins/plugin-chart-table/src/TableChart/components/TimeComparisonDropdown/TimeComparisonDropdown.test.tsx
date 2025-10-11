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
import TimeComparisonDropdown from './index';

const mockComparisonColumns = [
  { key: '__timestamp', label: 'Display all' },
  { key: '__timestamp_previous_year', label: 'Previous year' },
  { key: '__timestamp_previous_month', label: 'Previous month' },
];

test('renders dropdown trigger with table and down icons', () => {
  const onSelectedColumnsChange = jest.fn();
  const onOpenChange = jest.fn();
  const { container } = render(
    <TimeComparisonDropdown
      comparisonColumns={mockComparisonColumns}
      selectedComparisonColumns={['__timestamp']}
      onSelectedColumnsChange={onSelectedColumnsChange}
      isOpen={false}
      onOpenChange={onOpenChange}
    />,
  );

  const icons = container.querySelectorAll('.anticon');
  expect(icons.length).toBeGreaterThan(0);
});

test('shows dropdown when isOpen is true', () => {
  const onSelectedColumnsChange = jest.fn();
  const onOpenChange = jest.fn();
  render(
    <TimeComparisonDropdown
      comparisonColumns={mockComparisonColumns}
      selectedComparisonColumns={['__timestamp']}
      onSelectedColumnsChange={onSelectedColumnsChange}
      isOpen
      onOpenChange={onOpenChange}
    />,
  );

  screen.getByText(
    'Select columns that will be displayed in the table. You can multiselect columns.',
  );
});

test('displays all comparison column labels in dropdown', () => {
  const onSelectedColumnsChange = jest.fn();
  const onOpenChange = jest.fn();
  render(
    <TimeComparisonDropdown
      comparisonColumns={mockComparisonColumns}
      selectedComparisonColumns={['__timestamp']}
      onSelectedColumnsChange={onSelectedColumnsChange}
      isOpen
      onOpenChange={onOpenChange}
    />,
  );

  screen.getByText('Display all');
  screen.getByText('Previous year');
  screen.getByText('Previous month');
});

test('accepts multiple selected columns', () => {
  const onSelectedColumnsChange = jest.fn();
  const onOpenChange = jest.fn();
  render(
    <TimeComparisonDropdown
      comparisonColumns={mockComparisonColumns}
      selectedComparisonColumns={['__timestamp', '__timestamp_previous_year']}
      onSelectedColumnsChange={onSelectedColumnsChange}
      isOpen
      onOpenChange={onOpenChange}
    />,
  );

  screen.getByText('Display all');
  screen.getByText('Previous year');
});

test('calls onSelectedColumnsChange with only all key when all option is clicked', () => {
  const onSelectedColumnsChange = jest.fn();
  const onOpenChange = jest.fn();
  render(
    <TimeComparisonDropdown
      comparisonColumns={mockComparisonColumns}
      selectedComparisonColumns={['__timestamp_previous_year']}
      onSelectedColumnsChange={onSelectedColumnsChange}
      isOpen
      onOpenChange={onOpenChange}
    />,
  );

  const allOption = screen.getByText('Display all');
  userEvent.click(allOption);

  expect(onSelectedColumnsChange).toHaveBeenCalledWith(['__timestamp']);
});

test('switches to single column when clicking column while all is selected', () => {
  const onSelectedColumnsChange = jest.fn();
  const onOpenChange = jest.fn();
  render(
    <TimeComparisonDropdown
      comparisonColumns={mockComparisonColumns}
      selectedComparisonColumns={['__timestamp']}
      onSelectedColumnsChange={onSelectedColumnsChange}
      isOpen
      onOpenChange={onOpenChange}
    />,
  );

  const previousYearOption = screen.getByText('Previous year');
  userEvent.click(previousYearOption);

  expect(onSelectedColumnsChange).toHaveBeenCalledWith([
    '__timestamp_previous_year',
  ]);
});

test('deselects column when clicking already selected column without all selected', () => {
  const onSelectedColumnsChange = jest.fn();
  const onOpenChange = jest.fn();
  render(
    <TimeComparisonDropdown
      comparisonColumns={mockComparisonColumns}
      selectedComparisonColumns={[
        '__timestamp_previous_year',
        '__timestamp_previous_month',
      ]}
      onSelectedColumnsChange={onSelectedColumnsChange}
      isOpen
      onOpenChange={onOpenChange}
    />,
  );

  const previousYearOption = screen.getByText('Previous year');
  userEvent.click(previousYearOption);

  expect(onSelectedColumnsChange).toHaveBeenCalledWith([
    '__timestamp_previous_month',
  ]);
});

test('adds column to selection when clicking unselected column without all selected', () => {
  const onSelectedColumnsChange = jest.fn();
  const onOpenChange = jest.fn();
  render(
    <TimeComparisonDropdown
      comparisonColumns={mockComparisonColumns}
      selectedComparisonColumns={['__timestamp_previous_year']}
      onSelectedColumnsChange={onSelectedColumnsChange}
      isOpen
      onOpenChange={onOpenChange}
    />,
  );

  const previousMonthOption = screen.getByText('Previous month');
  userEvent.click(previousMonthOption);

  expect(onSelectedColumnsChange).toHaveBeenCalledWith([
    '__timestamp_previous_year',
    '__timestamp_previous_month',
  ]);
});
