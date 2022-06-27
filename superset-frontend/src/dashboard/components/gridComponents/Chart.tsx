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
import cx from 'classnames';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { QueryFormData, styled, t, logging } from '@superset-ui/core';
import { isEqual } from 'lodash';

import { exportChart, mountExploreUrl } from 'src/explore/exploreUtils';
import ChartContainer from 'src/components/Chart/ChartContainer';
import {
  LOG_ACTIONS_CHANGE_DASHBOARD_FILTER,
  LOG_ACTIONS_EXPLORE_DASHBOARD_CHART,
  LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART,
  LOG_ACTIONS_FORCE_REFRESH_CHART,
} from 'src/logger/LogUtils';
import { FILTER_BOX_MIGRATION_STATES } from 'src/explore/constants';
import { postFormData } from 'src/explore/exploreUtils/formData';
import { URL_PARAMS } from 'src/constants';

import SliceHeader from '../SliceHeader';
import MissingChart from '../MissingChart';

import { isFilterBox } from '../../util/activeDashboardFilters';
import getFilterValuesByFilterId from '../../util/getFilterValuesByFilterId';

interface PlainObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface AnnotationData {
  [key: string]: PlainObject;
}

interface chartProps {
  id: number;
  chartAlert?: string;
  chartStatus: string;
  chartUpdateEndTime: number | null;
  chartUpdateStartTime?: number;
  latestQueryFormData?: Object;
  queryController?: { abort: any };
  queriesResponse?: Array<any>;
  triggerQuery?: boolean;
  lastRendered?: number;
  annotationData: AnnotationData;
  annotationQuery?: object;
  annotationError?: object;
}

interface sliceProps {
  description: string;
  viz_type: string;
  slice_name: string;
  slice_id: number;
  slice_description: string;
  form_data?: { emit_filter?: boolean };
  description_markeddown: string;
}

interface Props {
  id: number;
  componentId: string;
  dashboardId: number;
  width: number;
  height: number;
  updateSliceName: (arg0: string) => void;
  isComponentVisible: boolean;
  handleToggleFullSize: () => void;

  // from redux
  chart: chartProps;
  formData: QueryFormData & object;
  labelColors: Object;
  sharedLabelColors: Object;
  datasource: Record<string, any>;
  slice: sliceProps;
  sliceName: string;
  timeout: number;
  maxRows: number;
  filterboxMigrationState: FILTER_BOX_MIGRATION_STATES;
  // all active filter fields in dashboard
  filters: Object;
  refreshChart: (chartId: number, force: true, dashboardId: number) => void;
  logEvent: (arg0: string, arg1: Object) => void;
  toggleExpandSlice: (sliceId: number) => void;
  changeFilter: (chartId: number, values: Object) => void;
  setFocusedFilterField: (chartId: number, column: string) => void;
  unsetFocusedFilterField: (chartId: number, column: string) => void;
  editMode: boolean;
  isExpanded: boolean;
  isCached: boolean;
  isFullSize: boolean;
  supersetCanExplore: boolean;
  supersetCanShare: boolean;
  supersetCanCSV: boolean;
  sliceCanEdit: boolean;
  addSuccessToast: (message: string) => void;
  addDangerToast: (message: string) => void;
  ownState?: Object;
  filterState?: Object;
  postTransformProps?: any;
  datasetsStatus?: 'loading' | 'error' | 'complete';
  cacheBusterProp: any;
  setControlValue?: () => {};
}

const SHOULD_UPDATE_ON_PROP_CHANGES = [
  'id',
  'componentId',
  'dashboardId',
  'chart',
  'formData',
  'labelColors',
  'sharedLabelColors',
  'datasources',
  'slice',
  'sliceName',
  'timeout',
  'maxRows',
  'filterboxMigrationState',
  'filters',
  'editMode',
  'isExpanded',
  'isCached',
  'isFullSize',
  'supersetCanExplore',
  'supersetCanShare',
  'supersetCanCSV',
  'sliceCanEdit',
  'ownState',
  'filterState',
  'postTransformProps',
  'datasetsStatus',
  'refreshChart',
  'changeFilter',
];

const ChartOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;

  &.is-deactivated {
    opacity: 0.5;
    background-color: ${({ theme }) => theme.colors.grayscale.light1};
  }
`;

const SliceContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 100%;
`;

function Chart(props: Props) {
  const {
    id,
    componentId,
    dashboardId,
    chart,
    slice,
    datasource,
    isExpanded,
    editMode,
    filters,
    formData,
    labelColors,
    sharedLabelColors,
    updateSliceName,
    sliceName,
    toggleExpandSlice,
    timeout,
    supersetCanExplore,
    supersetCanShare,
    supersetCanCSV,
    sliceCanEdit,
    addSuccessToast,
    addDangerToast,
    ownState,
    filterState,
    handleToggleFullSize,
    isFullSize,
    setControlValue,
    filterboxMigrationState,
    postTransformProps,
    datasetsStatus,
  } = props;

  const width = useMemo<number>(() => props.width, [props.width]);
  const height = useMemo<number>(() => props.height, [props.height]);
  const [descriptionHeight, setDescriptionHeight] = useState<number>(0);

  const OVERFLOWABLE_VIZ_TYPES = new Set(['filter_box']);
  const DEFAULT_HEADER_HEIGHT = 22;

  const headerRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);

  const getDescriptionHeight = (): number =>
    props.isExpanded && descriptionRef
      ? descriptionRef.current?.offsetHeight || 0
      : 0;

  const getHeaderHeight = (): number => {
    if (headerRef && headerRef.current) {
      const computedStyle = getComputedStyle(
        headerRef.current,
      ).getPropertyValue('margin-bottom');
      const marginBottom = parseInt(computedStyle, 10) || 0;
      return headerRef.current.offsetHeight + marginBottom;
    }
    return DEFAULT_HEADER_HEIGHT;
  };

  const getChartHeight = (): number => {
    const headerHeight = getHeaderHeight();
    return Math.max(height - headerHeight - descriptionHeight, 20);
  };

  const changeFilter = (newSelectedValues = {}): void => {
    props.logEvent(LOG_ACTIONS_CHANGE_DASHBOARD_FILTER, {
      id: props.chart.id,
      columns: Object.keys(newSelectedValues),
    });
    props.changeFilter(props.chart.id, newSelectedValues);
  };

  const handleFilterMenuOpen = (chartId: number, column: string): void => {
    props.setFocusedFilterField(chartId, column);
  };

  const handleFilterMenuClose = (chartId: number, column: string): void => {
    props.unsetFocusedFilterField(chartId, column);
  };

  const logExploreChart = () => {
    props.logEvent(LOG_ACTIONS_EXPLORE_DASHBOARD_CHART, {
      slice_id: props.slice.slice_id,
      is_cached: props.isCached,
    });
  };

  const onExploreChart = async (): Promise<void> => {
    try {
      const lastTabId = window.localStorage.getItem('last_tab_id');
      const nextTabId = lastTabId
        ? String(Number.parseInt(lastTabId, 10) + 1)
        : undefined;
      const key = await postFormData(
        props.datasource.id,
        props.datasource.type,
        props.formData,
        props.slice.slice_id,
        nextTabId,
      );
      const url = mountExploreUrl(null, {
        [URL_PARAMS.formDataKey.name]: key,
        [URL_PARAMS.sliceId.name]: props.slice.slice_id,
      });
      window.open(url, '_blank', 'noreferrer');
    } catch (error) {
      logging.error(error);
      props.addDangerToast(t('An error occurred while opening Explore'));
    }
  };

  const exportCSV = (isFullCSV = false): void => {
    props.logEvent(LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART, {
      slice_id: props.slice.slice_id,
      is_cached: props.isCached,
    });
    exportChart({
      formData: isFullCSV
        ? { ...props.formData, row_limit: props.maxRows }
        : props.formData,
      resultType: 'full',
      resultFormat: 'csv',
      force: true,
      ownState: props.ownState,
    });
  };

  const exportFullCSV = (): void => {
    exportCSV(true);
  };

  const forceRefresh = (): void => {
    props.logEvent(LOG_ACTIONS_FORCE_REFRESH_CHART, {
      slice_id: props.slice.slice_id,
      is_cached: props.isCached,
    });
    return props.refreshChart(props.chart.id, true, props.dashboardId);
  };

  useEffect(() => {
    if (isExpanded) {
      const descriptionHeight = getDescriptionHeight();
      setDescriptionHeight(descriptionHeight);
    }
  }, []);

  // this prevents throwing in the case that a gridComponent
  // references a chart that is not associated with the dashboard
  if (!chart || !slice) {
    return <MissingChart height={getChartHeight()} />;
  }

  const { queriesResponse, chartUpdateEndTime, chartStatus } = chart;
  const isLoading = chartStatus === 'loading';
  const isDeactivatedViz =
    slice.viz_type === 'filter_box' &&
    [
      FILTER_BOX_MIGRATION_STATES.REVIEWING,
      FILTER_BOX_MIGRATION_STATES.CONVERTED,
    ].includes(filterboxMigrationState);
  // eslint-disable-next-line camelcase
  const isCached = queriesResponse?.map(({ is_cached }) => is_cached) || [];
  const cachedDttm =
    // eslint-disable-next-line camelcase
    queriesResponse?.map(({ cached_dttm }) => cached_dttm) || [];
  const isOverflowable = OVERFLOWABLE_VIZ_TYPES.has(slice.viz_type);
  const initialValues = isFilterBox(id)
    ? getFilterValuesByFilterId({
        activeFilters: filters,
        filterId: id,
      })
    : {};

  return (
    <SliceContainer
      className="chart-slice"
      data-test="chart-grid-component"
      data-test-chart-id={id}
      data-test-viz-type={slice.viz_type}
      data-test-chart-name={slice.slice_name}
    >
      <SliceHeader
        innerRef={headerRef}
        slice={slice}
        isExpanded={isExpanded}
        isCached={isCached}
        cachedDttm={cachedDttm}
        updatedDttm={chartUpdateEndTime}
        toggleExpandSlice={toggleExpandSlice}
        forceRefresh={forceRefresh}
        editMode={editMode}
        annotationQuery={chart.annotationQuery}
        logExploreChart={logExploreChart}
        onExploreChart={onExploreChart}
        exportCSV={exportCSV}
        exportFullCSV={exportFullCSV}
        updateSliceName={updateSliceName}
        sliceName={sliceName}
        supersetCanExplore={supersetCanExplore}
        supersetCanShare={supersetCanShare}
        supersetCanCSV={supersetCanCSV}
        sliceCanEdit={sliceCanEdit}
        componentId={componentId}
        dashboardId={dashboardId}
        filters={filters}
        addSuccessToast={addSuccessToast}
        addDangerToast={addDangerToast}
        handleToggleFullSize={handleToggleFullSize}
        isFullSize={isFullSize}
        chartStatus={chart.chartStatus}
        formData={formData}
        width={width}
        height={getHeaderHeight()}
      />

      {/*
        This usage of dangerouslySetInnerHTML is safe since it is being used to render
        markdown that is sanitized with bleach. See:
            https://github.com/apache/superset/pull/4390
        and
            https://github.com/apache/superset/commit/b6fcc22d5a2cb7a5e92599ed5795a0169385a825
      */}
      {isExpanded && slice.description_markeddown && (
        <div
          className="slice_description bs-callout bs-callout-default"
          data-test="slice-description"
          ref={descriptionRef}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: slice.description_markeddown }}
        />
      )}

      <div
        className={cx(
          'dashboard-chart',
          isOverflowable && 'dashboard-chart--overflowable',
        )}
      >
        {(isLoading || isDeactivatedViz) && (
          <ChartOverlay
            className={cx(isDeactivatedViz && 'is-deactivated')}
            style={{
              width,
              height: getChartHeight(),
            }}
          />
        )}
        <ChartContainer
          width={width}
          height={getChartHeight()}
          addFilter={changeFilter}
          onFilterMenuOpen={handleFilterMenuOpen}
          onFilterMenuClose={handleFilterMenuClose}
          annotationData={chart.annotationData}
          chartAlert={chart.chartAlert}
          chartId={id}
          chartStatus={chartStatus}
          datasource={datasource}
          dashboardId={dashboardId}
          initialValues={initialValues}
          formData={formData}
          labelColors={labelColors}
          sharedLabelColors={sharedLabelColors}
          ownState={ownState}
          filterState={filterState}
          queriesResponse={chart.queriesResponse}
          timeout={timeout}
          triggerQuery={chart.triggerQuery}
          vizType={slice.viz_type}
          setControlValue={setControlValue}
          isDeactivatedViz={isDeactivatedViz}
          filterboxMigrationState={filterboxMigrationState}
          postTransformProps={postTransformProps}
          datasetsStatus={datasetsStatus}
        />
      </div>
    </SliceContainer>
  );
}

export default React.memo(Chart, (prevProps, nextProps) => {
  if (!isEqual(nextProps.datasource, prevProps.datasource)) return false;

  // allow chart update/re-render only if visible:
  // under selected tab or no tab layout
  if (nextProps.isComponentVisible) {
    if (nextProps.chart.triggerQuery) {
      return false;
    }

    if (
      nextProps.width !== prevProps.width ||
      nextProps.height !== prevProps.height
    ) {
      return false;
    }

    if (nextProps.isFullSize !== prevProps.isFullSize) return true;

    for (let i = 0; i < SHOULD_UPDATE_ON_PROP_CHANGES.length; i += 1) {
      const prop = SHOULD_UPDATE_ON_PROP_CHANGES[i];
      // use deep objects equality comparison to prevent
      // unneccessary updates when objects references change
      if (!isEqual(nextProps[prop], prevProps[prop])) {
        return false;
      }
    }
  }
  // `cacheBusterProp` is jected by react-hot-loader
  return prevProps.cacheBusterProp === nextProps.cacheBusterProp;
});
