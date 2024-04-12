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

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import ColumnSelectPopover from 'src/explore/components/controls/DndColumnSelectControl/ColumnSelectPopover';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('ColumnSelectPopover - onTabChange function', () => {
  it('updates adhocColumn when switching to sqlExpression tab with custom label', () => {
    const mockColumns = [{ column_name: 'year' }];
    const mockOnClose = jest.fn();
    const mockOnChange = jest.fn();
    const mockGetCurrentTab = jest.fn();
    const mockSetDatasetModal = jest.fn();
    const mockSetLabel = jest.fn();

    const store = mockStore({ explore: { datasource: { type: 'table' } } });

    const { container, getByText } = render(
      <Provider store={store}>
        <ThemeProvider theme={supersetTheme}>
          <ColumnSelectPopover
            columns={mockColumns}
            editedColumn={mockColumns[0]}
            getCurrentTab={mockGetCurrentTab}
            hasCustomLabel
            isTemporal
            label="Custom Label"
            onChange={mockOnChange}
            onClose={mockOnClose}
            setDatasetModal={mockSetDatasetModal}
            setLabel={mockSetLabel}
          />
        </ThemeProvider>
      </Provider>,
    );

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
});
