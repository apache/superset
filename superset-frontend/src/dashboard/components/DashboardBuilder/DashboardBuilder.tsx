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
import React, { FC, SyntheticEvent, useEffect, useState } from 'react';
import { Sticky, StickyContainer } from 'react-sticky';
import { TabContainer } from 'react-bootstrap';
import { JsonObject, styled } from '@superset-ui/core';
import ErrorBoundary from 'src/components/ErrorBoundary';
import BuilderComponentPane from 'src/dashboard/components/BuilderComponentPane';
import DashboardHeader from 'src/dashboard/containers/DashboardHeader';
import IconButton from 'src/dashboard/components/IconButton';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import ToastPresenter from 'src/messageToasts/containers/ToastPresenter';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import getDirectPathToTabIndex from 'src/dashboard/util/getDirectPathToTabIndex';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { URL_PARAMS } from 'src/constants';
import { useDispatch, useSelector } from 'react-redux';
import { getUrlParam } from 'src/utils/urlUtils';
import { DashboardLayout, RootState } from 'src/dashboard/types';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
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
import { StickyVerticalBar } from '../StickyVerticalBar';
import { shouldFocusTabs, getRootLevelTabsComponent } from './utils';
import { useFilters } from '../nativeFilters/FilterBar/state';
import { Filter } from '../nativeFilters/types';
import DashboardContainer from './DashboardContainer';

const TABS_HEIGHT = 47;
const HEADER_HEIGHT = 67;

type DashboardBuilderProps = {};

const StyledDashboardContent = styled.div<{ dashboardFiltersOpen: boolean }>`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  height: auto;
  flex-grow: 1;

  .grid-container .dashboard-component-tabs {
    box-shadow: none;
    padding-left: 0;
  }

  .grid-container {
    /* without this, the grid will not get smaller upon toggling the builder panel on */
    min-width: 0;
    width: 100%;
    flex-grow: 1;
    position: relative;
    margin: ${({ theme }) => theme.gridUnit * 6}px
      ${({ theme }) => theme.gridUnit * 8}px
      ${({ theme }) => theme.gridUnit * 6}px
      ${({ theme, dashboardFiltersOpen }) => {
        if (dashboardFiltersOpen) return theme.gridUnit * 8;
        return 0;
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
  const showNativeFilters = useSelector<RootState, boolean>(
    state => state.dashboardInfo.metadata?.show_native_filters,
  );
  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );
  const editMode = useSelector<RootState, boolean>(
    state => state.dashboardState.editMode,
  );
  const directPathToChild = useSelector<RootState, string[]>(
    state => state.dashboardState.directPathToChild,
  );

  const filters = useFilters();
  const filterValues = Object.values<Filter>(filters);

  const nativeFiltersEnabled =
    showNativeFilters &&
    isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS) &&
    (canEdit || (!canEdit && filterValues.length !== 0));

  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(true);

  const toggleDashboardFiltersOpen = (visible?: boolean) => {
    setDashboardFiltersOpen(visible ?? !dashboardFiltersOpen);
  };

  const handleChangeTab = ({
    pathToTabIndex,
  }: SyntheticEvent<TabContainer, Event> & { pathToTabIndex: string[] }) => {
    dispatch(setDirectPathToChild(pathToTabIndex));
  };

  const handleDeleteTopLevelTabs = () => {
    dispatch(deleteTopLevelTabs());

    const firstTab = getDirectPathToTabIndex(
      getRootLevelTabsComponent(dashboardLayout),
      0,
    );
    dispatch(setDirectPathToChild(firstTab));
  };

  const dashboardRoot = dashboardLayout[DASHBOARD_ROOT_ID];
  const rootChildId = dashboardRoot.children[0];
  const topLevelTabs =
    rootChildId !== DASHBOARD_GRID_ID
      ? dashboardLayout[rootChildId]
      : undefined;

  const hideDashboardHeader =
    getUrlParam(URL_PARAMS.standalone, 'number') ===
    DashboardStandaloneMode.HIDE_NAV_AND_TITLE;

  const barTopOffset =
    (hideDashboardHeader ? 0 : HEADER_HEIGHT) +
    (topLevelTabs ? TABS_HEIGHT : 0);

  useEffect(() => {
    if (
      filterValues.length === 0 &&
      dashboardFiltersOpen &&
      nativeFiltersEnabled
    ) {
      toggleDashboardFiltersOpen(false);
    }
  }, [filterValues.length]);

  return (
    <StickyContainer
      className={cx('dashboard', editMode && 'dashboard--editing')}
    >
      <Sticky>
        {({ style }) => (
          // @ts-ignore
          <DragDroppable
            component={dashboardRoot}
            parentComponent={null}
            depth={DASHBOARD_ROOT_DEPTH}
            index={0}
            orientation="column"
            onDrop={() => dispatch(handleComponentDrop)}
            editMode={editMode}
            // you cannot drop on/displace tabs if they already exist
            disableDragdrop={!!topLevelTabs}
            style={{
              zIndex: 100,
              ...style,
            }}
          >
            {({ dropIndicatorProps }: { dropIndicatorProps: JsonObject }) => (
              <div>
                {!hideDashboardHeader && <DashboardHeader />}
                {dropIndicatorProps && <div {...dropIndicatorProps} />}
                {topLevelTabs && (
                  <WithPopoverMenu
                    shouldFocus={shouldFocusTabs}
                    menuItems={[
                      <IconButton
                        className="fa fa-level-down"
                        label="Collapse tab content"
                        onClick={handleDeleteTopLevelTabs}
                      />,
                    ]}
                    editMode={editMode}
                  >
                    {/*
                    // @ts-ignore */}
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
            )}
          </DragDroppable>
        )}
      </Sticky>
      <StyledDashboardContent
        className="dashboard-content"
        dashboardFiltersOpen={dashboardFiltersOpen}
      >
        {nativeFiltersEnabled && !editMode && (
          <StickyVerticalBar
            filtersOpen={dashboardFiltersOpen}
            topOffset={barTopOffset}
          >
            <ErrorBoundary>
              <FilterBar
                filtersOpen={dashboardFiltersOpen}
                toggleFiltersBar={toggleDashboardFiltersOpen}
                directPathToChild={directPathToChild}
              />
            </ErrorBoundary>
          </StickyVerticalBar>
        )}
        <DashboardContainer topLevelTabs={topLevelTabs} />
        {editMode && <BuilderComponentPane topOffset={barTopOffset} />}
      </StyledDashboardContent>
      <ToastPresenter />
    </StickyContainer>
  );
};

export default DashboardBuilder;
