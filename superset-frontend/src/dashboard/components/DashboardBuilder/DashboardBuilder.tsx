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
import React, {
  FC,
  useCallback,
  useEffect,
  useState,
  useMemo,
  useRef,
} from 'react';
import { JsonObject, styled, css, t } from '@superset-ui/core';
import { Global } from '@emotion/react';
import { useDispatch, useSelector } from 'react-redux';
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
import { getUrlParam } from 'src/utils/urlUtils';
import { DashboardLayout, RootState } from 'src/dashboard/types';
import {
  setDirectPathToChild,
  setEditMode,
} from 'src/dashboard/actions/dashboardState';
import { useElementOnScreen } from 'src/hooks/useElementOnScreen';
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
import { EmptyStateBig } from 'src/components/EmptyState';
import { useUiConfig } from 'src/components/UiConfigContext';
import ResizableSidebar from 'src/components/ResizableSidebar';
import {
  BUILDER_SIDEPANEL_WIDTH,
  CLOSED_FILTER_BAR_WIDTH,
  FILTER_BAR_HEADER_HEIGHT,
  FILTER_BAR_TABS_HEIGHT,
  MAIN_HEADER_HEIGHT,
  OPEN_FILTER_BAR_WIDTH,
  OPEN_FILTER_BAR_MAX_WIDTH,
} from 'src/dashboard/constants';
import { shouldFocusTabs, getRootLevelTabsComponent } from './utils';
import DashboardContainer from './DashboardContainer';
import { useNativeFilters } from './state';

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
    background: ${({ theme }) => theme.colors.grayscale.light5};
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }

  .dashboard-component-tabs {
    position: relative;
  }

  /* A column within a column or tabs has inset hover menu */
  .dragdroppable-column .dragdroppable-column .hover-menu--top,
  .dashboard-component-tabs .dragdroppable-column .hover-menu--top {
    top: -12px;
    background: ${({ theme }) => theme.colors.grayscale.light5};
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }

  /* move Tabs hover menu to top near actual Tabs */
  .dashboard-component-tabs > .hover-menu-container > .hover-menu--left {
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
const FiltersPanel = styled.div<{ width: number }>`
  grid-column: 1;
  grid-row: 1 / span 2;
  z-index: 11;
  width: ${({ width }) => width}px;
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
  top: 0;
  z-index: 100;
  max-width: 100vw;
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
  nativeFiltersEnabled: boolean;
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
    width: 0;
    flex: 1;
    position: relative;
    margin-top: ${({ theme }) => theme.gridUnit * 6}px;
    margin-right: ${({ theme }) => theme.gridUnit * 8}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 6}px;
    margin-left: ${({
      theme,
      dashboardFiltersOpen,
      editMode,
      nativeFiltersEnabled,
    }) => {
      if (!dashboardFiltersOpen && !editMode && nativeFiltersEnabled) {
        return 0;
      }
      return theme.gridUnit * 8;
    }}px;

    ${({ editMode, theme }) =>
      editMode &&
      `
      max-width: calc(100% - ${
        BUILDER_SIDEPANEL_WIDTH + theme.gridUnit * 16
      }px);
    `}
  }

  .dashboard-builder-sidepane {
    width: ${BUILDER_SIDEPANEL_WIDTH}px;
    z-index: 1;
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
  const uiConfig = useUiConfig();

  const dashboardId = useSelector<RootState, string>(
    ({ dashboardInfo }) => `${dashboardInfo.id}`,
  );
  const dashboardLayout = useSelector<RootState, DashboardLayout>(
    state => state.dashboardLayout.present,
  );
  const editMode = useSelector<RootState, boolean>(
    state => state.dashboardState.editMode,
  );
  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
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

  const headerRef = React.useRef<HTMLDivElement>(null);
  const dashboardRoot = dashboardLayout[DASHBOARD_ROOT_ID];
  const rootChildId = dashboardRoot?.children[0];
  const topLevelTabs =
    rootChildId !== DASHBOARD_GRID_ID
      ? dashboardLayout[rootChildId]
      : undefined;
  const standaloneMode = getUrlParam(URL_PARAMS.standalone);
  const isReport = standaloneMode === DashboardStandaloneMode.REPORT;
  const hideDashboardHeader =
    uiConfig.hideTitle ||
    standaloneMode === DashboardStandaloneMode.HIDE_NAV_AND_TITLE ||
    isReport;
  const [barTopOffset, setBarTopOffset] = useState(0);

  useEffect(() => {
    setBarTopOffset(headerRef.current?.getBoundingClientRect()?.height || 0);

    let observer: ResizeObserver;
    if (global.hasOwnProperty('ResizeObserver') && headerRef.current) {
      observer = new ResizeObserver(entries => {
        setBarTopOffset(
          current => entries?.[0]?.contentRect?.height || current,
        );
      });

      observer.observe(headerRef.current);
    }

    return () => {
      observer?.disconnect();
    };
  }, []);

  const {
    showDashboard,
    dashboardFiltersOpen,
    toggleDashboardFiltersOpen,
    nativeFiltersEnabled,
  } = useNativeFilters();

  const [containerRef, isSticky] = useElementOnScreen<HTMLDivElement>({
    threshold: [1],
  });

  const filterSetEnabled = isFeatureEnabled(
    FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET,
  );

  const offset =
    FILTER_BAR_HEADER_HEIGHT +
    (isSticky || standaloneMode ? 0 : MAIN_HEADER_HEIGHT) +
    (filterSetEnabled ? FILTER_BAR_TABS_HEIGHT : 0);

  const filterBarHeight = `calc(100vh - ${offset}px)`;
  const filterBarOffset = dashboardFiltersOpen ? 0 : barTopOffset + 20;

  const draggableStyle = useMemo(
    () => ({
      marginLeft:
        dashboardFiltersOpen || editMode || !nativeFiltersEnabled ? 0 : -32,
    }),
    [dashboardFiltersOpen, editMode, nativeFiltersEnabled],
  );

  // If a new tab was added, update the directPathToChild to reflect it
  const currentTopLevelTabs = useRef(topLevelTabs);
  useEffect(() => {
    const currentTabsLength = currentTopLevelTabs.current?.children?.length;
    const newTabsLength = topLevelTabs?.children?.length;

    if (
      currentTabsLength !== undefined &&
      newTabsLength !== undefined &&
      newTabsLength > currentTabsLength
    ) {
      const lastTab = getDirectPathToTabIndex(
        getRootLevelTabsComponent(dashboardLayout),
        newTabsLength - 1,
      );
      dispatch(setDirectPathToChild(lastTab));
    }

    currentTopLevelTabs.current = topLevelTabs;
  }, [topLevelTabs]);

  const renderDraggableContent = useCallback(
    ({ dropIndicatorProps }: { dropIndicatorProps: JsonObject }) => (
      <div>
        {!hideDashboardHeader && <DashboardHeader />}
        {dropIndicatorProps && <div {...dropIndicatorProps} />}
        {!isReport && topLevelTabs && !uiConfig.hideNav && (
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
      uiConfig.hideNav,
    ],
  );

  return (
    <StyledDiv>
      {nativeFiltersEnabled && !editMode && (
        <>
          <ResizableSidebar
            id={`dashboard:${dashboardId}`}
            enable={dashboardFiltersOpen}
            minWidth={OPEN_FILTER_BAR_WIDTH}
            maxWidth={OPEN_FILTER_BAR_MAX_WIDTH}
            initialWidth={OPEN_FILTER_BAR_WIDTH}
          >
            {adjustedWidth => {
              const filterBarWidth = dashboardFiltersOpen
                ? adjustedWidth
                : CLOSED_FILTER_BAR_WIDTH;
              return (
                <FiltersPanel
                  width={filterBarWidth}
                  data-test="dashboard-filters-panel"
                >
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
              );
            }}
          </ResizableSidebar>
        </>
      )}
      <StyledHeader ref={headerRef}>
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
        {!editMode &&
          !topLevelTabs &&
          dashboardLayout[DASHBOARD_GRID_ID]?.children?.length === 0 && (
            <EmptyStateBig
              title={t('There are no charts added to this dashboard')}
              description={
                canEdit &&
                t(
                  'Go to the edit mode to configure the dashboard and add charts',
                )
              }
              buttonText={canEdit && t('Edit the dashboard')}
              buttonAction={() => dispatch(setEditMode(true))}
              image="dashboard.svg"
            />
          )}
        <div
          data-test="dashboard-content"
          className={cx('dashboard', editMode && 'dashboard--editing')}
        >
          <StyledDashboardContent
            className="dashboard-content"
            dashboardFiltersOpen={dashboardFiltersOpen}
            editMode={editMode}
            nativeFiltersEnabled={nativeFiltersEnabled}
          >
            {showDashboard ? (
              <DashboardContainer topLevelTabs={topLevelTabs} />
            ) : (
              <Loading />
            )}
            {editMode && (
              <BuilderComponentPane
                isStandalone={!!standaloneMode}
                topOffset={barTopOffset}
              />
            )}
          </StyledDashboardContent>
        </div>
      </StyledContent>
    </StyledDiv>
  );
};

export default DashboardBuilder;
