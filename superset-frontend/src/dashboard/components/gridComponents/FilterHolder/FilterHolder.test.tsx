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
import { NativeFilterType } from '@superset-ui/core';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import * as dataMaskActions from 'src/dataMask/actions';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import {
  COLUMN_TYPE,
  FILTER_TYPE,
  ROW_TYPE,
} from 'src/dashboard/util/componentTypes';
import FilterHolder from './FilterHolder';

jest.mock(
  'src/dashboard/components/nativeFilters/FilterBar/FilterControls/FilterControl',
  () =>
    ({
      filter,
      onFilterSelectionChange,
    }: {
      filter: { name?: string; id: string };
      onFilterSelectionChange?: (filter: any, mask: any) => void;
    }) => (
      <button
        type="button"
        data-test="mock-filter-control"
        data-testid="mock-filter-control"
        onClick={() => {
          onFilterSelectionChange?.(filter, {
            filterState: { value: ['USA'], validateStatus: 'success' },
            extraFormData: {},
          });
        }}
      >
        {filter.name || filter.id}
      </button>
    ),
);

const mockResizableContainer = jest.fn(
  ({ children, adjustableHeight, adjustableWidth, heightMultiple }: any) => (
    <div
      data-test="mock-resizable-container"
      data-adjustable-height={String(adjustableHeight)}
      data-adjustable-width={String(adjustableWidth)}
      data-height-multiple={heightMultiple}
    >
      {children}
    </div>
  ),
);
jest.mock(
  'src/dashboard/components/resizable/ResizableContainer',
  () => (props: any) => mockResizableContainer(props),
);

const mockDraggable = jest.fn(
  ({ children, disableDragDrop, orientation }: any) => (
    <div
      data-test="mock-draggable"
      data-disable-drag-drop={String(disableDragDrop)}
      data-orientation={orientation}
    >
      {children({ dragSourceRef: jest.fn() })}
    </div>
  ),
);
jest.mock('src/dashboard/components/dnd/DragDroppable', () => ({
  Draggable: (props: any) => mockDraggable(props),
}));

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
    type: NativeFilterType.NativeFilter,
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

test('configures resizable container for vertical height adjustment when inside COLUMN', () => {
  const columnProps = {
    ...defaultProps,
    parentComponent: {
      ...newComponentFactory(COLUMN_TYPE),
      id: 'COLUMN-1',
      children: ['FILTER-1'],
    },
  };

  render(<FilterHolder {...columnProps} editMode />, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: mockNativeFilters },
      dataMask: {},
    },
  });

  const resizable = screen.getByTestId('mock-resizable-container');
  expect(resizable).toHaveAttribute('data-adjustable-height', 'true');
  expect(resizable).toHaveAttribute('data-adjustable-width', 'false');

  const draggable = screen.getByTestId('mock-draggable');
  expect(draggable).toHaveAttribute('data-orientation', 'row');
});

test('configures resizable container for both width and height adjustment when inside ROW', () => {
  const rowProps = {
    ...defaultProps,
    parentComponent: {
      ...newComponentFactory(ROW_TYPE),
      id: 'ROW-1',
      children: ['FILTER-1'],
    },
  };

  render(<FilterHolder {...rowProps} editMode />, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: mockNativeFilters },
      dataMask: {},
    },
  });

  const resizable = screen.getByTestId('mock-resizable-container');
  expect(resizable).toHaveAttribute('data-adjustable-height', 'true');
  expect(resizable).toHaveAttribute('data-adjustable-width', 'true');

  const draggable = screen.getByTestId('mock-draggable');
  expect(draggable).toHaveAttribute('data-orientation', 'column');
});

test('renders drag handle, settings, and delete button in edit mode', () => {
  render(<FilterHolder {...defaultProps} editMode />, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: mockNativeFilters },
      dataMask: {},
    },
  });

  expect(screen.getByTestId('drag')).toBeInTheDocument();
  expect(screen.getByTestId('setting')).toBeInTheDocument();
  expect(screen.getByLabelText('Delete component')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Filter settings' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('Filter settings')).not.toBeInTheDocument();
});

test('settings IconButton exposes an accessible name without visible label text', () => {
  render(<FilterHolder {...defaultProps} editMode />, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: mockNativeFilters },
      dataMask: {},
    },
  });

  expect(
    screen.getByRole('button', { name: 'Filter settings' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('Filter settings')).not.toBeInTheDocument();
});

test('strips validateStatus before dispatching updateDataMask in instant mode', () => {
  const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
  const boundProps = {
    ...defaultProps,
    component: {
      ...defaultProps.component,
      meta: {
        ...defaultProps.component.meta,
        filterId: 'native-filter-1',
        applyMode: 'instant',
      },
    },
  };

  render(<FilterHolder {...boundProps} editMode={false} />, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: mockNativeFilters },
      dataMask: {},
    },
  });

  fireEvent.click(screen.getByTestId('mock-filter-control'));

  expect(updateDataMaskSpy).toHaveBeenCalledWith(
    'native-filter-1',
    expect.objectContaining({
      filterState: { value: ['USA'], validateStatus: undefined },
    }),
  );
  updateDataMaskSpy.mockRestore();
});

test('manual mode: stages value without dispatching until Apply is clicked', () => {
  const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
  const manualProps = {
    ...defaultProps,
    component: {
      ...defaultProps.component,
      meta: {
        ...defaultProps.component.meta,
        filterId: 'native-filter-1',
        applyMode: 'manual',
      },
    },
  };

  render(<FilterHolder {...manualProps} editMode={false} />, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: mockNativeFilters },
      dataMask: {},
    },
  });

  const applyBtn = screen.getByRole('button', { name: 'Apply' });
  expect(applyBtn).toBeDisabled();

  // Click control to stage value
  fireEvent.click(screen.getByTestId('mock-filter-control'));
  expect(updateDataMaskSpy).not.toHaveBeenCalled();
  expect(applyBtn).not.toBeDisabled();

  // Click Apply
  fireEvent.click(applyBtn);
  expect(updateDataMaskSpy).toHaveBeenCalledWith(
    'native-filter-1',
    expect.objectContaining({
      filterState: { value: ['USA'], validateStatus: undefined },
    }),
  );
  updateDataMaskSpy.mockRestore();
});

test('manual mode: clicking Clear stages clear without dispatching until Apply is clicked', () => {
  const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
  const manualProps = {
    ...defaultProps,
    component: {
      ...defaultProps.component,
      meta: {
        ...defaultProps.component.meta,
        filterId: 'native-filter-1',
        applyMode: 'manual',
      },
    },
  };

  render(<FilterHolder {...manualProps} editMode={false} />, {
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

  const clearBtn = screen.getByRole('button', { name: 'Clear' });
  const applyBtn = screen.getByRole('button', { name: 'Apply' });
  expect(clearBtn).not.toBeDisabled();
  expect(applyBtn).toBeDisabled();

  // Click Clear: should NOT dispatch to Redux immediately
  fireEvent.click(clearBtn);
  expect(updateDataMaskSpy).not.toHaveBeenCalled();
  expect(applyBtn).not.toBeDisabled();
  expect(clearBtn).toBeDisabled();

  // Click Apply: commits the clear to Redux
  fireEvent.click(applyBtn);
  expect(updateDataMaskSpy).toHaveBeenCalledWith(
    'native-filter-1',
    expect.objectContaining({
      filterState: { value: null },
    }),
  );
  updateDataMaskSpy.mockRestore();
});

test('excludes dividers and non-native-filters from available filter options', () => {
  const filtersWithDivider = {
    'divider-1': {
      id: 'divider-1',
      title: 'Divider Section',
      type: NativeFilterType.Divider,
    },
  };

  render(<FilterHolder {...defaultProps} editMode />, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: filtersWithDivider },
      dataMask: {},
    },
  });

  expect(
    screen.getByText('No native filters configured. Add a filter first.'),
  ).toBeInTheDocument();
  expect(screen.queryByText('Divider Section')).not.toBeInTheDocument();
});

test('does not treat divider as valid filter when filterId points to divider', () => {
  const filtersWithDivider = {
    'divider-1': {
      id: 'divider-1',
      title: 'Divider Section',
      type: NativeFilterType.Divider,
    },
  };
  const dividerBoundProps = {
    ...defaultProps,
    component: {
      ...defaultProps.component,
      meta: {
        ...defaultProps.component.meta,
        filterId: 'divider-1',
      },
    },
  };

  render(<FilterHolder {...dividerBoundProps} editMode={false} />, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: filtersWithDivider },
      dataMask: {},
    },
  });

  expect(screen.queryByTestId('mock-filter-control')).not.toBeInTheDocument();
  expect(screen.getByText('Filter not configured')).toBeInTheDocument();
});

test('manual mode: required filter cannot be cleared and committed via Apply', () => {
  const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
  const requiredFilters = {
    'required-filter-1': {
      id: 'required-filter-1',
      name: 'Required Filter',
      type: NativeFilterType.NativeFilter,
      filterType: 'filter_select',
      targets: [{ datasetId: 1, column: { name: 'country' } }],
      defaultDataMask: {},
      controlValues: { enableEmptyFilter: true },
    },
  };
  const requiredProps = {
    ...defaultProps,
    component: {
      ...defaultProps.component,
      meta: {
        ...defaultProps.component.meta,
        filterId: 'required-filter-1',
        applyMode: 'manual',
      },
    },
  };

  render(<FilterHolder {...requiredProps} editMode={false} />, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: requiredFilters },
      dataMask: {
        'required-filter-1': {
          filterState: { value: ['USA'] },
        },
      },
    },
  });

  const clearBtn = screen.getByRole('button', { name: 'Clear' });
  const applyBtn = screen.getByRole('button', { name: 'Apply' });
  expect(clearBtn).not.toBeDisabled();
  expect(applyBtn).toBeDisabled();

  // Click Clear: should stage clear with error, and Apply MUST remain disabled
  fireEvent.click(clearBtn);
  expect(updateDataMaskSpy).not.toHaveBeenCalled();
  expect(applyBtn).toBeDisabled();

  // Now click control to select a valid value ('USA')
  fireEvent.click(screen.getByTestId('mock-filter-control'));
  expect(applyBtn).not.toBeDisabled();

  // Click Apply: commits to Redux and strips validateStatus
  fireEvent.click(applyBtn);
  expect(updateDataMaskSpy).toHaveBeenCalledWith(
    'required-filter-1',
    expect.objectContaining({
      filterState: { value: ['USA'], validateStatus: undefined },
    }),
  );
  updateDataMaskSpy.mockRestore();
});
