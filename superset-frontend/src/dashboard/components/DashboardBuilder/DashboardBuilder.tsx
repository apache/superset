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
/* eslint-env browser */
import cx from 'classnames';
import React, { FC, useCallback, useMemo } from 'react';
import { JsonObject, styled, css } from '@superset-ui/core';
import ErrorBoundary from 'src/components/ErrorBoundary';
import BuilderComponentPane from 'src/dashboard/components/BuilderComponentPane';
import DashboardHeader from 'src/dashboard/containers/DashboardHeader';
import Icons from 'src/components/Icons';
import IconButton from 'src/dashboard/components/IconButton';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import getDirectPathToTabIndex from 'src/dashboard/util/getDirectPathToTabIndex';
import { URL_PARAMS } from 'src/constants';
import { useDispatch, useSelector } from 'react-redux';
import { getUrlParam } from 'src/utils/urlUtils';
import { DashboardLayout, RootState } from 'src/dashboard/types';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import { useElementOnScreen } from 'src/common/hooks/useElementOnScreen';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import {
  deleteTopLevelTabs,
  handleComponentDrop,
} from 'src/dashboard/actions/dashboardLayout';
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
  DASHBOARD_ROOT_DEPTH,
  DashboardStandaloneMode,
} from 'src/dashboard/util/constants';
import FilterBar from 'src/dashboard/components/nativeFilters/FilterBar';
import Loading from 'src/components/Loading';
import { Global } from '@emotion/react';
import { shouldFocusTabs, getRootLevelTabsComponent } from './utils';
import DashboardContainer from './DashboardContainer';
import { useNativeFilters } from './state';

const MAIN_HEADER_HEIGHT = 53;
const TABS_HEIGHT = 50;
const HEADER_HEIGHT = 72;
const CLOSED_FILTER_BAR_WIDTH = 32;
const OPEN_FILTER_BAR_WIDTH = 260;
const FILTER_BAR_HEADER_HEIGHT = 80;
const FILTER_BAR_TABS_HEIGHT = 46;

type DashboardBuilderProps = {};

const StyledDiv = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto 1fr;
  flex: 1;
  /* Special cases */

  /* A row within a column has inset hover menu */
  .dragdroppable-column .dragdroppable-row .hover-menu--left {
    left: -12px;
    background: @lightest;
    border: 1px solid @gray-light;
  }

  /* A column within a column or tabs has inset hover menu */
  .dragdroppable-column .dragdroppable-column .hover-menu--top,
  .dashboard-component-tabs .dragdroppable-column .hover-menu--top {
    top: -12px;
    background: @lightest;
    border: 1px solid @gray-light;
  }

  /* move Tabs hover menu to top near actual Tabs */
  .dashboard-component-tabs > .hover-menu--left {
    top: 0;
    transform: unset;
    background: transparent;
  }

  /* push Chart actions to upper right */
  .dragdroppable-column .dashboard-component-chart-holder .hover-menu--top,
  .dragdroppable .dashboard-component-header .hover-menu--top {
    right: 8px;
    top: 8px;
    background: transparent;
    border: none;
    transform: unset;
    left: unset;
  }
  div:hover > .hover-menu-container .hover-menu,
  .hover-menu-container .hover-menu:hover {
    opacity: 1;
  }
`;

// @z-index-above-dashboard-charts + 1 = 11
const FiltersPanel = styled.div`
  grid-column: 1;
  grid-row: 1 / span 2;
  z-index: 11;
`;

const StickyPanel = styled.div<{ width: number }>`
  position: sticky;
  top: -1px;
  width: ${({ width }) => width}px;
  flex: 0 0 ${({ width }) => width}px;
`;

// @z-index-above-dashboard-popovers (99) + 1 = 100
const StyledHeader = styled.div`
  grid-column: 2;
  grid-row: 1;
  position: sticky;
  top: 0px;
  z-index: 100;
`;

const StyledContent = styled.div<{
  fullSizeChartId: number | null;
}>`
  grid-column: 2;
  grid-row: 2;
  // @z-index-above-dashboard-header (100) + 1 = 101
  ${({ fullSizeChartId }) => fullSizeChartId && `z-index: 101;`}
`;

const StyledDashboardContent = styled.div<{
  dashboardFiltersOpen: boolean;
  editMode: boolean;
}>`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  height: auto;
  flex: 1;

  .grid-container .dashboard-component-tabs {
    box-shadow: none;
    padding-left: 0;
  }

  .grid-container {
    /* without this, the grid will not get smaller upon toggling the builder panel on */
    width: 0px;
    flex: 1;
    position: relative;
    margin-top: ${({ theme }) => theme.gridUnit * 6}px;
    margin-right: ${({ theme }) => theme.gridUnit * 8}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 6}px;
    margin-left: ${({ theme, dashboardFiltersOpen, editMode }) => {
      if (!dashboardFiltersOpen && !editMode) {
        return 0;
      }
      return theme.gridUnit * 8;
    }}px;
  }

  .dashboard-component-chart-holder {
    // transitionable traits to show filter relevance
    transition: opacity ${({ theme }) => theme.transitionTiming}s,
      border-color ${({ theme }) => theme.transitionTiming}s,
      box-shadow ${({ theme }) => theme.transitionTiming}s;
    border: 0 solid transparent;
  }
`;

const DashboardBuilder: FC<DashboardBuilderProps> = () => {
  const dispatch = useDispatch();
  const dashboardLayout = useSelector<RootState, DashboardLayout>(
    state => state.dashboardLayout.present,
  );
  const editMode = useSelector<RootState, boolean>(
    state => state.dashboardState.editMode,
  );
  const directPathToChild = useSelector<RootState, string[]>(
    state => state.dashboardState.directPathToChild,
  );
  const fullSizeChartId = useSelector<RootState, number | null>(
    state => state.dashboardState.fullSizeChartId,
  );

  const handleChangeTab = useCallback(
    ({ pathToTabIndex }: { pathToTabIndex: string[] }) => {
      dispatch(setDirectPathToChild(pathToTabIndex));
    },
    [dispatch],
  );

  const handleDeleteTopLevelTabs = useCallback(() => {
    dispatch(deleteTopLevelTabs());

    const firstTab = getDirectPathToTabIndex(
      getRootLevelTabsComponent(dashboardLayout),
      0,
    );
    dispatch(setDirectPathToChild(firstTab));
  }, [dashboardLayout, dispatch]);

  const handleDrop = useCallback(
    dropResult => dispatch(handleComponentDrop(dropResult)),
    [dispatch],
  );

  const dashboardRoot = dashboardLayout[DASHBOARD_ROOT_ID];
  const rootChildId = dashboardRoot.children[0];
  const topLevelTabs =
    rootChildId !== DASHBOARD_GRID_ID
      ? dashboardLayout[rootChildId]
      : undefined;
  const StandaloneMode = getUrlParam(URL_PARAMS.standalone);
  const isReport = StandaloneMode === DashboardStandaloneMode.REPORT;
  const hideDashboardHeader =
    StandaloneMode === DashboardStandaloneMode.HIDE_NAV_AND_TITLE || isReport;

  const barTopOffset =
    (hideDashboardHeader ? 0 : HEADER_HEIGHT) +
    (topLevelTabs ? TABS_HEIGHT : 0);

  const {
    showDashboard,
    dashboardFiltersOpen,
    toggleDashboardFiltersOpen,
    nativeFiltersEnabled,
  } = useNativeFilters();

  const filterBarWidth = dashboardFiltersOpen
    ? OPEN_FILTER_BAR_WIDTH
    : CLOSED_FILTER_BAR_WIDTH;

  const [containerRef, isSticky] = useElementOnScreen<HTMLDivElement>({
    threshold: [1],
  });

  const filterSetEnabled = isFeatureEnabled(
    FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET,
  );

  const offset =
    FILTER_BAR_HEADER_HEIGHT +
    (isSticky || StandaloneMode ? 0 : MAIN_HEADER_HEIGHT) +
    (filterSetEnabled ? FILTER_BAR_TABS_HEIGHT : 0);

  const filterBarHeight = `calc(100vh - ${offset}px)`;
  const filterBarOffset = dashboardFiltersOpen ? 0 : barTopOffset + 20;

  const draggableStyle = useMemo(
    () => ({
      marginLeft: dashboardFiltersOpen || editMode ? 0 : -32,
    }),
    [dashboardFiltersOpen, editMode],
  );

  const renderDraggableContent = useCallback(
    ({ dropIndicatorProps }: { dropIndicatorProps: JsonObject }) => (
      <div>
        {!hideDashboardHeader && <DashboardHeader />}
        {dropIndicatorProps && <div {...dropIndicatorProps} />}
        {!isReport && topLevelTabs && (
          <WithPopoverMenu
            shouldFocus={shouldFocusTabs}
            menuItems={[
              <IconButton
                icon={<Icons.FallOutlined iconSize="xl" />}
                label="Collapse tab content"
                onClick={handleDeleteTopLevelTabs}
              />,
            ]}
            editMode={editMode}
          >
            {/* @ts-ignore */}
            <DashboardComponent
              id={topLevelTabs?.id}
              parentId={DASHBOARD_ROOT_ID}
              depth={DASHBOARD_ROOT_DEPTH + 1}
              index={0}
              renderTabContent={false}
              renderHoverMenu={false}
              onChangeTab={handleChangeTab}
            />
          </WithPopoverMenu>
        )}
      </div>
    ),
    [
      editMode,
      handleChangeTab,
      handleDeleteTopLevelTabs,
      hideDashboardHeader,
      isReport,
      topLevelTabs,
    ],
  );

  return (
    <StyledDiv>
      {nativeFiltersEnabled && !editMode && (
        <FiltersPanel>
          <StickyPanel ref={containerRef} width={filterBarWidth}>
            <ErrorBoundary>
              <FilterBar
                filtersOpen={dashboardFiltersOpen}
                toggleFiltersBar={toggleDashboardFiltersOpen}
                directPathToChild={directPathToChild}
                width={filterBarWidth}
                height={filterBarHeight}
                offset={filterBarOffset}
              />
            </ErrorBoundary>
          </StickyPanel>
        </FiltersPanel>
      )}
      <StyledHeader>
        {/* @ts-ignore */}
        <DragDroppable
          data-test="top-level-tabs"
          component={dashboardRoot}
          parentComponent={null}
          depth={DASHBOARD_ROOT_DEPTH}
          index={0}
          orientation="column"
          onDrop={handleDrop}
          editMode={editMode}
          // you cannot drop on/displace tabs if they already exist
          disableDragDrop={!!topLevelTabs}
          style={draggableStyle}
        >
          {renderDraggableContent}
        </DragDroppable>
      </StyledHeader>
      <StyledContent fullSizeChartId={fullSizeChartId}>
        <Global
          styles={css`
            // @z-index-above-dashboard-header (100) + 1 = 101
            ${fullSizeChartId &&
            `div > .filterStatusPopover.ant-popover{z-index: 101}`}
          `}
        />
        <div
          data-test="dashboard-content"
          className={cx('dashboard', editMode && 'dashboard--editing')}
        >
          <StyledDashboardContent
            className="dashboard-content"
            dashboardFiltersOpen={dashboardFiltersOpen}
            editMode={editMode}
          >
            {showDashboard ? (
              <DashboardContainer topLevelTabs={topLevelTabs} />
            ) : (
              <Loading />
            )}
            {editMode && <BuilderComponentPane topOffset={barTopOffset} />}
          </StyledDashboardContent>
        </div>
      </StyledContent>
    </StyledDiv>
  );
};

export default DashboardBuilder;
