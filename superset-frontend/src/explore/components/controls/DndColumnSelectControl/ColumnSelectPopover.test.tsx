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
  waitFor,
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

  let dropdown = document.querySelector(
    '.ant-select-dropdown-list',
  ) as HTMLElement;
  expect(within(dropdown).getByText('Total Sales')).toBeInTheDocument();
  expect(
    within(dropdown).queryByText('User Identifier'),
  ).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Creation Date')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Status')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Last Update')).not.toBeInTheDocument();

  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'Identifier');

  dropdown = document.querySelector('.ant-select-dropdown-list') as HTMLElement;
  expect(within(dropdown).getByText('User Identifier')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Total Sales')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Creation Date')).not.toBeInTheDocument();

  await userEvent.clear(combobox);
  await userEvent.type(combobox, '_at');

  dropdown = document.querySelector('.ant-select-dropdown-list') as HTMLElement;
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

  let dropdown = document.querySelector(
    '.ant-select-dropdown-list',
  ) as HTMLElement;
  expect(within(dropdown).getByText('Total Sales')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Tax Amount')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Net Profit')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Profit Margin')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Discount Rate')).not.toBeInTheDocument();

  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'Rate');

  dropdown = document.querySelector('.ant-select-dropdown-list') as HTMLElement;
  expect(within(dropdown).getByText('Discount Rate')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Total Sales')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Tax Amount')).not.toBeInTheDocument();

  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'profit');

  dropdown = document.querySelector('.ant-select-dropdown-list') as HTMLElement;
  expect(within(dropdown).getByText('Net Profit')).toBeInTheDocument();
  expect(within(dropdown).getByText('Profit Margin')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Total Sales')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Tax Amount')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Discount Rate')).not.toBeInTheDocument();
});

const SEMANTIC_COLUMNS = [
  { column_name: 'order_date', verbose_name: 'Order Date', is_dttm: true },
  { column_name: 'category', verbose_name: 'Product Category' },
  { column_name: 'region' },
];

const renderSemanticPopover = (
  props: Partial<ColumnSelectPopoverProps> = {},
  exploreState: Record<string, unknown> = {},
) => {
  const store = mockStore({
    explore: {
      datasource: { type: 'semantic_view', semantic_view_features: [] },
      ...exploreState,
    },
  });

  return render(
    <ColumnSelectPopover
      hasCustomLabel={false}
      label="My column"
      onClose={jest.fn()}
      setDatasetModal={jest.fn()}
      setLabel={jest.fn()}
      columns={SEMANTIC_COLUMNS}
      getCurrentTab={jest.fn()}
      onChange={jest.fn()}
      {...props}
    />,
    { store },
  );
};

const openDimensionsDropdown = () => {
  const combobox = screen.getByRole('combobox', { name: 'Dimensions' });
  userEvent.click(combobox);
  return combobox;
};

const getOptionItem = (label: string) => {
  const dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  return within(dropdown).getByText(label).closest('.ant-select-item');
};

test('saved-only semantic view opens on Saved with Simple and Custom SQL disabled', () => {
  const getCurrentTab = jest.fn();
  renderSemanticPopover({ getCurrentTab });

  expect(screen.getByRole('tab', { name: 'Saved' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByRole('tab', { name: 'Simple' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByRole('tab', { name: 'Custom SQL' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(getCurrentTab).toHaveBeenCalledWith('saved');
});

test('semantic view declaring adhoc expressions keeps the existing default mode', () => {
  renderSemanticPopover(
    {},
    {
      datasource: {
        type: 'semantic_view',
        semantic_view_features: ['ADHOC_COLUMN_EXPRESSIONS'],
      },
    },
  );

  expect(screen.getByRole('tab', { name: 'Simple' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByRole('tab', { name: 'Simple' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

test('lists every expression-less dimension as a Saved option without mutating metadata', async () => {
  const onChange = jest.fn();
  renderSemanticPopover({ onChange });

  openDimensionsDropdown();

  const dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Order Date')).toBeInTheDocument();
  expect(within(dropdown).getByText('Product Category')).toBeInTheDocument();
  expect(within(dropdown).getByText('region')).toBeInTheDocument();

  userEvent.click(within(dropdown).getByText('Order Date'));
  const saveButton = screen.getByTestId('ColumnEdit#save');
  await waitFor(() => expect(saveButton).toBeEnabled());
  userEvent.click(saveButton);

  expect(onChange).toHaveBeenCalledWith(SEMANTIC_COLUMNS[0]);
});

test('searches Saved dimensions by name and verbose name', async () => {
  renderSemanticPopover();

  const combobox = openDimensionsDropdown();
  await userEvent.type(combobox, 'Product');

  let dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Product Category')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Order Date')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('region')).not.toBeInTheDocument();

  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'region');

  dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('region')).toBeInTheDocument();
  expect(
    within(dropdown).queryByText('Product Category'),
  ).not.toBeInTheDocument();
});

test('reopens an existing semantic dimension on Saved with the item selected', () => {
  renderSemanticPopover({ editedColumn: SEMANTIC_COLUMNS[1] });

  expect(screen.getByRole('tab', { name: 'Saved' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(
    within(screen.getByRole('tabpanel', { name: 'Saved' })).getByText(
      'Product Category',
    ),
  ).toBeInTheDocument();
});

test('disables Saved dimensions absent from a verified compatibility result', () => {
  renderSemanticPopover(
    {},
    {
      datasource: { type: 'semantic_view', semantic_view_features: [] },
      compatibility: {
        status: 'verified',
        metrics: [],
        dimensions: ['order_date'],
      },
    },
  );

  openDimensionsDropdown();

  expect(getOptionItem('Order Date')).not.toHaveClass(
    'ant-select-item-option-disabled',
  );
  expect(getOptionItem('Product Category')).toHaveClass(
    'ant-select-item-option-disabled',
  );
  expect(getOptionItem('region')).toHaveClass(
    'ant-select-item-option-disabled',
  );
});

test('a verified empty compatibility result disables every Saved dimension', () => {
  renderSemanticPopover(
    {},
    {
      datasource: { type: 'semantic_view', semantic_view_features: [] },
      compatibility: { status: 'verified', metrics: [], dimensions: [] },
    },
  );

  openDimensionsDropdown();

  expect(getOptionItem('Order Date')).toHaveClass(
    'ant-select-item-option-disabled',
  );
  expect(getOptionItem('Product Category')).toHaveClass(
    'ant-select-item-option-disabled',
  );
});

test('a failed compatibility request shows a non-blocking warning and unfiltered options', () => {
  renderSemanticPopover(
    {},
    {
      datasource: { type: 'semantic_view', semantic_view_features: [] },
      compatibility: { status: 'failed' },
    },
  );

  expect(screen.getByRole('status')).toHaveTextContent(
    /could not verify|compatib/i,
  );

  openDimensionsDropdown();
  expect(getOptionItem('Order Date')).not.toHaveClass(
    'ant-select-item-option-disabled',
  );
  expect(getOptionItem('Product Category')).not.toHaveClass(
    'ant-select-item-option-disabled',
  );
});

test('a loading compatibility request shows neither warning nor a filtered list', () => {
  renderSemanticPopover(
    {},
    {
      datasource: { type: 'semantic_view', semantic_view_features: [] },
      compatibility: { status: 'loading' },
    },
  );

  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  openDimensionsDropdown();
  expect(getOptionItem('Order Date')).not.toHaveClass(
    'ant-select-item-option-disabled',
  );
});

test('non-semantic datasources never show the compatibility failure warning', () => {
  const store = mockStore({
    explore: {
      datasource: { type: 'table' },
      compatibility: { status: 'failed' },
    },
  });

  render(
    <ColumnSelectPopover
      hasCustomLabel={false}
      label="My column"
      onClose={jest.fn()}
      setDatasetModal={jest.fn()}
      setLabel={jest.fn()}
      columns={[{ column_name: 'year' }]}
      getCurrentTab={jest.fn()}
      onChange={jest.fn()}
    />,
    { store },
  );

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('an edited dimension that became incompatible cannot be saved until replaced', async () => {
  const onChange = jest.fn();
  renderSemanticPopover(
    { onChange, editedColumn: SEMANTIC_COLUMNS[1] },
    {
      datasource: { type: 'semantic_view', semantic_view_features: [] },
      compatibility: {
        status: 'verified',
        metrics: [],
        dimensions: ['order_date'],
      },
    },
  );

  const saveButton = screen.getByTestId('ColumnEdit#save');
  expect(saveButton).toBeDisabled();

  const feedback = screen.getByRole('status');
  expect(feedback).toHaveTextContent(/compatible/i);
  expect(feedback.id).toBeTruthy();
  expect(saveButton).toHaveAttribute('aria-describedby', feedback.id);

  openDimensionsDropdown();
  const dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  userEvent.click(within(dropdown).getByText('Order Date'));

  await waitFor(() => expect(saveButton).toBeEnabled());
  userEvent.click(saveButton);
  expect(onChange).toHaveBeenCalledWith(SEMANTIC_COLUMNS[0]);
});

test('a legacy edited adhoc value opens Saved, stays inspectable, and blocks Save until replaced', async () => {
  const onChange = jest.fn();
  const legacyValue = {
    label: 'Legacy value',
    sqlExpression: "state || '_legacy'",
    expressionType: 'SQL' as const,
  };
  renderSemanticPopover({ onChange, editedColumn: legacyValue });

  expect(screen.getByRole('tab', { name: 'Saved' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  const saveButton = screen.getByTestId('ColumnEdit#save');
  expect(saveButton).toBeDisabled();
  const feedback = screen.getByRole('status');
  expect(saveButton).toHaveAttribute('aria-describedby', feedback.id);

  // The legacy value is preserved for inspection, not translated or dropped.
  const customSqlTab = screen.getByRole('tab', { name: 'Custom SQL' });
  expect(customSqlTab).not.toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(customSqlTab);
  expect(screen.getByDisplayValue("state || '_legacy'")).toBeInTheDocument();

  // Explicitly choosing a compatible dimension is the only way to save.
  fireEvent.click(screen.getByRole('tab', { name: 'Saved' }));
  openDimensionsDropdown();
  const dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  userEvent.click(within(dropdown).getByText('Order Date'));

  await waitFor(() => expect(saveButton).toBeEnabled());
  userEvent.click(saveButton);
  expect(onChange).toHaveBeenCalledWith(SEMANTIC_COLUMNS[0]);
});

test('table datasources keep expression-based classification and enabled modes', async () => {
  const store = mockStore({ explore: { datasource: { type: 'table' } } });
  render(
    <ColumnSelectPopover
      hasCustomLabel={false}
      label="My column"
      onClose={jest.fn()}
      setDatasetModal={jest.fn()}
      setLabel={jest.fn()}
      columns={[
        { column_name: 'plain_col' },
        { column_name: 'calc_col', expression: 'a + b' },
      ]}
      getCurrentTab={jest.fn()}
      onChange={jest.fn()}
    />,
    { store },
  );

  expect(screen.getByRole('tab', { name: 'Simple' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByRole('tab', { name: 'Simple' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByRole('tab', { name: 'Custom SQL' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );

  const combobox = screen.getByRole('combobox', {
    name: 'Columns and metrics',
  });
  userEvent.click(combobox);
  const dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('plain_col')).toBeInTheDocument();
  expect(within(dropdown).queryByText('calc_col')).not.toBeInTheDocument();
});

test('default routing skips a disabled Simple mode for non-semantic datasources', () => {
  const store = mockStore({ explore: { datasource: { type: 'table' } } });
  render(
    <ColumnSelectPopover
      hasCustomLabel={false}
      label="My column"
      onClose={jest.fn()}
      setDatasetModal={jest.fn()}
      setLabel={jest.fn()}
      columns={[{ column_name: 'year' }]}
      getCurrentTab={jest.fn()}
      onChange={jest.fn()}
      disabledTabs={new Set(['simple'])}
    />,
    { store },
  );

  expect(screen.getByRole('tab', { name: 'Saved' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByRole('tab', { name: 'Simple' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});
