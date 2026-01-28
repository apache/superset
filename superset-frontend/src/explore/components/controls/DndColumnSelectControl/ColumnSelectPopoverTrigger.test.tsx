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

import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import { AdhocColumn } from '@superset-ui/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import ColumnSelectPopoverTriggerWrapper from './ColumnSelectPopoverTrigger';

const createStore = (datasource = {}) =>
  configureStore({
    reducer: {
      explore: () => ({
        datasource,
      }),
    },
  });

const defaultColumns: ColumnMeta[] = [
  {
    column_name: 'test_column',
    verbose_name: 'Test Column',
    type: 'STRING',
  },
];

const firstAdhocColumn: AdhocColumn = {
  label: 'First Custom Column',
  sqlExpression: '',
  expressionType: 'SQL',
};

const secondAdhocColumn: AdhocColumn = {
  label: 'Second Custom Column',
  sqlExpression: 'SUM(amount)',
  expressionType: 'SQL',
};

const defaultProps = {
  columns: defaultColumns,
  onColumnEdit: jest.fn(),
  children: <button type="button">Trigger</button>,
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('should handle creating two columns with proper label reset', async () => {
  const store = createStore();
  const onColumnEditMock = jest.fn();

  const { rerender } = render(
    <Provider store={store}>
      <ColumnSelectPopoverTriggerWrapper
        {...defaultProps}
        onColumnEdit={onColumnEditMock}
        editedColumn={undefined}
      />
    </Provider>,
  );

  fireEvent.click(screen.getByText('Trigger'));
  expect(screen.getByText('My column')).toBeInTheDocument();

  const firstSqlInput = screen.getByText('Custom SQL');
  fireEvent.click(firstSqlInput!);
  expect(screen.queryByText('Click to edit label')).not.toBeInTheDocument();
  const firstLabelInput = await screen.findByTestId(
    'AdhocMetricEditTitle#trigger',
  );
  userEvent.type(firstLabelInput, 'First Custom Column');
  fireEvent.click(screen.getByTestId('ColumnEdit#save'));

  expect(onColumnEditMock).toHaveBeenCalledWith(
    expect.objectContaining({
      expressionType: 'SQL',
      label: 'First Custom Column',
      sqlExpression: '',
    }),
  );

  rerender(
    <Provider store={store}>
      <ColumnSelectPopoverTriggerWrapper
        {...defaultProps}
        onColumnEdit={onColumnEditMock}
        editedColumn={undefined}
      />
    </Provider>,
  );

  fireEvent.click(screen.getByText('Trigger'));
  expect(screen.getByText('My column')).toBeInTheDocument();

  const secondSqlInput = screen.getByText('Custom SQL');
  fireEvent.click(secondSqlInput!);
  expect(screen.queryByText('Click to edit label')).not.toBeInTheDocument();
  const secondLabelInput = await screen.findByTestId(
    'AdhocMetricEditTitle#trigger',
  );
  userEvent.type(secondLabelInput, 'Second Custom Column');
  fireEvent.click(screen.getByTestId('ColumnEdit#save'));

  expect(onColumnEditMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      expressionType: 'SQL',
      label: 'Second Custom Column',
      sqlExpression: '',
    }),
  );

  expect(onColumnEditMock).toHaveBeenCalledTimes(2);
});

test('should show correct labels when switching between multiple existing columns', async () => {
  const store = createStore();
  const { rerender } = render(
    <Provider store={store}>
      <ColumnSelectPopoverTriggerWrapper
        {...defaultProps}
        editedColumn={firstAdhocColumn}
      />
    </Provider>,
  );

  fireEvent.click(screen.getByText('Trigger'));
  expect(screen.getByTestId('AdhocMetricEditTitle#trigger')).toHaveTextContent(
    'First Custom Column',
  );

  fireEvent.click(screen.getByText('Close'));

  rerender(
    <Provider store={store}>
      <ColumnSelectPopoverTriggerWrapper
        {...defaultProps}
        editedColumn={secondAdhocColumn}
      />
    </Provider>,
  );

  fireEvent.click(screen.getByText('Trigger'));

  expect(screen.getByTestId('AdhocMetricEditTitle#trigger')).toHaveTextContent(
    'Second Custom Column',
  );
  fireEvent.click(screen.getByText('Close'));

  rerender(
    <Provider store={store}>
      <ColumnSelectPopoverTriggerWrapper
        {...defaultProps}
        editedColumn={undefined}
      />
    </Provider>,
  );

  fireEvent.click(screen.getByText('Trigger'));
  expect(screen.getByText('My column')).toBeInTheDocument();
});
