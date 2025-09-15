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
  useRef,
} from 'react';
import { styled } from '@superset-ui/core';
import {
  LineEditableTabs,
  TabsProps as AntdTabsProps,
} from '@superset-ui/core/components/Tabs';
import {
  useDrag,
  useDrop,
  DragSourceMonitor,
  DropTargetMonitor,
} from 'react-dnd';
import HoverMenu from '../../menu/HoverMenu';
import DragHandle from '../../dnd/DragHandle';
import DeleteComponentButton from '../../DeleteComponentButton';

const StyledTabsContainer = styled.div`
  width: 100%;
  background-color: ${({ theme }) => theme.colorBgContainer};

  & .dashboard-component-tabs-content {
    height: 100%;
  }

  & > .hover-menu:hover {
    opacity: 1;
  }

  &.dragdroppable-row .dashboard-component-tabs-content {
    height: calc(100% - 47px);
  }
`;

export interface TabItem {
  key: string;
  label: ReactElement;
  closeIcon: ReactElement;
  children: ReactElement;
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
}

interface DragItem {
  type: string;
  id: string;
  index: number;
}

interface DragCollectedProps {
  isDragging: boolean;
}

interface DropCollectedProps {
  handlerId: string | symbol | null;
}

interface DraggableTabNodeProps {
  id: string;
  index: number;
  children: React.ReactElement;
  onMoveTab: (dragIndex: number, hoverIndex: number) => void;
}

const DraggableTabNode: React.FC<DraggableTabNodeProps> = ({
  id,
  index,
  children,
  onMoveTab,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastHoveredIndex = useRef<number | null>(null);

  const [{ handlerId }, drop] = useDrop<DragItem, void, DropCollectedProps>({
    accept: 'DASHBOARD_TAB',
    collect: (monitor: DropTargetMonitor) => ({
      handlerId: monitor.getHandlerId(),
    }),
    hover: (item: DragItem, monitor) => {
      if (!ref.current) {
        return;
      }

      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      // Prevent rapid back-and-forth swapping
      if (lastHoveredIndex.current === hoverIndex) {
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current.getBoundingClientRect();

      // Get horizontal middle
      const hoverMiddleX =
        (hoverBoundingRect.right - hoverBoundingRect.left) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        return;
      }

      // Get pixels to the left
      const hoverClientX = clientOffset.x - hoverBoundingRect.left;

      // Only perform the move when the mouse has crossed half of the items width
      // When dragging left, only move when the cursor is past the middle
      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) {
        return;
      }

      // When dragging right, only move when the cursor is before the middle
      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) {
        return;
      }

      // Time to actually perform the action
      onMoveTab(dragIndex, hoverIndex);
      lastHoveredIndex.current = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag<DragItem, void, DragCollectedProps>({
    item: { type: 'DASHBOARD_TAB', id, index },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      // Reset the hover tracking when drag ends
      lastHoveredIndex.current = null;
    },
  });

  drag(drop(ref));

  return cloneElement(children, {
    ref,
    style: {
      ...children.props.style,
      opacity: isDragging ? 0.4 : 1,
      cursor: 'move',
    },
    'data-handler-id': handlerId,
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
  }) => {
    const handleMoveTab = useCallback(
      (dragIndex: number, hoverIndex: number) => {
        if (onTabsReorder) {
          onTabsReorder(dragIndex, hoverIndex);
        }
      },
      [onTabsReorder],
    );

    return (
      <StyledTabsContainer
        className="dashboard-component dashboard-component-tabs"
        data-test="dashboard-component-tabs"
      >
        {editMode && renderHoverMenu && tabsDragSourceRef && (
          <HoverMenu innerRef={tabsDragSourceRef} position="left">
            <DragHandle position="left" />
            <DeleteComponentButton onDelete={handleDeleteComponent} />
          </HoverMenu>
        )}

        <LineEditableTabs
          id={tabsComponent.id}
          activeKey={activeKey}
          onChange={key => {
            if (typeof key === 'string') {
              const tabIndex = tabIds.indexOf(key);
              if (tabIndex !== -1) handleClickTab(tabIndex);
            }
          }}
          onEdit={handleEdit}
          data-test="nav-list"
          type={editMode ? 'editable-card' : 'card'}
          items={tabItems}
          tabBarStyle={{ paddingLeft: tabBarPaddingLeft }}
          renderTabBar={
            editMode
              ? (tabBarProps, DefaultTabBar) => (
                  <DefaultTabBar {...tabBarProps}>
                    {(node: React.ReactElement) => {
                      const index = tabItems.findIndex(
                        item => item.key === node.key,
                      );
                      return (
                        <DraggableTabNode
                          key={node.key}
                          id={node.key as string}
                          index={index}
                          onMoveTab={handleMoveTab}
                        >
                          {node}
                        </DraggableTabNode>
                      );
                    }}
                  </DefaultTabBar>
                )
              : undefined
          }
        />
      </StyledTabsContainer>
    );
  },
);

TabsRenderer.displayName = 'TabsRenderer';

export default TabsRenderer;
