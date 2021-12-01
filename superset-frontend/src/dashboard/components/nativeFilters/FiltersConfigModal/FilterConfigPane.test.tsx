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
import { dashboardLayout } from 'spec/fixtures/mockDashboardLayout';
import { buildNativeFilter } from 'spec/fixtures/mockNativeFilters';
import { act, fireEvent, render, screen } from 'spec/helpers/testing-library';
import FilterConfigPane from './FilterConfigurePane';

const defaultProps = {
  children: jest.fn(),
  getFilterTitle: (id: string) => id,
  onChange: jest.fn(),
  onAdd: jest.fn(),
  onRemove: jest.fn(),
  onRearrange: jest.fn(),
  restoreFilter: jest.fn(),
  currentFilterId: 'NATIVE_FILTER-1',
  filterGroups: [['NATIVE_FILTER-2', 'NATIVE_FILTER-1'], ['NATIVE_FILTER-3']],
  removedFilters: {},
  erroredFilters: [],
};
const defaultState = {
  dashboardInfo: {
    metadata: {
      native_filter_configuration: [
        buildNativeFilter('NATIVE_FILTER-1', 'state', ['NATIVE_FILTER-2']),
        buildNativeFilter('NATIVE_FILTER-2', 'country', []),
        buildNativeFilter('NATIVE_FILTER-3', 'product', []),
      ],
    },
  },
  dashboardLayout,
};

function defaultRender(initialState: any = defaultState, props = defaultProps) {
  return render(<FilterConfigPane {...props} />, {
    initialState,
    useDnd: true,
    useRedux: true,
  });
}

test('renders form', async () => {
  await act(async () => {
    defaultRender();
  });
  expect(defaultProps.children).toHaveBeenCalledTimes(3);
});

test('drag and drop', async () => {
  defaultRender();
  // Drag the state and contry filter above the product filter
  const [countryStateFilter, productFilter] = document.querySelectorAll(
    'div[draggable=true]',
  );
  // const productFilter = await screen.findByText('NATIVE_FILTER-3');
  await act(async () => {
    fireEvent.dragStart(productFilter);
    fireEvent.dragEnter(countryStateFilter);
    fireEvent.dragOver(countryStateFilter);
    fireEvent.drop(countryStateFilter);
    fireEvent.dragLeave(countryStateFilter);
    fireEvent.dragEnd(productFilter);
  });
  expect(defaultProps.onRearrange).toHaveBeenCalledTimes(1);
});

test('remove filter', async () => {
  defaultRender();
  // First trash icon
  const removeFilterIcon = document.querySelector("[alt='RemoveFilter']")!;
  await act(async () => {
    fireEvent(
      removeFilterIcon,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  expect(defaultProps.onRemove).toHaveBeenCalledWith('NATIVE_FILTER-2');
});

test('add filter', async () => {
  defaultRender();
  // First trash icon
  const addButton = screen.getByText('Add')!;
  fireEvent.mouseOver(addButton);
  const addFilterButton = await screen.findByText('Filter');

  await act(async () => {
    fireEvent(
      addFilterButton,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  expect(defaultProps.onAdd).toHaveBeenCalledWith('NATIVE_FILTER');
});

test('add divider', async () => {
  defaultRender();
  const addButton = screen.getByText('Add')!;
  fireEvent.mouseOver(addButton);
  const addFilterButton = await screen.findByText('Divider');
  await act(async () => {
    fireEvent(
      addFilterButton,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  expect(defaultProps.onAdd).toHaveBeenCalledWith('DIVIDER');
});
