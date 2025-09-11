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

import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
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
    <Provider store={store}>
      <ThemeProvider theme={supersetTheme}>
        <ColumnSelectPopover
          hasCustomLabel
          isTemporal
          label="Custom Label"
          onClose={jest.fn()}
          setDatasetModal={jest.fn()}
          setLabel={jest.fn()}
          {...props}
        />
      </ThemeProvider>
    </Provider>,
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
