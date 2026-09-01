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
  cloneElement,
  memo,
  ReactElement,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { styled } from '@apache-superset/core/theme';
import {
  LineEditableTabs,
  TabsProps as AntdTabsProps,
} from '@superset-ui/core/components/Tabs';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  DndContext,
  PointerSensor,
  useSensor,
  closestCenter,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable';
import HoverMenu from '../../menu/HoverMenu';
import DragHandle from '../../dnd/DragHandle';
import DeleteComponentButton from '../../DeleteComponentButton';
import { StickyTabsOffsetContext } from './StickyTabsOffsetContext';

// @z-index-above-dashboard-charts: above chart content, below the sticky
// dashboard header (99) and the filter bar (11)
const STICKY_TAB_BAR_Z_INDEX = 10;

const StyledTabsContainer = styled.div<{
  isDragging?: boolean;
  stickyTop?: number;
}>`
  width: 100%;
  background-color: ${({ theme }) => theme.colorBgContainer};

  /* Pin this component's own tab bar (direct child only, so nested tab
     sets keep their own offsets) below the sticky dashboard header while
     its content scrolls. */
  ${({ theme, stickyTop }) =>
    stickyTop !== undefined &&
    css`
      & > .ant-tabs > .ant-tabs-nav {
        position: sticky;
        top: ${stickyTop}px;
        z-index: ${STICKY_TAB_BAR_Z_INDEX};
        background-color: ${theme.colorBgContainer};
      }
    `}

  & .dashboard-component-tabs-content {
    height: 100%;
  }

  & > .hover-menu:hover {
    opacity: 1;
  }

  &.dragdroppable-row .dashboard-component-tabs-content {
    height: calc(100% - 47px);
  }

  /* Ensure tab labels maintain full opacity during drag */
  .ant-tabs-tab {
    .dragdroppable-tab,
    .editable-title,
    textarea {
      opacity: 1;
      color: inherit;
    }
  }

  ${({ isDragging }) =>
    isDragging &&
    `
    /* Show the drag indicator during drag, over the tab title textarea too.
       The doubled parent outranks the title's own cursor; a single & loses. */
    && .dragdroppable-tab * {
      cursor: move;
    }

    /* Hide ink-bar during drag */
    .ant-tabs-card > .ant-tabs-nav .ant-tabs-ink-bar,
    .ant-tabs > .ant-tabs-nav .ant-tabs-ink-bar {
      display: none !important;
    }
  `}
`;

export interface TabItem {
  key: string;
  label: ReactElement;
  closeIcon: ReactElement;
  children?: ReactElement;
  /** Force-render the tab panel even when inactive (used in print mode). */
  forceRender?: boolean;
}

export interface TabsComponent {
  id: string;
}

export interface TabsRendererProps {
  tabItems: TabItem[];
  editMode: boolean;
  renderHoverMenu?: boolean;
  tabsDragSourceRef?: RefObject<HTMLDivElement>;
  handleDeleteComponent: () => void;
  tabsComponent: TabsComponent;
  activeKey: string;
  tabIds: string[];
  handleClickTab: (index: number) => void;
  handleEdit: AntdTabsProps['onEdit'];
  tabBarPaddingLeft?: number;
  onTabsReorder?: (oldIndex: number, newIndex: number) => void;
  isEditingTabTitle?: boolean;
  onTabTitleEditingChange?: (isEditing: boolean) => void;
}

interface DraggableTabNodeProps extends React.HTMLAttributes<HTMLDivElement> {
  'data-node-key': string;
  disabled?: boolean;
}

const DraggableTabNode: React.FC<Readonly<DraggableTabNodeProps>> = ({
  disabled = false,
  ...props
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props['data-node-key'],
    disabled,
  });

  const style: React.CSSProperties = {
    ...props.style,
    position: 'relative',
    transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
    transition: isDragging ? 'none' : transition,
    cursor: disabled ? 'default' : 'move',
    zIndex: isDragging ? 1000 : 'auto',
    opacity: 1,
  };

  return cloneElement(props.children as React.ReactElement, {
    ref: setNodeRef,
    style,
    ...attributes,
    ...(disabled ? {} : listeners),
  });
};

/**
 * TabsRenderer component handles the rendering of dashboard tabs
 * Extracted from the main Tabs component for better separation of concerns
 */
const TabsRenderer = memo<TabsRendererProps>(
  ({
    tabItems,
    editMode,
    renderHoverMenu = true,
    tabsDragSourceRef,
    handleDeleteComponent,
    tabsComponent,
    activeKey,
    tabIds,
    handleClickTab,
    handleEdit,
    tabBarPaddingLeft = 0,
    onTabsReorder,
    isEditingTabTitle = false,
  }) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    // Sticky tab bars only apply in view mode: while editing, drag-and-drop
    // targets and hover menus are positioned against the tab bar's place in
    // document flow.
    const parentStickyOffset = useContext(StickyTabsOffsetContext);
    const stickyTop = editMode ? undefined : parentStickyOffset;
    const containerRef = useRef<HTMLDivElement>(null);
    const [tabBarHeight, setTabBarHeight] = useState(0);

    // Keyed on whether the bar is pinned rather than on the offset itself:
    // the header re-measuring on every resize would otherwise tear down and
    // recreate the observer in every tab set on the page.
    const isPinned = stickyTop !== undefined;
    useEffect(() => {
      // Direct-child selector, so nested tab sets' bars are never matched.
      const tabBar = isPinned
        ? containerRef.current?.querySelector<HTMLElement>(
            ':scope > .ant-tabs > .ant-tabs-nav',
          )
        : null;
      if (!tabBar) {
        return undefined;
      }
      const measure = () => setTabBarHeight(tabBar.offsetHeight);
      measure();
      // Matches the sticky header's own guard in DashboardBuilder, for
      // environments without ResizeObserver: the bar still pins, it just
      // keeps the height measured at mount.
      if (!global.hasOwnProperty('ResizeObserver')) {
        return undefined;
      }
      const observer = new ResizeObserver(measure);
      observer.observe(tabBar);
      return () => observer.disconnect();
    }, [isPinned]);

    // Tabs nested inside this one stack their bar beneath ours.
    const childStickyOffset =
      stickyTop === undefined ? undefined : stickyTop + tabBarHeight;

    // Counterpart of the top-level tabs, which scroll the page to the top on
    // every switch (DashboardBuilder.handleChangeTab). With this bar pinned,
    // a switch would otherwise land the reader partway down the new tab's
    // content; bring the tab set back to where its bar is pinned instead.
    const scrollPinnedTabSetToTop = () => {
      if (stickyTop === undefined || !containerRef.current) {
        return;
      }
      const { top } = containerRef.current.getBoundingClientRect();
      if (top < stickyTop) {
        window.scrollTo(window.scrollX, window.scrollY + top - stickyTop);
      }
    };

    // Use ref to always have access to the current tabIds in callbacks
    const tabIdsRef = useRef(tabIds);
    tabIdsRef.current = tabIds;

    const sensor = useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    });

    const onDragStart = useCallback((event: any) => {
      setActiveId(event.active.id);
    }, []);

    const onDragEnd = useCallback(
      ({ active, over }: DragEndEvent) => {
        const currentTabIds = tabIdsRef.current;
        // Only reorder when we have a valid drop target and both IDs are found
        if (active.id !== over?.id && onTabsReorder) {
          const activeIndex = currentTabIds.findIndex(id => id === active.id);
          const overIndex = currentTabIds.findIndex(id => id === over?.id);
          if (activeIndex !== -1 && overIndex !== -1) {
            onTabsReorder(activeIndex, overIndex);
          }
        }
        setActiveId(null);
      },
      [onTabsReorder],
    );

    const onDragCancel = useCallback(() => {
      setActiveId(null);
    }, []);

    const isDragging = activeId !== null;

    return (
      <StyledTabsContainer
        ref={containerRef}
        className="dashboard-component dashboard-component-tabs"
        data-test="dashboard-component-tabs"
        isDragging={isDragging}
        stickyTop={stickyTop}
      >
        {editMode && renderHoverMenu && tabsDragSourceRef && (
          <HoverMenu innerRef={tabsDragSourceRef} position="left">
            <DragHandle position="left" />
            <DeleteComponentButton onDelete={handleDeleteComponent} />
          </HoverMenu>
        )}

        <StickyTabsOffsetContext.Provider value={childStickyOffset}>
          <LineEditableTabs
            id={tabsComponent.id}
            activeKey={activeKey}
            onChange={key => {
              if (typeof key === 'string') {
                const tabIndex = tabIds.indexOf(key);
                if (tabIndex !== -1) {
                  handleClickTab(tabIndex);
                  scrollPinnedTabSetToTop();
                }
              }
            }}
            onEdit={handleEdit}
            data-test="nav-list"
            type={editMode ? 'editable-card' : 'card'}
            items={tabItems}
            tabBarStyle={{ paddingLeft: tabBarPaddingLeft }}
            fullHeight
            {...(editMode && {
              renderTabBar: (tabBarProps, DefaultTabBar) => (
                <DndContext
                  key={tabIds.join('-')}
                  sensors={[sensor]}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragCancel={onDragCancel}
                  collisionDetection={closestCenter}
                >
                  <SortableContext
                    items={tabIds}
                    strategy={horizontalListSortingStrategy}
                  >
                    <DefaultTabBar {...tabBarProps}>
                      {(node: React.ReactElement) => (
                        <DraggableTabNode
                          {...(
                            node as React.ReactElement<DraggableTabNodeProps>
                          ).props}
                          key={node.key}
                          data-node-key={node.key as string}
                          disabled={isEditingTabTitle}
                        >
                          {node}
                        </DraggableTabNode>
                      )}
                    </DefaultTabBar>
                  </SortableContext>
                </DndContext>
              ),
            })}
          />
        </StickyTabsOffsetContext.Provider>
      </StyledTabsContainer>
    );
  },
);

TabsRenderer.displayName = 'TabsRenderer';

export default TabsRenderer;
