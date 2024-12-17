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
import { useCallback, useEffect, useRef, useMemo, useState, memo } from 'react';
import PropTypes from 'prop-types';
import { styled, t, logging } from '@superset-ui/core';
import { debounce } from 'lodash';
import { useHistory } from 'react-router-dom';
import { bindActionCreators } from 'redux';
import { useDispatch, useSelector } from 'react-redux';

import { exportChart, mountExploreUrl } from 'src/explore/exploreUtils';
import ChartContainer from 'src/components/Chart/ChartContainer';
import {
  LOG_ACTIONS_CHANGE_DASHBOARD_FILTER,
  LOG_ACTIONS_EXPLORE_DASHBOARD_CHART,
  LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART,
  LOG_ACTIONS_EXPORT_XLSX_DASHBOARD_CHART,
  LOG_ACTIONS_FORCE_REFRESH_CHART,
} from 'src/logger/LogUtils';
import { postFormData } from 'src/explore/exploreUtils/formData';
import { URL_PARAMS } from 'src/constants';
import { enforceSharedLabelsColorsArray } from 'src/utils/colorScheme';

import SliceHeader from '../SliceHeader';
import MissingChart from '../MissingChart';
import {
  addDangerToast,
  addSuccessToast,
} from '../../../components/MessageToasts/actions';
import {
  setFocusedFilterField,
  toggleExpandSlice,
  unsetFocusedFilterField,
} from '../../actions/dashboardState';
import { changeFilter } from '../../actions/dashboardFilters';
import { refreshChart } from '../../../components/Chart/chartAction';
import { logEvent } from '../../../logger/actions';
import {
  getActiveFilters,
  getAppliedFilterValues,
} from '../../util/activeDashboardFilters';
import getFormDataWithExtraFilters from '../../util/charts/getFormDataWithExtraFilters';
import { PLACEHOLDER_DATASOURCE } from '../../constants';

const propTypes = {
  id: PropTypes.number.isRequired,
  componentId: PropTypes.string.isRequired,
  dashboardId: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  updateSliceName: PropTypes.func.isRequired,
  isComponentVisible: PropTypes.bool,
  handleToggleFullSize: PropTypes.func.isRequired,
  setControlValue: PropTypes.func,
  sliceName: PropTypes.string.isRequired,
  isFullSize: PropTypes.bool,
  extraControls: PropTypes.object,
  isInView: PropTypes.bool,
};

// we use state + shouldComponentUpdate() logic to prevent perf-wrecking
// resizing across all slices on a dashboard on every update
const RESIZE_TIMEOUT = 500;
const DEFAULT_HEADER_HEIGHT = 22;

const ChartWrapper = styled.div`
  overflow: hidden;
  position: relative;

  &.dashboard-chart--overflowable {
    overflow: visible;
  }
`;

const ChartOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;
`;

const SliceContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 100%;
`;

const EMPTY_OBJECT = {};

const Chart = props => {
  const dispatch = useDispatch();
  const descriptionRef = useRef(null);
  const headerRef = useRef(null);

  const boundActionCreators = useMemo(
    () =>
      bindActionCreators(
        {
          addSuccessToast,
          addDangerToast,
          toggleExpandSlice,
          changeFilter,
          setFocusedFilterField,
          unsetFocusedFilterField,
          refreshChart,
          logEvent,
        },
        dispatch,
      ),
    [dispatch],
  );

  const chart = useSelector(state => state.charts[props.id] || EMPTY_OBJECT);
  const slice = useSelector(
    state => state.sliceEntities.slices[props.id] || EMPTY_OBJECT,
  );
  const editMode = useSelector(state => state.dashboardState.editMode);
  const isExpanded = useSelector(
    state => !!state.dashboardState.expandedSlices[props.id],
  );
  const supersetCanExplore = useSelector(
    state => !!state.dashboardInfo.superset_can_explore,
  );
  const supersetCanShare = useSelector(
    state => !!state.dashboardInfo.superset_can_share,
  );
  const supersetCanCSV = useSelector(
    state => !!state.dashboardInfo.superset_can_csv,
  );
  const timeout = useSelector(
    state => state.dashboardInfo.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
  );
  const emitCrossFilters = useSelector(
    state => !!state.dashboardInfo.crossFiltersEnabled,
  );
  const datasource = useSelector(
    state =>
      (chart &&
        chart.form_data &&
        state.datasources[chart.form_data.datasource]) ||
      PLACEHOLDER_DATASOURCE,
  );

  const [descriptionHeight, setDescriptionHeight] = useState(0);
  const [height, setHeight] = useState(props.height);
  const [width, setWidth] = useState(props.width);
  const history = useHistory();
  const resize = useCallback(
    debounce(() => {
      const { width, height } = props;
      setHeight(height);
      setWidth(width);
    }, RESIZE_TIMEOUT),
    [props.width, props.height],
  );

  const ownColorScheme = chart.form_data?.color_scheme;

  const addFilter = useCallback(
    (newSelectedValues = {}) => {
      boundActionCreators.logEvent(LOG_ACTIONS_CHANGE_DASHBOARD_FILTER, {
        id: chart.id,
        columns: Object.keys(newSelectedValues).filter(
          key => newSelectedValues[key] !== null,
        ),
      });
      boundActionCreators.changeFilter(chart.id, newSelectedValues);
    },
    [boundActionCreators.logEvent, boundActionCreators.changeFilter, chart.id],
  );

  useEffect(() => {
    if (isExpanded) {
      const descriptionHeight =
        isExpanded && descriptionRef.current
          ? descriptionRef.current?.offsetHeight
          : 0;
      setDescriptionHeight(descriptionHeight);
    }
  }, [isExpanded]);

  useEffect(
    () => () => {
      resize.cancel();
    },
    [resize],
  );

  useEffect(() => {
    resize();
  }, [resize, props.isFullSize]);

  const getHeaderHeight = useCallback(() => {
    if (headerRef.current) {
      const computedStyle = getComputedStyle(
        headerRef.current,
      ).getPropertyValue('margin-bottom');
      const marginBottom = parseInt(computedStyle, 10) || 0;
      return headerRef.current.offsetHeight + marginBottom;
    }
    return DEFAULT_HEADER_HEIGHT;
  }, [headerRef]);

  const getChartHeight = useCallback(() => {
    const headerHeight = getHeaderHeight();
    return Math.max(height - headerHeight - descriptionHeight, 20);
  }, [getHeaderHeight, height, descriptionHeight]);

  const handleFilterMenuOpen = useCallback(
    (chartId, column) => {
      boundActionCreators.setFocusedFilterField(chartId, column);
    },
    [boundActionCreators.setFocusedFilterField],
  );

  const handleFilterMenuClose = useCallback(
    (chartId, column) => {
      boundActionCreators.unsetFocusedFilterField(chartId, column);
    },
    [boundActionCreators.unsetFocusedFilterField],
  );

  const logExploreChart = useCallback(() => {
    boundActionCreators.logEvent(LOG_ACTIONS_EXPLORE_DASHBOARD_CHART, {
      slice_id: slice.slice_id,
      is_cached: props.isCached,
    });
  }, [boundActionCreators.logEvent, slice.slice_id, props.isCached]);

  const chartConfiguration = useSelector(
    state => state.dashboardInfo.metadata?.chart_configuration,
  );
  const colorScheme = useSelector(state => state.dashboardState.colorScheme);
  const colorNamespace = useSelector(
    state => state.dashboardState.colorNamespace,
  );
  const datasetsStatus = useSelector(
    state => state.dashboardState.datasetsStatus,
  );
  const allSliceIds = useSelector(state => state.dashboardState.sliceIds);
  const nativeFilters = useSelector(state => state.nativeFilters?.filters);
  const dataMask = useSelector(state => state.dataMask);
  const labelsColor = useSelector(
    state => state.dashboardInfo?.metadata?.label_colors || EMPTY_OBJECT,
  );
  const labelsColorMap = useSelector(
    state => state.dashboardInfo?.metadata?.map_label_colors || EMPTY_OBJECT,
  );
  const sharedLabelsColors = useSelector(state =>
    enforceSharedLabelsColorsArray(
      state.dashboardInfo?.metadata?.shared_label_colors,
    ),
  );

  const formData = useMemo(
    () =>
      getFormDataWithExtraFilters({
        chart,
        chartConfiguration,
        filters: getAppliedFilterValues(props.id),
        colorScheme,
        colorNamespace,
        sliceId: props.id,
        nativeFilters,
        allSliceIds,
        dataMask,
        extraControls: props.extraControls,
        labelsColor,
        labelsColorMap,
        sharedLabelsColors,
        ownColorScheme,
      }),
    [
      chart,
      chartConfiguration,
      props.id,
      props.extraControls,
      colorScheme,
      colorNamespace,
      nativeFilters,
      allSliceIds,
      dataMask,
      labelsColor,
      labelsColorMap,
      sharedLabelsColors,
      ownColorScheme,
    ],
  );

  const onExploreChart = useCallback(
    async clickEvent => {
      const isOpenInNewTab =
        clickEvent.shiftKey || clickEvent.ctrlKey || clickEvent.metaKey;
      try {
        const lastTabId = window.localStorage.getItem('last_tab_id');
        const nextTabId = lastTabId
          ? String(Number.parseInt(lastTabId, 10) + 1)
          : undefined;
        const key = await postFormData(
          datasource.id,
          datasource.type,
          formData,
          slice.slice_id,
          nextTabId,
        );
        const url = mountExploreUrl(null, {
          [URL_PARAMS.formDataKey.name]: key,
          [URL_PARAMS.sliceId.name]: slice.slice_id,
        });
        if (isOpenInNewTab) {
          window.open(url, '_blank', 'noreferrer');
        } else {
          history.push(url);
        }
      } catch (error) {
        logging.error(error);
        boundActionCreators.addDangerToast(
          t('An error occurred while opening Explore'),
        );
      }
    },
    [
      datasource.id,
      datasource.type,
      formData,
      slice.slice_id,
      boundActionCreators.addDangerToast,
      history,
    ],
  );

  const exportTable = useCallback(
    (format, isFullCSV, isPivot = false) => {
      const logAction =
        format === 'csv'
          ? LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART
          : LOG_ACTIONS_EXPORT_XLSX_DASHBOARD_CHART;
      boundActionCreators.logEvent(logAction, {
        slice_id: slice.slice_id,
        is_cached: props.isCached,
      });
      exportChart({
        formData: isFullCSV
          ? { ...formData, row_limit: props.maxRows }
          : formData,
        resultType: isPivot ? 'post_processed' : 'full',
        resultFormat: format,
        force: true,
        ownState: props.ownState,
      });
    },
    [
      slice.slice_id,
      props.isCached,
      formData,
      props.maxRows,
      props.ownState,
      boundActionCreators.logEvent,
    ],
  );

  const exportCSV = useCallback(
    (isFullCSV = false) => {
      exportTable('csv', isFullCSV);
    },
    [exportTable],
  );

  const exportFullCSV = useCallback(() => {
    exportCSV(true);
  }, [exportCSV]);

  const exportPivotCSV = useCallback(() => {
    exportTable('csv', false, true);
  }, [exportTable]);

  const exportXLSX = useCallback(() => {
    exportTable('xlsx', false);
  }, [exportTable]);

  const exportFullXLSX = useCallback(() => {
    exportTable('xlsx', true);
  }, [exportTable]);

  const forceRefresh = useCallback(() => {
    boundActionCreators.logEvent(LOG_ACTIONS_FORCE_REFRESH_CHART, {
      slice_id: slice.slice_id,
      is_cached: props.isCached,
    });
    return boundActionCreators.refreshChart(chart.id, true, props.dashboardId);
  }, [
    boundActionCreators.refreshChart,
    chart.id,
    props.dashboardId,
    slice.slice_id,
    props.isCached,
    boundActionCreators.logEvent,
  ]);

  if (chart === EMPTY_OBJECT || slice === EMPTY_OBJECT) {
    return <MissingChart height={getChartHeight()} />;
  }

  const { queriesResponse, chartUpdateEndTime, chartStatus, annotationQuery } =
    chart;
  const isLoading = chartStatus === 'loading';
  // eslint-disable-next-line camelcase
  const isCached = queriesResponse?.map(({ is_cached }) => is_cached) || [];
  const cachedDttm =
    // eslint-disable-next-line camelcase
    queriesResponse?.map(({ cached_dttm }) => cached_dttm) || [];

  return (
    <SliceContainer
      className="chart-slice"
      data-test="chart-grid-component"
      data-test-chart-id={props.id}
      data-test-viz-type={slice.viz_type}
      data-test-chart-name={slice.slice_name}
    >
      <SliceHeader
        ref={headerRef}
        slice={slice}
        isExpanded={isExpanded}
        isCached={isCached}
        cachedDttm={cachedDttm}
        updatedDttm={chartUpdateEndTime}
        toggleExpandSlice={boundActionCreators.toggleExpandSlice}
        forceRefresh={forceRefresh}
        editMode={editMode}
        annotationQuery={annotationQuery}
        logExploreChart={logExploreChart}
        logEvent={boundActionCreators.logEvent}
        onExploreChart={onExploreChart}
        exportCSV={exportCSV}
        exportPivotCSV={exportPivotCSV}
        exportXLSX={exportXLSX}
        exportFullCSV={exportFullCSV}
        exportFullXLSX={exportFullXLSX}
        updateSliceName={props.updateSliceName}
        sliceName={props.sliceName}
        supersetCanExplore={supersetCanExplore}
        supersetCanShare={supersetCanShare}
        supersetCanCSV={supersetCanCSV}
        componentId={props.componentId}
        dashboardId={props.dashboardId}
        filters={getActiveFilters() || EMPTY_OBJECT}
        addSuccessToast={boundActionCreators.addSuccessToast}
        addDangerToast={boundActionCreators.addDangerToast}
        handleToggleFullSize={props.handleToggleFullSize}
        isFullSize={props.isFullSize}
        chartStatus={chartStatus}
        formData={formData}
        width={width}
        height={getHeaderHeight()}
      />

      {/*
          This usage of dangerouslySetInnerHTML is safe since it is being used to render
          markdown that is sanitized with nh3. See:
             https://github.com/apache/superset/pull/4390
          and
             https://github.com/apache/superset/pull/23862
        */}
      {isExpanded && slice.description_markeddown && (
        <div
          className="slice_description bs-callout bs-callout-default"
          ref={descriptionRef}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: slice.description_markeddown }}
          role="complementary"
        />
      )}

      <ChartWrapper
        className={cx('dashboard-chart')}
        aria-label={slice.description}
      >
        {isLoading && (
          <ChartOverlay
            style={{
              width,
              height: getChartHeight(),
            }}
          />
        )}

        <ChartContainer
          width={width}
          height={getChartHeight()}
          addFilter={addFilter}
          onFilterMenuOpen={handleFilterMenuOpen}
          onFilterMenuClose={handleFilterMenuClose}
          annotationData={chart.annotationData}
          chartAlert={chart.chartAlert}
          chartId={props.id}
          chartStatus={chartStatus}
          datasource={datasource}
          dashboardId={props.dashboardId}
          initialValues={EMPTY_OBJECT}
          formData={formData}
          labelsColor={labelsColor}
          labelsColorMap={labelsColorMap}
          ownState={dataMask[props.id]?.ownState}
          filterState={dataMask[props.id]?.filterState}
          queriesResponse={chart.queriesResponse}
          timeout={timeout}
          triggerQuery={chart.triggerQuery}
          vizType={slice.viz_type}
          setControlValue={props.setControlValue}
          datasetsStatus={datasetsStatus}
          isInView={props.isInView}
          emitCrossFilters={emitCrossFilters}
        />
      </ChartWrapper>
    </SliceContainer>
  );
};

Chart.propTypes = propTypes;

export default memo(Chart, (prevProps, nextProps) => {
  if (prevProps.cacheBusterProp !== nextProps.cacheBusterProp) {
    return false;
  }
  return (
    !nextProps.isComponentVisible ||
    (prevProps.isInView === nextProps.isInView &&
      prevProps.componentId === nextProps.componentId &&
      prevProps.id === nextProps.id &&
      prevProps.dashboardId === nextProps.dashboardId &&
      prevProps.extraControls === nextProps.extraControls &&
      prevProps.handleToggleFullSize === nextProps.handleToggleFullSize &&
      prevProps.isFullSize === nextProps.isFullSize &&
      prevProps.setControlValue === nextProps.setControlValue &&
      prevProps.sliceName === nextProps.sliceName &&
      prevProps.updateSliceName === nextProps.updateSliceName &&
      prevProps.width === nextProps.width &&
      prevProps.height === nextProps.height)
  );
});
