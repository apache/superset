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
  within,
} from 'spec/helpers/testing-library';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import ColumnSelectPopover, {
  ColumnSelectPopoverProps,
} from 'src/explore/components/controls/DndColumnSelectControl/ColumnSelectPopover';

// Mock SQLEditorWithValidation to capture props for testing
const mockSQLEditorProps = jest.fn();
jest.mock('src/components/SQLEditorWithValidation', () => ({
  __esModule: true,
  default: (mockProps: Record<string, unknown>) => {
    mockSQLEditorProps(mockProps);
    return (
      <textarea
        data-testid="sql-editor"
        value={mockProps.value as string}
        onChange={mockEvent =>
          (mockProps.onChange as (mockValue: string) => void)(
            (mockEvent.target as HTMLTextAreaElement).value,
          )
        }
      />
    );
  },
}));

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

test('passes keywords as objects to SQLEditorWithValidation for autocomplete', () => {
  // Reset mock to capture fresh calls
  mockSQLEditorProps.mockClear();

  const mockColumns = [
    { column_name: 'year', verbose_name: 'Year', type: 'INTEGER' },
    { column_name: 'revenue', verbose_name: null, type: 'DECIMAL' },
  ];

  renderPopover({
    columns: mockColumns,
    editedColumn: {
      sqlExpression: 'year + 1',
      label: 'test',
      expressionType: 'SQL',
    },
    getCurrentTab: jest.fn(),
    onChange: jest.fn(),
  });

  // Verify SQLEditorWithValidation was called
  expect(mockSQLEditorProps).toHaveBeenCalled();

  // Get the keywords prop passed to SQLEditorWithValidation
  const { keywords } = mockSQLEditorProps.mock.calls[0][0];

  // Verify keywords exist and are not empty
  expect(keywords).toBeDefined();
  expect(keywords.length).toBeGreaterThan(0);

  // Verify keywords are objects with required autocomplete properties
  // This test will FAIL if someone adds .map(k => k.value) transformation
  keywords.forEach((keyword: Record<string, unknown>) => {
    expect(typeof keyword).toBe('object');
    expect(keyword).toHaveProperty('name');
    expect(keyword).toHaveProperty('value');
    expect(keyword).toHaveProperty('score');
    expect(keyword).toHaveProperty('meta');
  });

  // Verify column keywords specifically have documentation for rich tooltips
  const columnKeywords = keywords.filter(
    (k: Record<string, unknown>) => k.meta === 'column',
  );
  expect(columnKeywords.length).toBe(2); // We passed 2 columns
  columnKeywords.forEach((keyword: Record<string, unknown>) => {
    expect(keyword).toHaveProperty('documentation');
  });
});

test('Should filter simple columns by column_name and verbose_name', async () => {
  renderPopover({
    columns: [
      { column_name: 'revenue_amount', verbose_name: 'Total Sales' },
      { column_name: 'user_id', verbose_name: 'User Identifier' },
      { column_name: 'created_at', verbose_name: 'Creation Date' },
      { column_name: 'order_status', verbose_name: 'Status' },
      { column_name: 'updated_at', verbose_name: 'Last Update' },
    ],
    editedColumn: undefined,
    getCurrentTab: jest.fn(),
    onChange: jest.fn(),
  });

  const combobox = screen.getByRole('combobox', {
    name: 'Columns and metrics',
  });

  await userEvent.type(combobox, 'revenue');

  let dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Total Sales')).toBeInTheDocument();
  expect(
    within(dropdown).queryByText('User Identifier'),
  ).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Creation Date')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Status')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Last Update')).not.toBeInTheDocument();

  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'Identifier');

  dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('User Identifier')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Total Sales')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Creation Date')).not.toBeInTheDocument();

  await userEvent.clear(combobox);
  await userEvent.type(combobox, '_at');

  dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Creation Date')).toBeInTheDocument();
  expect(within(dropdown).getByText('Last Update')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Total Sales')).not.toBeInTheDocument();
  expect(
    within(dropdown).queryByText('User Identifier'),
  ).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Status')).not.toBeInTheDocument();
});

test('Should filter saved expressions by column_name and verbose_name', async () => {
  const { container } = renderPopover({
    columns: [
      {
        column_name: 'calc_revenue',
        verbose_name: 'Total Sales',
        expression: 'price * quantity',
      },
      {
        column_name: 'calc_tax',
        verbose_name: 'Tax Amount',
        expression: 'price * 0.1',
      },
      {
        column_name: 'calc_profit',
        verbose_name: 'Net Profit',
        expression: 'revenue - cost',
      },
      {
        column_name: 'calc_margin',
        verbose_name: 'Profit Margin',
        expression: 'profit / revenue',
      },
      {
        column_name: 'calc_discount',
        verbose_name: 'Discount Rate',
        expression: 'discount / price',
      },
    ],
    editedColumn: undefined,
    getCurrentTab: jest.fn(),
    onChange: jest.fn(),
  });

  const savedTab = container.querySelector('#adhoc-metric-edit-tabs-tab-saved');
  expect(savedTab).not.toBeNull();
  fireEvent.click(savedTab!);

  const combobox = screen.getByRole('combobox', {
    name: 'Saved expressions',
  });

  await userEvent.type(combobox, 'revenue');

  let dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Total Sales')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Tax Amount')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Net Profit')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Profit Margin')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Discount Rate')).not.toBeInTheDocument();

  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'Rate');

  dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Discount Rate')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Total Sales')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Tax Amount')).not.toBeInTheDocument();

  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'profit');

  dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Net Profit')).toBeInTheDocument();
  expect(within(dropdown).getByText('Profit Margin')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Total Sales')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Tax Amount')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Discount Rate')).not.toBeInTheDocument();
});
