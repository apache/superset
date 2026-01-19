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
  fireEvent,
  screen,
  userEvent,
  selectOption,
} from 'spec/helpers/testing-library';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import ColumnSelectPopover, {
  ColumnSelectPopoverProps,
} from 'src/explore/components/controls/DndColumnSelectControl/ColumnSelectPopover';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const renderPopover = (
  props: Pick<
    ColumnSelectPopoverProps,
    'columns' | 'editedColumn' | 'getCurrentTab' | 'onChange'
  >,
) => {
  const store = mockStore({ explore: { datasource: { type: 'table' } } });

  return render(
    <ColumnSelectPopover
      hasCustomLabel
      isTemporal
      label="Custom Label"
      onClose={jest.fn()}
      setDatasetModal={jest.fn()}
      setLabel={jest.fn()}
      {...props}
    />,
    { store },
  );
};

test('updates adhocColumn when switching to sqlExpression tab with custom label', () => {
  const mockColumns = [{ column_name: 'year' }];
  const mockOnChange = jest.fn();
  const mockGetCurrentTab = jest.fn();

  const { container, getByText } = renderPopover({
    columns: mockColumns,
    editedColumn: mockColumns[0],
    getCurrentTab: mockGetCurrentTab,
    onChange: mockOnChange,
  });

  const sqlExpressionTab = container.querySelector(
    '#adhoc-metric-edit-tabs-tab-sqlExpression',
  );
  expect(sqlExpressionTab).not.toBeNull();
  fireEvent.click(sqlExpressionTab!);
  expect(mockGetCurrentTab).toHaveBeenCalledWith('sqlExpression');

  const saveButton = getByText('Save');
  fireEvent.click(saveButton);
  expect(mockOnChange).toHaveBeenCalledWith({
    label: 'Custom Label',
    sqlExpression: 'year',
    expressionType: 'SQL',
  });
});

test('open with Simple tab selected when there is no column selected', () => {
  const { getByText } = renderPopover({
    columns: [{ column_name: 'year' }],
    editedColumn: undefined,
    getCurrentTab: jest.fn(),
    onChange: jest.fn(),
  });
  expect(getByText('Saved')).toHaveAttribute('aria-selected', 'false');
  expect(getByText('Simple')).toHaveAttribute('aria-selected', 'true');
  expect(getByText('Custom SQL')).toHaveAttribute('aria-selected', 'false');
});

test('open with Saved tab selected when there is a saved column selected', () => {
  const { getByText } = renderPopover({
    columns: [{ column_name: 'year' }],
    editedColumn: { column_name: 'year', expression: 'year - 1' },
    getCurrentTab: jest.fn(),
    onChange: jest.fn(),
  });
  expect(getByText('Saved')).toHaveAttribute('aria-selected', 'true');
  expect(getByText('Simple')).toHaveAttribute('aria-selected', 'false');
  expect(getByText('Custom SQL')).toHaveAttribute('aria-selected', 'false');
});

test('open with Custom SQL tab selected when there is a custom SQL selected', () => {
  const { getByText } = renderPopover({
    columns: [{ column_name: 'year' }],
    editedColumn: {
      column_name: 'year',
      label: 'Custom SQL',
      sqlExpression: 'year - 1',
    },
    getCurrentTab: jest.fn(),
    onChange: jest.fn(),
  });
  expect(getByText('Saved')).toHaveAttribute('aria-selected', 'false');
  expect(getByText('Simple')).toHaveAttribute('aria-selected', 'false');
  expect(getByText('Custom SQL')).toHaveAttribute('aria-selected', 'true');
});

test('Should filter simple columns by column_name and select', async () => {
  const mockOnChange = jest.fn();
  renderPopover({
    columns: [
      { column_name: 'revenue_amount', verbose_name: 'Total Sales' },
      { column_name: 'user_id', verbose_name: 'User Identifier' },
    ],
    editedColumn: undefined,
    getCurrentTab: jest.fn(),
    onChange: mockOnChange,
  });

  const combobox = screen.getByRole('combobox', {
    name: 'Columns and metrics',
  });
  // Search by column_name - 'revenue' is only in column_name, not in verbose_name
  await userEvent.type(combobox, 'revenue');
  await selectOption('Total Sales');

  fireEvent.click(screen.getByText('Save'));
  expect(mockOnChange).toHaveBeenCalledWith(
    expect.objectContaining({ column_name: 'revenue_amount' }),
  );
});

test('Should filter simple columns by verbose_name and select', async () => {
  const mockOnChange = jest.fn();
  renderPopover({
    columns: [
      { column_name: 'revenue_amount', verbose_name: 'Total Sales' },
      { column_name: 'user_id', verbose_name: 'User Identifier' },
    ],
    editedColumn: undefined,
    getCurrentTab: jest.fn(),
    onChange: mockOnChange,
  });

  const combobox = screen.getByRole('combobox', {
    name: 'Columns and metrics',
  });
  // Search by verbose_name - 'Identifier' is only in verbose_name, not in column_name
  await userEvent.type(combobox, 'Identifier');
  await selectOption('User Identifier');

  fireEvent.click(screen.getByText('Save'));
  expect(mockOnChange).toHaveBeenCalledWith(
    expect.objectContaining({ column_name: 'user_id' }),
  );
});

test('Should filter saved expressions by column_name and select', async () => {
  const mockOnChange = jest.fn();
  const { container } = renderPopover({
    columns: [
      {
        column_name: 'calculated_revenue',
        verbose_name: 'Total Sales Calculation',
        expression: 'price * quantity',
      },
      {
        column_name: 'calculated_tax',
        verbose_name: 'Tax Amount',
        expression: 'price * 0.1',
      },
    ],
    editedColumn: undefined,
    getCurrentTab: jest.fn(),
    onChange: mockOnChange,
  });

  const savedTab = container.querySelector('#adhoc-metric-edit-tabs-tab-saved');
  expect(savedTab).not.toBeNull();
  fireEvent.click(savedTab!);

  const combobox = screen.getByRole('combobox', {
    name: 'Saved expressions',
  });
  // Search by column_name - 'revenue' is only in column_name, not in verbose_name
  await userEvent.type(combobox, 'revenue');
  await selectOption('Total Sales Calculation');

  fireEvent.click(screen.getByText('Save'));
  expect(mockOnChange).toHaveBeenCalledWith(
    expect.objectContaining({ column_name: 'calculated_revenue' }),
  );
});

test('Should filter saved expressions by verbose_name and select', async () => {
  const mockOnChange = jest.fn();
  const { container } = renderPopover({
    columns: [
      {
        column_name: 'calculated_revenue',
        verbose_name: 'Total Sales Calculation',
        expression: 'price * quantity',
      },
      {
        column_name: 'calculated_tax',
        verbose_name: 'Tax Amount',
        expression: 'price * 0.1',
      },
    ],
    editedColumn: undefined,
    getCurrentTab: jest.fn(),
    onChange: mockOnChange,
  });

  const savedTab = container.querySelector('#adhoc-metric-edit-tabs-tab-saved');
  expect(savedTab).not.toBeNull();
  fireEvent.click(savedTab!);

  const combobox = screen.getByRole('combobox', {
    name: 'Saved expressions',
  });
  // Search by verbose_name - 'Amount' is only in verbose_name, not in column_name
  await userEvent.type(combobox, 'Amount');
  await selectOption('Tax Amount');

  fireEvent.click(screen.getByText('Save'));
  expect(mockOnChange).toHaveBeenCalledWith(
    expect.objectContaining({ column_name: 'calculated_tax' }),
  );
});
