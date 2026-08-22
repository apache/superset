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
import { render, screen } from 'spec/helpers/testing-library';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import { FILTER_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import FilterHolder from './FilterHolder';

jest.mock(
  'src/dashboard/components/nativeFilters/FilterBar/FilterControls/FilterControl',
  () =>
    ({ filter }: { filter: { name?: string; id: string } }) => (
      <div data-test="mock-filter-control">{filter.name || filter.id}</div>
    ),
);

jest.mock('src/dashboard/components/dnd/DragDroppable', () => ({
  Draggable: ({
    children,
  }: {
    children: ({
      dragSourceRef,
    }: {
      dragSourceRef: () => void;
    }) => React.ReactNode;
  }) => children({ dragSourceRef: () => {} }),
}));

jest.mock(
  'src/dashboard/components/resizable/ResizableContainer',
  () =>
    ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
);

const defaultProps = {
  id: 'FILTER-1',
  parentId: 'ROW-1',
  component: {
    ...newComponentFactory(FILTER_TYPE),
    id: 'FILTER-1',
    parents: ['ROOT_ID', 'ROW-1'],
    meta: {
      width: 4,
      height: 18,
      filterId: undefined,
    },
  },
  parentComponent: {
    ...newComponentFactory(ROW_TYPE),
    id: 'ROW-1',
    children: ['FILTER-1'],
  },
  index: 0,
  depth: 1,
  availableColumnCount: 12,
  columnWidth: 100,
  onResizeStart: jest.fn(),
  onResize: jest.fn(),
  onResizeStop: jest.fn(),
  deleteComponent: jest.fn(),
  updateComponents: jest.fn(),
  handleComponentDrop: jest.fn(),
  editMode: false,
};

const mockNativeFilters = {
  'native-filter-1': {
    id: 'native-filter-1',
    name: 'Country Filter',
    filterType: 'filter_select',
    targets: [{ datasetId: 1, column: { name: 'country' } }],
    defaultDataMask: {},
    controlValues: {},
  },
};

test('renders unassigned placeholder in view mode', () => {
  render(<FilterHolder {...defaultProps} editMode={false} />, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: mockNativeFilters },
      dataMask: {},
    },
  });

  expect(screen.getByText('Filter not configured')).toBeInTheDocument();
});

test('renders assignment selector in edit mode when unassigned', () => {
  render(<FilterHolder {...defaultProps} editMode />, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: mockNativeFilters },
      dataMask: {},
    },
  });

  expect(
    screen.getByText('Assign Native Filter to Canvas'),
  ).toBeInTheDocument();
});

test('renders FilterControl when filterId is bound', () => {
  const boundProps = {
    ...defaultProps,
    component: {
      ...defaultProps.component,
      meta: {
        ...defaultProps.component.meta,
        filterId: 'native-filter-1',
      },
    },
  };

  render(<FilterHolder {...boundProps} editMode={false} />, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: mockNativeFilters },
      dataMask: {
        'native-filter-1': {
          filterState: { value: ['USA'] },
        },
      },
    },
  });

  expect(screen.getByTestId('mock-filter-control')).toBeInTheDocument();
  expect(screen.getByText('Country Filter')).toBeInTheDocument();
});
