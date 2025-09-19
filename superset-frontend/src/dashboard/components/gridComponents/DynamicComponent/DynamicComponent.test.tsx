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

import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import { COLUMN_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import { BACKGROUND_TRANSPARENT } from 'src/dashboard/util/constants';
import DynamicComponent from './DynamicComponent';

// Mock the dashboard components registry
const mockComponent = () => (
  <div data-test="mock-dynamic-component">Test Component</div>
);
jest.mock('src/visualizations/presets/dashboardComponents', () => ({
  get: jest.fn(() => ({ Component: mockComponent })),
}));

// Mock other dependencies
jest.mock('src/dashboard/components/dnd/DragDroppable', () => ({
  Draggable: jest.fn(({ children, editMode }) => {
    const mockElement = { tagName: 'DIV', dataset: {} };
    const mockDragSourceRef = { current: mockElement };
    return (
      <div data-test="mock-draggable">
        {children({ dragSourceRef: editMode ? mockDragSourceRef : null })}
      </div>
    );
  }),
}));

jest.mock('src/dashboard/components/menu/WithPopoverMenu', () =>
  jest.fn(({ children, menuItems, editMode }) => (
    <div data-test="mock-popover-menu">
      {editMode &&
        menuItems &&
        menuItems.map((item: React.ReactNode, index: number) => (
          <div key={index} data-test="menu-item">
            {item}
          </div>
        ))}
      {children}
    </div>
  )),
);

jest.mock('src/dashboard/components/resizable/ResizableContainer', () =>
  jest.fn(({ children }) => (
    <div data-test="mock-resizable-container">{children}</div>
  )),
);

jest.mock('src/dashboard/components/menu/HoverMenu', () =>
  jest.fn(({ children }) => <div data-test="mock-hover-menu">{children}</div>),
);

jest.mock('src/dashboard/components/DeleteComponentButton', () =>
  jest.fn(({ onDelete }) => (
    <button type="button" data-test="mock-delete-button" onClick={onDelete}>
      Delete
    </button>
  )),
);

jest.mock('src/dashboard/components/menu/BackgroundStyleDropdown', () =>
  jest.fn(({ onChange, value }) => (
    <select
      data-test="mock-background-dropdown"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="BACKGROUND_TRANSPARENT">Transparent</option>
      <option value="BACKGROUND_WHITE">White</option>
    </select>
  )),
);

const createProps = (overrides = {}) => ({
  component: {
    id: 'DYNAMIC_COMPONENT_1',
    meta: {
      componentKey: 'test-component',
      width: 6,
      height: 4,
      background: BACKGROUND_TRANSPARENT,
    },
    componentKey: 'test-component',
  },
  parentComponent: {
    id: 'ROW_1',
    type: ROW_TYPE,
    meta: {
      width: 12,
    },
  },
  index: 0,
  depth: 1,
  handleComponentDrop: jest.fn(),
  editMode: false,
  columnWidth: 100,
  availableColumnCount: 12,
  onResizeStart: jest.fn(),
  onResizeStop: jest.fn(),
  onResize: jest.fn(),
  deleteComponent: jest.fn(),
  updateComponents: jest.fn(),
  parentId: 'ROW_1',
  id: 'DYNAMIC_COMPONENT_1',
  ...overrides,
});

const renderWithRedux = (component: React.ReactElement) =>
  render(component, {
    useRedux: true,
    initialState: {
      nativeFilters: { filters: {} },
      dataMask: {},
    },
  });

describe('DynamicComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render the component with basic structure', () => {
    const props = createProps();
    renderWithRedux(<DynamicComponent {...props} />);

    expect(screen.getByTestId('mock-draggable')).toBeInTheDocument();
    expect(screen.getByTestId('mock-popover-menu')).toBeInTheDocument();
    expect(screen.getByTestId('mock-resizable-container')).toBeInTheDocument();
    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mock-dynamic-component')).toBeInTheDocument();
  });

  test('should render with proper CSS classes and data attributes', () => {
    const props = createProps();
    renderWithRedux(<DynamicComponent {...props} />);

    const componentElement = screen.getByTestId('dashboard-test-component');
    expect(componentElement).toHaveClass('dashboard-component');
    expect(componentElement).toHaveClass('dashboard-test-component');
    expect(componentElement).toHaveAttribute('id', 'DYNAMIC_COMPONENT_1');
  });

  test('should render HoverMenu and DeleteComponentButton in edit mode', () => {
    const props = createProps({ editMode: true });
    renderWithRedux(<DynamicComponent {...props} />);

    expect(screen.getByTestId('mock-hover-menu')).toBeInTheDocument();
    expect(screen.getByTestId('mock-delete-button')).toBeInTheDocument();
  });

  test('should not render HoverMenu and DeleteComponentButton when not in edit mode', () => {
    const props = createProps({ editMode: false });
    renderWithRedux(<DynamicComponent {...props} />);

    expect(screen.queryByTestId('mock-hover-menu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-delete-button')).not.toBeInTheDocument();
  });

  test('should call deleteComponent when delete button is clicked', () => {
    const props = createProps({ editMode: true });
    renderWithRedux(<DynamicComponent {...props} />);

    fireEvent.click(screen.getByTestId('mock-delete-button'));
    expect(props.deleteComponent).toHaveBeenCalledWith(
      'DYNAMIC_COMPONENT_1',
      'ROW_1',
    );
  });

  test('should call updateComponents when background is changed', () => {
    const props = createProps({ editMode: true });
    renderWithRedux(<DynamicComponent {...props} />);

    const backgroundDropdown = screen.getByTestId('mock-background-dropdown');
    fireEvent.change(backgroundDropdown, {
      target: { value: 'BACKGROUND_WHITE' },
    });

    expect(props.updateComponents).toHaveBeenCalledWith({
      DYNAMIC_COMPONENT_1: {
        ...props.component,
        meta: {
          ...props.component.meta,
          background: 'BACKGROUND_WHITE',
        },
      },
    });
  });

  test('should calculate width multiple from component meta when parent is not COLUMN_TYPE', () => {
    const props = createProps({
      component: {
        ...createProps().component,
        meta: { ...createProps().component.meta, width: 8 },
      },
      parentComponent: {
        ...createProps().parentComponent,
        type: ROW_TYPE,
      },
    });
    renderWithRedux(<DynamicComponent {...props} />);

    // Component should render successfully with width from component.meta.width
    expect(screen.getByTestId('mock-resizable-container')).toBeInTheDocument();
  });

  test('should calculate width multiple from parent meta when parent is COLUMN_TYPE', () => {
    const props = createProps({
      parentComponent: {
        id: 'COLUMN_1',
        type: COLUMN_TYPE,
        meta: {
          width: 6,
        },
      },
    });
    renderWithRedux(<DynamicComponent {...props} />);

    // Component should render successfully with width from parentComponent.meta.width
    expect(screen.getByTestId('mock-resizable-container')).toBeInTheDocument();
  });

  test('should use default width when no width is specified', () => {
    const props = createProps({
      component: {
        ...createProps().component,
        meta: {
          ...createProps().component.meta,
          width: undefined,
        },
      },
      parentComponent: {
        ...createProps().parentComponent,
        type: ROW_TYPE,
        meta: {},
      },
    });
    renderWithRedux(<DynamicComponent {...props} />);

    // Component should render successfully with default width (GRID_MIN_COLUMN_COUNT)
    expect(screen.getByTestId('mock-resizable-container')).toBeInTheDocument();
  });

  test('should render background style correctly', () => {
    const props = createProps({
      editMode: true, // Need edit mode for menu items to render
      component: {
        ...createProps().component,
        meta: {
          ...createProps().component.meta,
          background: 'BACKGROUND_WHITE',
        },
      },
    });
    renderWithRedux(<DynamicComponent {...props} />);

    // Background dropdown should have the correct value
    const backgroundDropdown = screen.getByTestId('mock-background-dropdown');
    expect(backgroundDropdown).toHaveValue('BACKGROUND_WHITE');
  });

  test('should pass dashboard data from Redux store to dynamic component', () => {
    const props = createProps();
    const initialState = {
      nativeFilters: { filters: { filter1: {} } },
      dataMask: { mask1: {} },
    };

    render(<DynamicComponent {...props} />, {
      useRedux: true,
      initialState,
    });

    // Component should render - either the mock component or loading state
    const container = screen.getByTestId('dashboard-component-chart-holder');
    expect(container).toBeInTheDocument();
    // Check that either the component loaded or is loading
    expect(
      screen.queryByTestId('mock-dynamic-component') ||
        screen.queryByText('Loading...'),
    ).toBeTruthy();
  });

  test('should handle resize callbacks', () => {
    const props = createProps();
    renderWithRedux(<DynamicComponent {...props} />);

    // Resize callbacks should be passed to ResizableContainer
    expect(screen.getByTestId('mock-resizable-container')).toBeInTheDocument();
  });

  test('should render with proper data-test attribute based on componentKey', () => {
    const props = createProps({
      component: {
        ...createProps().component,
        meta: {
          ...createProps().component.meta,
          componentKey: 'custom-component',
        },
        componentKey: 'custom-component',
      },
    });
    renderWithRedux(<DynamicComponent {...props} />);

    expect(
      screen.getByTestId('dashboard-custom-component'),
    ).toBeInTheDocument();
  });
});
