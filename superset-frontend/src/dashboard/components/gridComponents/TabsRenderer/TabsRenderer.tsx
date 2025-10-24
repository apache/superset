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
import { memo, ReactElement, RefObject } from 'react';
import { styled } from '@superset-ui/core';
import {
  LineEditableTabs,
  TabsProps as AntdTabsProps,
} from '@superset-ui/core/components/Tabs';
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
}

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
  }) => (
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
        fullHeight
      />
    </StyledTabsContainer>
  ),
);

TabsRenderer.displayName = 'TabsRenderer';

export default TabsRenderer;
