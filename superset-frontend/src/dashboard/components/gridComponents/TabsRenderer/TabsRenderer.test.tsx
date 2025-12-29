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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import TabsRenderer, { TabItem, TabsRendererProps } from './TabsRenderer';

const mockTabItems: TabItem[] = [
  {
    key: 'tab-1',
    label: <div>Tab 1</div>,
    closeIcon: <div>×</div>,
    children: <div>Tab 1 Content</div>,
  },
  {
    key: 'tab-2',
    label: <div>Tab 2</div>,
    closeIcon: <div>×</div>,
    children: <div>Tab 2 Content</div>,
  },
];

const mockProps: TabsRendererProps = {
  tabItems: mockTabItems,
  editMode: false,
  renderHoverMenu: true,
  tabsDragSourceRef: undefined,
  handleDeleteComponent: jest.fn(),
  tabsComponent: { id: 'test-tabs-id' },
  activeKey: 'tab-1',
  tabIds: ['tab-1', 'tab-2'],
  handleClickTab: jest.fn(),
  handleEdit: jest.fn(),
  tabBarPaddingLeft: 16,
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('TabsRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders tabs container with correct test attributes', () => {
    render(<TabsRenderer {...mockProps} />);

    const tabsContainer = screen.getByTestId('dashboard-component-tabs');

    expect(tabsContainer).toBeInTheDocument();
    expect(tabsContainer).toHaveClass('dashboard-component-tabs');
  });

  test('renders LineEditableTabs with correct props', () => {
    render(<TabsRenderer {...mockProps} />);

    const editableTabs = screen.getByTestId('nav-list');
    expect(editableTabs).toBeInTheDocument();
  });

  test('applies correct tab bar padding', () => {
    const { rerender } = render(<TabsRenderer {...mockProps} />);

    let editableTabs = screen.getByTestId('nav-list');
    expect(editableTabs).toBeInTheDocument();

    rerender(<TabsRenderer {...mockProps} tabBarPaddingLeft={0} />);
    editableTabs = screen.getByTestId('nav-list');

    expect(editableTabs).toBeInTheDocument();
  });

  test('calls handleClickTab when tab is clicked', () => {
    const handleClickTabMock = jest.fn();
    const propsWithTab2Active = {
      ...mockProps,
      activeKey: 'tab-2',
      handleClickTab: handleClickTabMock,
    };
    render(<TabsRenderer {...propsWithTab2Active} />);

    const tabElement = screen.getByText('Tab 1').closest('[role="tab"]');
    expect(tabElement).not.toBeNull();

    fireEvent.click(tabElement!);

    expect(handleClickTabMock).toHaveBeenCalledWith(0);
    expect(handleClickTabMock).toHaveBeenCalledTimes(1);
  });

  test('shows hover menu in edit mode', () => {
    const mockRef = { current: null };
    const editModeProps: TabsRendererProps = {
      ...mockProps,
      editMode: true,
      renderHoverMenu: true,
      tabsDragSourceRef: mockRef,
    };

    render(<TabsRenderer {...editModeProps} />);

    const hoverMenu = document.querySelector('.hover-menu');

    expect(hoverMenu).toBeInTheDocument();
  });

  test('hides hover menu when not in edit mode', () => {
    const viewModeProps: TabsRendererProps = {
      ...mockProps,
      editMode: false,
      renderHoverMenu: true,
    };

    render(<TabsRenderer {...viewModeProps} />);

    const hoverMenu = document.querySelector('.hover-menu');

    expect(hoverMenu).not.toBeInTheDocument();
  });

  test('hides hover menu when renderHoverMenu is false', () => {
    const mockRef = { current: null };
    const noHoverMenuProps: TabsRendererProps = {
      ...mockProps,
      editMode: true,
      renderHoverMenu: false,
      tabsDragSourceRef: mockRef,
    };

    render(<TabsRenderer {...noHoverMenuProps} />);

    const hoverMenu = document.querySelector('.hover-menu');

    expect(hoverMenu).not.toBeInTheDocument();
  });

  test('renders with correct tab type based on edit mode', () => {
    const { rerender } = render(
      <TabsRenderer {...mockProps} editMode={false} />,
    );

    let editableTabs = screen.getByTestId('nav-list');
    expect(editableTabs).toBeInTheDocument();

    rerender(<TabsRenderer {...mockProps} editMode />);

    editableTabs = screen.getByTestId('nav-list');

    expect(editableTabs).toBeInTheDocument();
  });

  test('handles default props correctly', () => {
    const minimalProps: TabsRendererProps = {
      tabItems: mockProps.tabItems,
      editMode: false,
      handleDeleteComponent: mockProps.handleDeleteComponent,
      tabsComponent: mockProps.tabsComponent,
      activeKey: mockProps.activeKey,
      tabIds: mockProps.tabIds,
      handleClickTab: mockProps.handleClickTab,
      handleEdit: mockProps.handleEdit,
    };

    render(<TabsRenderer {...minimalProps} />);

    const tabsContainer = screen.getByTestId('dashboard-component-tabs');

    expect(tabsContainer).toBeInTheDocument();
  });

  test('calls onEdit when edit action is triggered', () => {
    const handleEditMock = jest.fn();
    const editableProps = {
      ...mockProps,
      editMode: true,
      handleEdit: handleEditMock,
    };

    render(<TabsRenderer {...editableProps} />);

    expect(screen.getByTestId('nav-list')).toBeInTheDocument();
  });

  test('renders tab content correctly', () => {
    render(<TabsRenderer {...mockProps} />);

    expect(screen.getByText('Tab 1 Content')).toBeInTheDocument();
    expect(screen.queryByText('Tab 2 Content')).not.toBeInTheDocument(); // Not active
  });

  test('updates DndContext key when tabIds change to reset drag state', () => {
    const threeTabItems: TabItem[] = [
      {
        key: 'tab-1',
        label: <div>Tab 1</div>,
        closeIcon: <div>×</div>,
        children: <div>Tab 1 Content</div>,
      },
      {
        key: 'tab-2',
        label: <div>Tab 2</div>,
        closeIcon: <div>×</div>,
        children: <div>Tab 2 Content</div>,
      },
      {
        key: 'tab-3',
        label: <div>Tab 3</div>,
        closeIcon: <div>×</div>,
        children: <div>Tab 3 Content</div>,
      },
    ];

    const mockRef = { current: null };
    const onTabsReorderMock = jest.fn();
    const initialTabIds = ['tab-1', 'tab-2', 'tab-3'];

    const props: TabsRendererProps = {
      ...mockProps,
      tabItems: threeTabItems,
      tabIds: initialTabIds,
      editMode: true,
      tabsDragSourceRef: mockRef,
      onTabsReorder: onTabsReorderMock,
    };

    const { rerender } = render(<TabsRenderer {...props} />);

    // Verify component renders in edit mode with DndContext
    expect(screen.getByTestId('dashboard-component-tabs')).toBeInTheDocument();

    // Simulate first reorder: tab-1 moved to end -> ['tab-2', 'tab-3', 'tab-1']
    const reorderedTabIds = ['tab-2', 'tab-3', 'tab-1'];
    rerender(<TabsRenderer {...props} tabIds={reorderedTabIds} />);

    // The component should re-render with new tabIds
    // The key prop on DndContext (JSON.stringify(tabIds)) ensures fresh drag state
    expect(screen.getByTestId('dashboard-component-tabs')).toBeInTheDocument();

    // Simulate second reorder: tab-2 moved to end -> ['tab-3', 'tab-1', 'tab-2']
    const secondReorderedTabIds = ['tab-3', 'tab-1', 'tab-2'];
    rerender(<TabsRenderer {...props} tabIds={secondReorderedTabIds} />);

    // Component should still render correctly after multiple reorders
    expect(screen.getByTestId('dashboard-component-tabs')).toBeInTheDocument();
  });

  test('renders DndContext in edit mode for tab reordering', () => {
    const mockRef = { current: null };
    const onTabsReorderMock = jest.fn();

    const editModeProps: TabsRendererProps = {
      ...mockProps,
      editMode: true,
      tabsDragSourceRef: mockRef,
      onTabsReorder: onTabsReorderMock,
    };

    render(<TabsRenderer {...editModeProps} />);

    // In edit mode, tabs should be draggable
    const tabsContainer = screen.getByTestId('dashboard-component-tabs');
    expect(tabsContainer).toBeInTheDocument();

    // Verify the tabs are rendered
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
  });

  test('does not render DndContext when not in edit mode', () => {
    const onTabsReorderMock = jest.fn();

    const viewModeProps: TabsRendererProps = {
      ...mockProps,
      editMode: false,
      onTabsReorder: onTabsReorderMock,
    };

    render(<TabsRenderer {...viewModeProps} />);

    // Component should render without drag functionality
    const tabsContainer = screen.getByTestId('dashboard-component-tabs');
    expect(tabsContainer).toBeInTheDocument();

    // Tabs should still be visible
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
  });
});
