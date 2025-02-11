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
import { dashboardLayout } from 'spec/fixtures/mockDashboardLayout';
import { buildNativeFilter } from 'spec/fixtures/mockNativeFilters';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import FilterConfigPane from './FilterConfigurePane';

const scrollMock = jest.fn();
Element.prototype.scroll = scrollMock;

const defaultProps = {
  getFilterTitle: (id: string) => id,
  onChange: jest.fn(),
  onAdd: jest.fn(),
  onRemove: jest.fn(),
  onRearrange: jest.fn(),
  restoreFilter: jest.fn(),
  currentFilterId: 'NATIVE_FILTER-1',
  filters: ['NATIVE_FILTER-1', 'NATIVE_FILTER-2', 'NATIVE_FILTER-3'],
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

beforeEach(() => {
  scrollMock.mockClear();
});

test('drag and drop', async () => {
  defaultRender();
  // Drag the state and country filter above the product filter
  const [countryStateFilter, productFilter] = document.querySelectorAll(
    'div[draggable=true]',
  );
  // const productFilter = await screen.findByText('NATIVE_FILTER-3');
  await waitFor(() => {
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
  userEvent.click(removeFilterIcon);
  expect(defaultProps.onRemove).toHaveBeenCalledWith('NATIVE_FILTER-1');
});

test('add filter', async () => {
  defaultRender();
  // First trash icon
  const addFilterButton = await screen.findByText('Add Filter');
  userEvent.click(addFilterButton);
  expect(defaultProps.onAdd).toHaveBeenCalledWith('NATIVE_FILTER');
});

test('add divider', async () => {
  defaultRender();
  const addFilterButton = await screen.findByText('Add Divider');
  userEvent.click(addFilterButton);
  expect(defaultProps.onAdd).toHaveBeenCalledWith('DIVIDER');
});

test('filter container should scroll to bottom when adding items', async () => {
  const state = {
    dashboardInfo: {
      metadata: {
        native_filter_configuration: new Array(35)
          .fill(0)
          .map((_, index) =>
            buildNativeFilter(`NATIVE_FILTER-${index}`, `filter-${index}`, []),
          ),
      },
    },
    dashboardLayout,
  };
  const props = {
    ...defaultProps,
    filters: new Array(35).fill(0).map((_, index) => `NATIVE_FILTER-${index}`),
  };

  defaultRender(state, props);

  const addFilterButton = await screen.findByText('Add Filter');

  userEvent.click(addFilterButton);

  await waitFor(() => {
    const containerElement = screen.getByTestId('filter-title-container');
    expect(containerElement.scroll).toHaveBeenCalled();
  });
});
