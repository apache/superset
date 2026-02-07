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

import { render, fireEvent } from 'spec/helpers/testing-library';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

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

  // Verify column keywords specifically have docHTML for rich tooltips
  const columnKeywords = keywords.filter(
    (k: Record<string, unknown>) => k.meta === 'column',
  );
  expect(columnKeywords.length).toBe(2); // We passed 2 columns
  columnKeywords.forEach((keyword: Record<string, unknown>) => {
    expect(keyword).toHaveProperty('docHTML');
  });
});
