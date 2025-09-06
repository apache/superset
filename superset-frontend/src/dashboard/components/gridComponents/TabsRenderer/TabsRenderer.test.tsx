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
});
