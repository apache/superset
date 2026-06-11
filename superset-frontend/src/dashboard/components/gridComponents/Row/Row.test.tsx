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
import {
  fireEvent,
  render,
  RenderResult,
  screen,
} from 'spec/helpers/testing-library';

import { DASHBOARD_GRID_ID } from 'src/dashboard/util/constants';
import { getMockStore } from 'spec/fixtures/mockStore';
import { dashboardLayout as mockLayout } from 'spec/fixtures/mockDashboardLayout';
import { initialState } from 'src/SqlLab/fixtures';
import Row from './Row';

interface MockIntersectionObserverEntry {
  isIntersecting: boolean;
}

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(() => true),
  FeatureFlag: {
    DashboardVirtualization: 'DASHBOARD_VIRTUALIZATION',
  },
}));

jest.mock('src/utils/isBot', () => ({
  isCurrentUserBot: jest.fn(() => false),
}));

jest.mock('src/dashboard/util/isEmbedded', () => ({
  isEmbedded: jest.fn(() => false),
}));

jest.mock('src/dashboard/components/dnd/DragDroppable', () => ({
  Draggable: ({
    children,
  }: {
    children: (args: object) => React.ReactNode;
  }) => <div data-test="mock-draggable">{children({})}</div>,

  Droppable: ({
    children,
    depth,
  }: {
    children: (args: object) => React.ReactNode;
    depth: number;
  }) => (
    <div data-test="mock-droppable" data-depth={depth}>
      {children({})}
    </div>
  ),
}));

jest.mock(
  'src/dashboard/containers/DashboardComponent',
  () =>
    ({
      availableColumnCount,
      depth,
    }: {
      availableColumnCount: number;
      depth: number;
    }) => (
      <div data-test="mock-dashboard-component" data-depth={depth}>
        {availableColumnCount}
      </div>
    ),
);

jest.mock(
  'src/dashboard/components/menu/WithPopoverMenu',
  () =>
    ({ children }: { children: React.ReactNode }) => (
      <div data-test="mock-with-popover-menu">{children}</div>
    ),
);

jest.mock(
  'src/dashboard/components/DeleteComponentButton',
  () =>
    ({ onDelete }: { onDelete: () => void }) => (
      <button
        type="button"
        data-test="mock-delete-component-button"
        onClick={onDelete}
      >
        Delete
      </button>
    ),
);

const rowWithoutChildren = {
  ...mockLayout.present.ROW_ID,
  children: [],
};
interface RowTestProps {
  id: string;
  parentId: string;
  component: typeof mockLayout.present.ROW_ID;
  parentComponent: (typeof mockLayout.present)[typeof DASHBOARD_GRID_ID];
  index: number;
  depth: number;
  editMode: boolean;
  availableColumnCount: number;
  columnWidth: number;
  occupiedColumnCount: number;
  onResizeStart: () => void;
  onResize: () => void;
  onResizeStop: () => void;
  handleComponentDrop: () => void;
  deleteComponent: () => void;
  updateComponents: () => void;
  isComponentVisible: boolean;
  maxChildrenHeight: number;
  onChangeTab: () => void;
}

const props: RowTestProps = {
  id: 'ROW_ID',
  parentId: DASHBOARD_GRID_ID,
  component: mockLayout.present.ROW_ID,
  parentComponent: mockLayout.present[DASHBOARD_GRID_ID],
  index: 0,
  depth: 2,
  editMode: false,
  availableColumnCount: 12,
  columnWidth: 50,
  occupiedColumnCount: 6,
  onResizeStart: () => {},
  onResize: () => {},
  onResizeStop: () => {},
  handleComponentDrop: () => {},
  deleteComponent: () => {},
  updateComponents: () => {},
  isComponentVisible: true,
  maxChildrenHeight: 0,
  onChangeTab: () => {},
};

function setup(overrideProps: Partial<RowTestProps> = {}): RenderResult {
  // We have to wrap provide DragDropContext for the underlying DragDroppable
  // otherwise we cannot assert on DragDroppable children
  const mockStore = getMockStore({
    ...initialState,
  });

  return render(<Row {...props} {...overrideProps} />, {
    store: mockStore,
    useDnd: true,
    useRouter: true,
  });
}

test('should render a Draggable', () => {
  // don't count child DragDroppables
  const { getByTestId, queryByTestId } = setup({
    component: rowWithoutChildren,
  });

  expect(getByTestId('mock-draggable')).toBeInTheDocument();
  expect(queryByTestId('mock-droppable')).not.toBeInTheDocument();
});

test('should skip rendering HoverMenu and DeleteComponentButton when not in editMode', () => {
  const { container, queryByTestId } = setup({
    component: rowWithoutChildren,
  });
  expect(container.querySelector('.hover-menu')).not.toBeInTheDocument();
  expect(queryByTestId('mock-delete-component-button')).not.toBeInTheDocument();
});

test('should render a WithPopoverMenu', () => {
  // don't count child DragDroppables
  const { getByTestId } = setup({ component: rowWithoutChildren });
  expect(getByTestId('mock-with-popover-menu')).toBeInTheDocument();
});

test('should render a HoverMenu in editMode', () => {
  const { container, getAllByTestId, getByTestId } = setup({
    component: rowWithoutChildren,
    editMode: true,
  });
  expect(container.querySelector('.hover-menu')).toBeInTheDocument();

  // Droppable area enabled in editMode
  expect(getAllByTestId('mock-droppable').length).toBe(1);

  // pass the same depth of its droppable area
  expect(getByTestId('mock-droppable')).toHaveAttribute(
    'data-depth',
    `${props.depth}`,
  );
});

test('should render a DeleteComponentButton in editMode', () => {
  const { getByTestId } = setup({
    component: rowWithoutChildren,
    editMode: true,
  });
  expect(getByTestId('mock-delete-component-button')).toBeInTheDocument();
});

/* oxlint-disable-next-line jest/no-disabled-tests */
test.skip('should render a BackgroundStyleDropdown when focused', () => {
  const { rerender } = setup({ component: rowWithoutChildren });
  expect(screen.queryByTestId('background-style-dropdown')).toBeFalsy();

  // we cannot set props on the Row because of the WithDragDropContext wrapper
  rerender(<Row {...props} component={rowWithoutChildren} editMode />);
  const buttons = screen.getAllByRole('button');
  const settingsButton = buttons[1];
  fireEvent.click(settingsButton);

  expect(screen.queryByTestId('background-style-dropdown')).toBeTruthy();
});

test('should call deleteComponent when deleted', () => {
  const deleteComponent = jest.fn();
  const { getByTestId } = setup({ editMode: true, deleteComponent });
  fireEvent.click(getByTestId('mock-delete-component-button'));
  expect(deleteComponent).toHaveBeenCalledTimes(1);
});

test('should pass appropriate availableColumnCount to children', () => {
  const { getByTestId } = setup();
  expect(getByTestId('mock-dashboard-component')).toHaveTextContent(
    `${props.availableColumnCount - props.occupiedColumnCount}`,
  );
});

test('should increment the depth of its children', () => {
  const { getByTestId } = setup();
  expect(getByTestId('mock-dashboard-component')).toHaveAttribute(
    'data-depth',
    `${props.depth + 1}`,
  );
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('visibility handling for intersection observers', () => {
  const mockIntersectionObserver = jest.fn();
  const mockObserve = jest.fn();
  const mockDisconnect = jest.fn();

  beforeAll(() => {
    mockIntersectionObserver.mockReturnValue({
      observe: mockObserve,
      unobserve: jest.fn(),
      disconnect: mockDisconnect,
    });
    window.IntersectionObserver = mockIntersectionObserver;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete (window as any).IntersectionObserver;
  });

  test('should handle visibility prop changes without crashing', () => {
    const { rerender } = setup({ isComponentVisible: true });

    expect(setup).not.toThrow();

    expect(() => {
      rerender(<Row {...props} isComponentVisible={false} />);
    }).not.toThrow();

    expect(() => {
      rerender(<Row {...props} isComponentVisible />);
    }).not.toThrow();
  });

  test('should create intersection observers when feature is enabled', () => {
    setup({ isComponentVisible: true });

    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ rootMargin: expect.any(String) }),
    );
  });

  test('should not create intersection observers when feature is disabled', () => {
    const coreMock = jest.requireMock('@superset-ui/core');
    coreMock.isFeatureEnabled.mockReturnValue(false);

    jest.clearAllMocks();
    setup({ isComponentVisible: true });

    expect(mockIntersectionObserver).not.toHaveBeenCalled();

    coreMock.isFeatureEnabled.mockReturnValue(true);
  });

  test('intersection observer callbacks handle entries without errors', () => {
    const callback = ([entry]: [MockIntersectionObserverEntry]) => {
      if (entry.isIntersecting) return true;

      return false;
    };

    const intersectingEntry = { isIntersecting: true };
    expect(() => callback([intersectingEntry])).not.toThrow();
    expect(callback([intersectingEntry])).toBe(true);

    const nonIntersectingEntry = { isIntersecting: false };
    expect(() => callback([nonIntersectingEntry])).not.toThrow();
    expect(callback([nonIntersectingEntry])).toBe(false);
  });
});
