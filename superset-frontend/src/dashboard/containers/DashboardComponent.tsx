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
import { ReactElement, useCallback, memo, useMemo } from 'react';
import { bindActionCreators } from 'redux';
import { useSelector, useDispatch } from 'react-redux';
import { logEvent } from 'src/logger/actions';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { componentLookup } from 'src/dashboard/components/gridComponents';
import getDetailedComponentWidth from 'src/dashboard/util/getDetailedComponentWidth';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { COLUMN_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  createComponent,
  deleteComponent,
  updateComponents,
  handleComponentDrop,
} from 'src/dashboard/actions/dashboardLayout';
import {
  setDirectPathToChild,
  setActiveTab,
  setFullSizeChartId,
} from 'src/dashboard/actions/dashboardState';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import type { RootState, LayoutItem } from 'src/dashboard/types';

interface DashboardComponentProps {
  id: string;
  parentId: string;
  depth?: number;
  index?: number;
  renderHoverMenu?: boolean;
  renderTabContent?: boolean;
  renderType?: string;
  onChangeTab?: (args: { pathToTabIndex: string[] }) => void;
  directPathToChild?: string[];
  directPathLastUpdated?: number;
  isComponentVisible?: boolean;
  availableColumnCount?: number;
  columnWidth?: number;
  onResizeStart?: (
    event: MouseEvent | TouchEvent,
    direction: string,
    elementRef: HTMLElement,
  ) => void;
  onResize?: (
    event: MouseEvent | TouchEvent,
    direction: string,
    elementRef: HTMLElement,
    delta: { width: number; height: number },
  ) => void;
  onResizeStop?: (
    event: MouseEvent | TouchEvent,
    direction: string,
    elementRef: HTMLElement,
    delta: { width: number; height: number },
    id: string,
  ) => void;
  isInView?: boolean;
  onDrop?: (dropResult: DropResult) => void;
  onHover?: () => void;
  onDropOnTab?: (dropResult: DropResult) => void;
  onDropPositionChange?: (dragObject: Record<string, unknown>) => void;
  onHoverTab?: () => void;
  onDragTab?: (dragComponentId: string | undefined) => void;
  isFocused?: boolean;
  isHighlighted?: boolean;
  onTabTitleEditingChange?: (isEditing: boolean) => void;
}

interface ColumnWidthResult {
  occupiedColumnCount?: number;
  minColumnWidth?: number;
}

const DashboardComponent = (
  props: DashboardComponentProps,
): ReactElement | null => {
  const dispatch = useDispatch();
  const dashboardLayout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const dashboardInfo = useSelector((state: RootState) => state.dashboardInfo);
  const editMode = useSelector(
    (state: RootState) => state.dashboardState.editMode,
  );
  const fullSizeChartId = useSelector(
    (state: RootState) => state.dashboardState.fullSizeChartId,
  );
  const dashboardId = dashboardInfo.id;
  const component = dashboardLayout[props.id];
  const parentComponent = dashboardLayout[props.parentId];
  const getComponentById = useCallback(
    (id: string): LayoutItem => dashboardLayout[id],
    [dashboardLayout],
  );
  const { isComponentVisible = true } = props;
  const filters = getActiveFilters();
  const embeddedMode = !dashboardInfo.userId;

  const boundActionCreators = useMemo(
    () =>
      bindActionCreators(
        {
          addDangerToast,
          createComponent,
          deleteComponent,
          updateComponents,
          handleComponentDrop,
          setDirectPathToChild,
          setFullSizeChartId,
          setActiveTab,
          logEvent,
        },
        dispatch,
      ),
    [dispatch],
  );

  // rows and columns need more data about their child dimensions
  // doing this allows us to not pass the entire component lookup to all Components
  const { occupiedColumnCount, minColumnWidth } =
    useMemo((): ColumnWidthResult => {
      if (component) {
        const componentType = component.type;
        if (componentType === ROW_TYPE || componentType === COLUMN_TYPE) {
          const { occupiedWidth, minimumWidth } = getDetailedComponentWidth({
            id: props.id,
            components: dashboardLayout,
          });

          if (componentType === ROW_TYPE) {
            return { occupiedColumnCount: occupiedWidth };
          }
          if (componentType === COLUMN_TYPE) {
            return { minColumnWidth: minimumWidth };
          }
        }
        return {};
      }
      return {};
    }, [component, dashboardLayout, props.id]);

  const Component = component
    ? componentLookup[component.type as keyof typeof componentLookup]
    : null;
  // Component is a union of all grid component types; TypeScript
  // cannot narrow the union here, so cast to a generic component type.
  const ResolvedComponent = Component as React.ComponentType<
    Record<string, unknown>
  > | null;
  return ResolvedComponent ? (
    <ResolvedComponent
      {...props}
      {...boundActionCreators}
      component={component}
      getComponentById={getComponentById}
      parentComponent={parentComponent}
      editMode={editMode}
      filters={filters}
      dashboardId={dashboardId}
      dashboardInfo={dashboardInfo}
      fullSizeChartId={fullSizeChartId}
      occupiedColumnCount={occupiedColumnCount}
      minColumnWidth={minColumnWidth}
      isComponentVisible={isComponentVisible}
      embeddedMode={embeddedMode}
    />
  ) : null;
};

export default memo(DashboardComponent);
