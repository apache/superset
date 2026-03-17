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

import {
  fireEvent,
  render,
  screen,
  waitFor,
  userEvent,
} from 'spec/helpers/testing-library';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import { EditableTitle } from '@superset-ui/core/components';
import { setEditMode, onRefresh } from 'src/dashboard/actions/dashboardState';

import type { FC } from 'react';
import ActualTab from './Tab';
import Markdown from '../Markdown';

// Cast to loosely-typed component to avoid needing every required prop in test mocks
const Tab = ActualTab as unknown as FC<Record<string, unknown>>;

jest.mock('src/dashboard/util/getChartIdsFromComponent', () =>
  jest.fn(() => []),
);

jest.mock('src/dashboard/containers/DashboardComponent', () =>
  jest.fn(() => <div data-test="DashboardComponent" />),
);
jest.mock('@superset-ui/core/components/EditableTitle', () => ({
  __esModule: true,
  EditableTitle: jest.fn(props => (
    <button type="button" data-test="EditableTitle" onClick={props.onSaveTitle}>
      {props.title}
    </button>
  )),
}));

jest.mock('src/dashboard/components/dnd/DragDroppable', () => ({
  ...jest.requireActual('src/dashboard/components/dnd/DragDroppable'),
  Droppable: jest.fn(props => {
    const childProps = props.editMode
      ? {
          dragSourceRef: props.dragSourceRef,
          dropIndicatorProps: props.dropIndicatorProps,
        }
      : {};
    const handleClick = () => {
      if (props.onDrop) {
        // Create a mock dropResult based on the component props
        const dropResult = {
          source: {
            id: 'MARKDOWN-1',
            type: 'MARKDOWN',
            index: 0,
          },
          dragging: {
            id: 'MARKDOWN-1',
            type: 'MARKDOWN',
            meta: {},
          },
          destination: {
            id: props.component?.id || '',
            type: props.component?.type || '',
            index: props.index ?? 0,
          },
        };
        props.onDrop(dropResult);
      }
    };
    return (
      <div>
        <button type="button" data-test="MockDroppable" onClick={handleClick}>
          DragDroppable
        </button>
        {props.children(childProps)}
      </div>
    );
  }),
}));
jest.mock('src/dashboard/actions/dashboardState', () => ({
  setEditMode: jest.fn(() => ({
    type: 'SET_EDIT_MODE',
  })),
  onRefresh: jest.fn(() => ({
    type: 'ON_REFRESH',
  })),
}));

const createProps = () => ({
  id: 'TAB-YT6eNksV-',
  parentId: 'TABS-L-d9eyOE-b',
  depth: 2,
  index: 1,
  renderType: 'RENDER_TAB_CONTENT',
  availableColumnCount: 12,
  columnWidth: 120,
  isFocused: false,
  component: {
    children: ['ROW-DR80aHJA2c', 'ROW--BIzjz9F0'],
    id: 'TAB-YT6eNksV-',
    meta: { text: '🚀 Aspiring Developers' },
    parents: ['ROOT_ID', 'GRID_ID', 'TABS-L-d9eyOE-b'],
    type: 'TAB',
  },
  parentComponent: {
    children: ['TAB-AsMaxdYL_t', 'TAB-YT6eNksV-', 'TAB-l_9I0aNYZ'],
    id: 'TABS-L-d9eyOE-b',
    meta: {},
    parents: ['ROOT_ID', 'GRID_ID'],
    type: 'TABS',
  },
  editMode: false,
  embeddedMode: false,
  undoLength: 0,
  redoLength: 0,
  filters: {},
  directPathToChild: ['ROOT_ID', 'GRID_ID', 'TABS-L-d9eyOE-b', 'TAB-YT6eNksV-'],
  directPathLastUpdated: 1617374760080,
  dashboardId: 23,
  focusedFilterScope: null,
  isComponentVisible: true,
  onDropOnTab: jest.fn(),
  handleComponentDrop: jest.fn(),
  updateComponents: jest.fn(),
  setDirectPathToChild: jest.fn(),
  onResizeStart: jest.fn(),
  onResize: jest.fn(),
  onResizeStop: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('Render tab (no content)', () => {
  const props = createProps();
  props.renderType = 'RENDER_TAB';
  const { getByTestId } = render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
  });
  expect(screen.getByText('🚀 Aspiring Developers')).toBeInTheDocument();
  expect(EditableTitle).toHaveBeenCalledTimes(1);
  expect(getByTestId('dragdroppable-object')).toBeInTheDocument();
});

test('Render tab (no content) editMode:true', () => {
  const props = createProps();
  props.editMode = true;
  props.renderType = 'RENDER_TAB';
  const { getByTestId } = render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
  });
  expect(screen.getByText('🚀 Aspiring Developers')).toBeInTheDocument();
  expect(EditableTitle).toHaveBeenCalledTimes(1);
  expect(getByTestId('dragdroppable-object')).toBeInTheDocument();
});

test('Drop on a tab', async () => {
  const props = createProps();
  const mockOnDropOnTab = jest.fn();
  render(
    <>
      <Tab {...props} renderType="RENDER_TAB" editMode />
      <Tab
        {...props}
        renderType="RENDER_TAB"
        index={2}
        component={{
          ...props.component,
          id: 'TAB-Next-',
          meta: { text: 'Next Tab' } as any,
        }}
        handleComponentDrop={mockOnDropOnTab}
        editMode
      />
      <Markdown
        id="MARKDOWN-1"
        parentId="GRID_ID"
        parentComponent={
          {
            id: 'GRID_ID',
            type: 'GRID',
            parents: ['ROOT_ID'],
            children: [],
            meta: {},
          } as any
        }
        depth={0}
        editMode
        index={1}
        availableColumnCount={12}
        columnWidth={120}
        component={{
          ...props.component,
          type: 'MARKDOWN',
          id: 'MARKDOWN-1',
          meta: { code: 'Dashboard Component' } as any,
        }}
        logEvent={jest.fn()}
        deleteComponent={jest.fn()}
        handleComponentDrop={jest.fn()}
        onResizeStart={jest.fn()}
        onResize={jest.fn()}
        onResizeStop={jest.fn()}
        updateComponents={jest.fn()}
        addDangerToast={jest.fn()}
      />
    </>,
    {
      useRedux: true,
      useDnd: true,
    },
  );

  fireEvent.dragStart(screen.getByText('🚀 Aspiring Developers'));
  fireEvent.drop(screen.getByText('Next Tab'));
  await waitFor(() => expect(mockOnDropOnTab).toHaveBeenCalled());
  expect(mockOnDropOnTab).toHaveBeenCalledWith(
    expect.objectContaining({
      destination: { id: props.parentComponent.id, index: 2, type: 'TABS' },
    }),
  );

  fireEvent.dragStart(screen.getByText('Dashboard Component'));
  fireEvent.dragOver(screen.getByText('Next Tab'));
  await waitFor(() =>
    expect(screen.getByTestId('title-drop-indicator')).toBeVisible(),
  );
  fireEvent.drop(screen.getByText('Next Tab'));
  await waitFor(() => expect(mockOnDropOnTab).toHaveBeenCalledTimes(2));
  expect(mockOnDropOnTab).toHaveBeenLastCalledWith(
    expect.objectContaining({
      destination: {
        id: 'TAB-Next-',
        index: props.component.children.length,
        type: 'TAB',
      },
    }),
  );
});

test('Edit table title', () => {
  const props = createProps();
  props.editMode = true;
  props.renderType = 'RENDER_TAB';
  const { getByTestId } = render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
  });

  expect(EditableTitle).toHaveBeenCalledTimes(1);
  expect(getByTestId('dragdroppable-object')).toBeInTheDocument();

  expect(props.updateComponents).not.toHaveBeenCalled();
  userEvent.click(screen.getByText('🚀 Aspiring Developers'));
  expect(props.updateComponents).toHaveBeenCalled();
});

test('Render tab (with content)', () => {
  const props = createProps();
  props.isFocused = true;
  const { queryByTestId } = render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
  });
  expect(DashboardComponent).toHaveBeenCalledTimes(2);
  expect(DashboardComponent).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      availableColumnCount: 12,
      columnWidth: 120,
      depth: 2,
      id: 'ROW-DR80aHJA2c',
      index: 0,
      isComponentVisible: true,
      onChangeTab: expect.any(Function),
      onDrop: expect.any(Function),
      onResize: expect.any(Function),
      onResizeStart: expect.any(Function),
      onResizeStop: expect.any(Function),
      parentId: 'TAB-YT6eNksV-',
    }),
    {},
  );
  expect(DashboardComponent).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      availableColumnCount: 12,
      columnWidth: 120,
      depth: 2,
      id: 'ROW--BIzjz9F0',
      index: 1,
      isComponentVisible: true,
      onChangeTab: expect.any(Function),
      onDrop: expect.any(Function),
      onResize: expect.any(Function),
      onResizeStart: expect.any(Function),
      onResizeStop: expect.any(Function),
      parentId: 'TAB-YT6eNksV-',
    }),
    {},
  );
  expect(queryByTestId('dragdroppable-object')).not.toBeInTheDocument();
});

test('Render tab content with no children', () => {
  const props = createProps();
  props.component.children = [];
  render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
  });
  expect(
    screen.getByText('There are no components added to this tab'),
  ).toBeVisible();
  expect(screen.getByRole('img', { name: 'empty' })).toBeVisible();
  expect(screen.queryByText('edit mode')).not.toBeInTheDocument();
});

test('Render tab content with no children, canEdit: true', () => {
  const props = createProps();
  props.component.children = [];
  render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
    initialState: {
      dashboardInfo: {
        dash_edit_perm: true,
      },
    },
  });
  expect(screen.getByText('edit mode')).toBeVisible();
  userEvent.click(screen.getByRole('button', { name: 'edit mode' }));
  expect(setEditMode).toHaveBeenCalled();
});

test('Render tab (with content) editMode:true', () => {
  const props = createProps();
  props.isFocused = true;
  props.editMode = true;
  const { getAllByTestId } = render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
  });
  expect(DashboardComponent).toHaveBeenCalledTimes(2);
  expect(DashboardComponent).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      availableColumnCount: 12,
      columnWidth: 120,
      depth: 2,
      id: 'ROW-DR80aHJA2c',
      index: 0,
      isComponentVisible: true,
      onChangeTab: expect.any(Function),
      onDrop: expect.any(Function),
      onResize: expect.any(Function),
      onResizeStart: expect.any(Function),
      onResizeStop: expect.any(Function),
      parentId: 'TAB-YT6eNksV-',
    }),
    {},
  );
  expect(DashboardComponent).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      availableColumnCount: 12,
      columnWidth: 120,
      depth: 2,
      id: 'ROW--BIzjz9F0',
      index: 1,
      isComponentVisible: true,
      onChangeTab: expect.any(Function),
      onDrop: expect.any(Function),
      onResize: expect.any(Function),
      onResizeStart: expect.any(Function),
      onResizeStop: expect.any(Function),
      parentId: 'TAB-YT6eNksV-',
    }),
    {},
  );
  // 3 droppable area exists for two child components
  expect(getAllByTestId('MockDroppable')).toHaveLength(3);
});

test('Should call "handleDrop" and "handleTopDropTargetDrop"', () => {
  const props = createProps();
  props.isFocused = true;
  props.editMode = true;
  const { getAllByTestId, rerender } = render(
    <Tab {...props} component={{ ...props.component, children: [] }} />,
    {
      useRedux: true,
      useDnd: true,
    },
  );

  expect(props.handleComponentDrop).not.toHaveBeenCalled();
  userEvent.click(getAllByTestId('MockDroppable')[0]);
  expect(props.handleComponentDrop).toHaveBeenCalledTimes(1);
  expect(props.onDropOnTab).not.toHaveBeenCalled();
  rerender(<Tab {...props} />);
  userEvent.click(getAllByTestId('MockDroppable')[1]);
  expect(props.onDropOnTab).toHaveBeenCalledTimes(1);
  expect(props.handleComponentDrop).toHaveBeenCalledTimes(2);
});

test('Render tab content with no children, editMode: true, canEdit: true', () => {
  const props = createProps();
  props.editMode = true;
  // props.canEdit = true;
  props.component.children = [];
  render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
    initialState: {
      dashboardInfo: {
        dash_edit_perm: true,
      },
    },
  });
  expect(screen.queryByTestId('emptystate-drop-indicator')).toBeInTheDocument();
  expect(
    screen.getByText('Drag and drop components to this tab'),
  ).toBeVisible();
  expect(screen.getByRole('img', { name: 'empty' })).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'create a new chart' }),
  ).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'create a new chart' }),
  ).toHaveAttribute('href', '/chart/add?dashboard_id=23');
});

test('Drag to empty state, editMode: true, canEdit: true', async () => {
  const props = createProps();
  props.editMode = true;
  props.component.children = [];
  const mockHandleComponentDrop = jest.fn();
  props.handleComponentDrop = mockHandleComponentDrop;

  render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
    initialState: {
      dashboardInfo: {
        dash_edit_perm: true,
      },
    },
  });

  const emptyStateIndicator = screen.getByTestId('emptystate-drop-indicator');
  expect(emptyStateIndicator).toBeInTheDocument();

  const mockDroppableButtons = screen.getAllByTestId('MockDroppable');
  expect(mockDroppableButtons).toHaveLength(2);

  // Click the MockDroppable button that wraps the empty state indicator (index 1)
  // This simulates dropping a component on the empty state
  userEvent.click(mockDroppableButtons[1]);

  // Verify that handleComponentDrop was called with correct destination
  await waitFor(() => {
    expect(mockHandleComponentDrop).toHaveBeenCalled();
  });

  expect(mockHandleComponentDrop).toHaveBeenCalledWith(
    expect.objectContaining({
      destination: {
        id: props.component.id,
        index: 0,
        type: 'TAB',
      },
    }),
  );
});

test('AnchorLink renders in view mode', () => {
  const props = createProps();
  props.renderType = 'RENDER_TAB';

  render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
  });

  expect(screen.queryByTestId('anchor-link')).toBeInTheDocument();
});

test('AnchorLink does not render in edit mode', () => {
  const props = createProps();
  props.editMode = true;
  props.renderType = 'RENDER_TAB';

  render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
  });

  expect(screen.queryByTestId('anchor-link')).not.toBeInTheDocument();
});

test('AnchorLink does not render in embedded mode', () => {
  const props = createProps();
  props.embeddedMode = true;
  props.renderType = 'RENDER_TAB';

  render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
  });

  expect(screen.queryByTestId('anchor-link')).not.toBeInTheDocument();
});

test('Should refresh charts when tab becomes active after dashboard refresh', async () => {
  jest.clearAllMocks();
  const getChartIdsFromComponent = require('src/dashboard/util/getChartIdsFromComponent');
  getChartIdsFromComponent.mockReturnValue([101, 102]);

  const props = createProps();
  props.renderType = 'RENDER_TAB_CONTENT';
  props.isComponentVisible = false;

  const initialState = {
    dashboardState: {
      lastRefreshTime: Date.now() - 5000, // Dashboard was refreshed 5 seconds ago
      tabActivationTimes: {
        'TAB-YT6eNksV-': Date.now() - 10000, // Tab was activated 10 seconds ago (before refresh)
      },
    },
    dashboardInfo: {
      id: 23,
      dash_edit_perm: true,
    },
  };

  const { rerender } = render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
    initialState,
  });

  // onRefresh should not be called when tab is not visible
  expect(onRefresh).not.toHaveBeenCalled();

  // Make tab visible - this should trigger refresh since lastRefreshTime > tabActivationTime
  rerender(<Tab {...props} isComponentVisible />);

  // Wait for the refresh to be triggered after the delay
  await waitFor(
    () => {
      expect(onRefresh).toHaveBeenCalled();
    },
    { timeout: 500 },
  );

  expect(onRefresh).toHaveBeenCalledWith(
    [101, 102], // Chart IDs from the tab
    true, // Force refresh
    0, // Interval
    23, // Dashboard ID
    false, // skipFiltersRefresh
    true, // isLazyLoad flag
  );
});

test('Should not refresh charts when tab becomes active if no dashboard refresh occurred', async () => {
  jest.clearAllMocks();
  const getChartIdsFromComponent = require('src/dashboard/util/getChartIdsFromComponent');
  getChartIdsFromComponent.mockReturnValue([101]);

  const props = createProps();
  props.renderType = 'RENDER_TAB_CONTENT';
  props.isComponentVisible = false;

  const currentTime = Date.now();
  const initialState = {
    dashboardState: {
      lastRefreshTime: currentTime - 10000, // Dashboard was refreshed 10 seconds ago
      tabActivationTimes: {
        'TAB-YT6eNksV-': currentTime - 5000, // Tab was activated 5 seconds ago (after refresh)
      },
    },
    dashboardInfo: {
      id: 23,
      dash_edit_perm: true,
    },
  };

  const { rerender } = render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
    initialState,
  });

  // Make tab visible - should NOT trigger refresh since tabActivationTime > lastRefreshTime
  rerender(<Tab {...props} isComponentVisible />);

  // Wait a bit to ensure no refresh is triggered
  await new Promise(resolve => setTimeout(resolve, 200));

  expect(onRefresh).not.toHaveBeenCalled();
});

test('Should not cause infinite refresh loop with nested tabs - regression test', async () => {
  jest.clearAllMocks();
  const getChartIdsFromComponent = require('src/dashboard/util/getChartIdsFromComponent');
  getChartIdsFromComponent.mockReset();
  getChartIdsFromComponent.mockReturnValue([201, 202]);

  const props = createProps();
  props.renderType = 'RENDER_TAB_CONTENT';
  props.isComponentVisible = false;

  const initialState = {
    dashboardState: {
      lastRefreshTime: Date.now() - 1000, // Dashboard was refreshed recently
      tabActivationTimes: {
        'TAB-YT6eNksV-': Date.now() - 5000, // Tab was activated before refresh
      },
    },
    dashboardInfo: {
      id: 23,
      dash_edit_perm: true,
    },
  };

  const { rerender } = render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
    initialState,
  });

  // Initial state - no refresh should happen
  expect(onRefresh).not.toHaveBeenCalled();

  // Make tab visible - should trigger ONE refresh
  rerender(<Tab {...props} isComponentVisible />);

  await waitFor(
    () => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    },
    { timeout: 500 },
  );

  // Clear the mock to track subsequent calls
  jest.clearAllMocks();

  // REGRESSION TEST: Multiple re-renders should NOT trigger additional refreshes
  // This simulates the infinite loop scenario that was happening with nested tabs
  for (let i = 0; i < 5; i += 1) {
    rerender(<Tab {...props} isComponentVisible />);
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  expect(onRefresh).not.toHaveBeenCalled();
});

test('Should use isLazyLoad flag for tab refreshes', async () => {
  jest.clearAllMocks();
  const getChartIdsFromComponent = require('src/dashboard/util/getChartIdsFromComponent');
  getChartIdsFromComponent.mockReset();
  getChartIdsFromComponent.mockReturnValue([401, 402]);

  const props = createProps();
  props.renderType = 'RENDER_TAB_CONTENT';
  props.isComponentVisible = true;

  const initialState = {
    dashboardState: {
      lastRefreshTime: Date.now() - 1000, // Dashboard was refreshed recently
      tabActivationTimes: {
        'TAB-YT6eNksV-': Date.now() - 5000, // Tab was activated before refresh
      },
    },
    dashboardInfo: {
      id: 42,
      dash_edit_perm: true,
    },
  };

  render(<Tab {...props} />, {
    useRedux: true,
    useDnd: true,
    initialState,
  });

  // Tab should trigger refresh with isLazyLoad = true
  await waitFor(
    () => {
      expect(onRefresh).toHaveBeenCalled();
    },
    { timeout: 500 },
  );

  // Verify that isLazyLoad flag is set to true for tab refreshes
  expect(onRefresh).toHaveBeenCalledWith(
    [401, 402],
    true, // force
    0, // interval
    42, // dashboardId
    false, // skipFiltersRefresh
    true, // isLazyLoad should be true to prevent infinite loops
  );
});
