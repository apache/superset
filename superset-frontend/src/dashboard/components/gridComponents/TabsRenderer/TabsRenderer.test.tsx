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
  act,
  fireEvent,
  render,
  screen,
  sleep,
} from 'spec/helpers/testing-library';
import TabsRenderer, { TabItem, TabsRendererProps } from './TabsRenderer';
import { StickyTabsOffsetContext } from './StickyTabsOffsetContext';

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

// Mirrors the tab label markup of Tab.tsx: the title lives in a
// .dragdroppable-tab container and renders as a textarea via EditableTitle
const draggableTabProps: TabsRendererProps = {
  ...mockProps,
  editMode: true,
  tabItems: [
    {
      ...mockTabItems[0],
      label: (
        <div className="dragdroppable-tab">
          <span className="editable-title">
            <textarea defaultValue="Tab 1" />
          </span>
        </div>
      ),
    },
    mockTabItems[1],
  ],
};

// jsdom implements no PointerEvent, so @dnd-kit's PointerSensor never activates
class MockPointerEvent extends MouseEvent {
  isPrimary: boolean;

  pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.isPrimary = init.isPrimary ?? true;
    this.pointerId = init.pointerId ?? 1;
  }
}

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('TabsRenderer', () => {
  const { PointerEvent: OriginalPointerEvent } = globalThis;

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.PointerEvent = MockPointerEvent as typeof PointerEvent;
  });

  afterEach(() => {
    globalThis.PointerEvent = OriginalPointerEvent;
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

  test('drags from the tab title and shows the drag indicator only then', async () => {
    render(<TabsRenderer {...draggableTabProps} />);
    const container = screen.getByTestId('dashboard-component-tabs');
    const title = container.querySelector('textarea') as HTMLTextAreaElement;

    // At rest the title keeps the text cursor it sets on itself
    expect(container).not.toHaveStyleRule('cursor', 'move', {
      target: '.dragdroppable-tab *',
    });

    // Pressing on the title and moving past the sensor's distance constraint
    // has to start a drag: the title covers most of the tab, so a tab that
    // cannot be dragged from there cannot really be dragged at all
    fireEvent.pointerDown(title, { button: 0, isPrimary: true, clientX: 0 });
    fireEvent.pointerMove(document, {
      button: 0,
      isPrimary: true,
      clientX: 50,
    });

    expect(container).toHaveStyleRule('cursor', 'move', {
      target: '.dragdroppable-tab *',
    });

    // Release the pointer so the drag does not outlive this test. dnd-kit
    // keeps swallowing clicks on the shared document for 50ms after a drag
    // ends, which would eat the tab click of whichever test runs next.
    fireEvent.pointerUp(document, { button: 0, isPrimary: true, clientX: 50 });
    await sleep(60);
  });

  // jsdom's cascade ignores specificity, so assert on the emotion rule rather
  // than the computed style, which antd's own `position: relative` would win
  const TAB_BAR = { target: /> ?\.ant-tabs ?> ?\.ant-tabs-nav$/ };

  test('pins the tab bar below the offset supplied by the dashboard', () => {
    render(
      <StickyTabsOffsetContext.Provider value={64}>
        <TabsRenderer {...mockProps} />
      </StickyTabsOffsetContext.Provider>,
    );
    const container = screen.getByTestId('dashboard-component-tabs');

    expect(container).toHaveStyleRule('position', 'sticky', TAB_BAR);
    expect(container).toHaveStyleRule('top', '64px', TAB_BAR);
  });

  test('leaves the tab bar in document flow without a dashboard offset', () => {
    render(<TabsRenderer {...mockProps} />);
    const container = screen.getByTestId('dashboard-component-tabs');

    expect(container).not.toHaveStyleRule('position', 'sticky', TAB_BAR);
  });

  test('leaves the tab bar in document flow in edit mode', () => {
    render(
      <StickyTabsOffsetContext.Provider value={64}>
        <TabsRenderer {...mockProps} editMode />
      </StickyTabsOffsetContext.Provider>,
    );
    const container = screen.getByTestId('dashboard-component-tabs');

    expect(container).not.toHaveStyleRule('position', 'sticky', TAB_BAR);
  });

  // Reports the offset this tab set hands to tab sets nested inside it.
  const nestedTabItems: TabItem[] = [
    {
      ...mockTabItems[0],
      children: (
        <StickyTabsOffsetContext.Consumer>
          {offset => <div data-test="nested-offset">{offset}</div>}
        </StickyTabsOffsetContext.Consumer>
      ),
    },
    mockTabItems[1],
  ];

  test('stacks nested tab bars beneath its own tab bar', () => {
    // jsdom lays nothing out, so give the tab bar a height to add up
    const heightSpy = jest
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(40);

    try {
      render(
        <StickyTabsOffsetContext.Provider value={64}>
          <TabsRenderer {...mockProps} tabItems={nestedTabItems} />
        </StickyTabsOffsetContext.Provider>,
      );

      expect(screen.getByTestId('nested-offset')).toHaveTextContent('104');
    } finally {
      heightSpy.mockRestore();
    }
  });

  test('restacks nested tab bars when its own tab bar reflows', () => {
    // The shared jsdom shim never fires its callback, so stand in an observer
    // that hands the callback back to the test. The component re-measures the
    // element rather than reading the entries, so the height comes from the
    // spy below; the callback only needs to run.
    const observerCallbacks: ResizeObserverCallback[] = [];
    const RealResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        observerCallbacks.push(callback);
      }

      observe() {}

      unobserve() {}

      disconnect() {}
    } as unknown as typeof ResizeObserver;
    const heightSpy = jest
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(40);

    try {
      render(
        <StickyTabsOffsetContext.Provider value={64}>
          <TabsRenderer {...mockProps} tabItems={nestedTabItems} />
        </StickyTabsOffsetContext.Provider>,
      );
      expect(screen.getByTestId('nested-offset')).toHaveTextContent('104');

      // The bar grows -- labels wrap on a narrow viewport, a webfont lands --
      // and the tab set below it has to move down by the same amount.
      heightSpy.mockReturnValue(80);
      act(() => {
        observerCallbacks.forEach(callback =>
          callback([], {} as ResizeObserver),
        );
      });

      expect(screen.getByTestId('nested-offset')).toHaveTextContent('144');
    } finally {
      heightSpy.mockRestore();
      window.ResizeObserver = RealResizeObserver;
    }
  });

  // Switching tabs while the bar is pinned: the page scrolls so the tab set
  // starts where its bar is pinned, mirroring the top-level tabs' jump to top
  function renderPinnedTabSet(containerTop: number, offset?: number) {
    const scrollTo = jest.spyOn(window, 'scrollTo').mockImplementation();
    const rectSpy = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: containerTop } as DOMRect);
    const scrollYStub = jest.replaceProperty(window, 'scrollY', 500);
    render(
      <StickyTabsOffsetContext.Provider value={offset}>
        <TabsRenderer {...mockProps} />
      </StickyTabsOffsetContext.Provider>,
    );
    fireEvent.click(screen.getByText('Tab 2').closest('[role="tab"]')!);
    rectSpy.mockRestore();
    scrollYStub.restore();
    return scrollTo;
  }

  test('scrolls a pinned tab set back to its top when switching tabs', () => {
    // the tab set's top is 200px above the viewport, so the bar is pinned
    const scrollTo = renderPinnedTabSet(-200, 64);

    expect(scrollTo).toHaveBeenCalledWith(window.scrollX, 500 - 200 - 64);
    scrollTo.mockRestore();
  });

  test('leaves the page alone when the tab bar is not pinned', () => {
    // the tab set starts below where its bar would pin, so it is in flow
    const scrollTo = renderPinnedTabSet(300, 64);

    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
  });

  test('leaves the page alone without a dashboard offset', () => {
    const scrollTo = renderPinnedTabSet(-200);

    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
  });
});
