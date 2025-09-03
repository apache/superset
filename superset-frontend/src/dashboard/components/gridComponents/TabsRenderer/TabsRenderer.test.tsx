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

    expect(screen.getByTestId('nav-list')).toBeInTheDocument();

    rerender(<TabsRenderer {...mockProps} tabBarPaddingLeft={0} />);
    expect(screen.getByTestId('nav-list')).toBeInTheDocument();
  });

  test('calls handleClickTab when tab is clicked', () => {
    render(<TabsRenderer {...mockProps} />);
    expect(mockProps.handleClickTab).not.toHaveBeenCalled();
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

    const hoverMenuElements = document.querySelectorAll('.hover-menu');
    expect(hoverMenuElements.length).toBeGreaterThan(0);
  });

  test('hides hover menu when not in edit mode', () => {
    const viewModeProps: TabsRendererProps = {
      ...mockProps,
      editMode: false,
      renderHoverMenu: true,
    };

    render(<TabsRenderer {...viewModeProps} />);

    const hoverMenuElements = document.querySelectorAll('.hover-menu');
    expect(hoverMenuElements).toHaveLength(0);
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

    const hoverMenuElements = document.querySelectorAll('.hover-menu');
    expect(hoverMenuElements).toHaveLength(0);
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

  test('memoization works correctly', () => {
    const { rerender } = render(<TabsRenderer {...mockProps} />);

    rerender(<TabsRenderer {...mockProps} />);

    const tabsContainer = screen.getByTestId('dashboard-component-tabs');
    expect(tabsContainer).toBeInTheDocument();
  });
});
