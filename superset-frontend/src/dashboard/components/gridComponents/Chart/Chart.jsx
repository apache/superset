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
import { t, logging } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import { debounce } from 'lodash';
import { useHistory } from 'react-router-dom';
import { bindActionCreators } from 'redux';
import { useDispatch, useSelector } from 'react-redux';

import { exportChart, mountExploreUrl } from 'src/explore/exploreUtils';
import ChartContainer from 'src/components/Chart/ChartContainer';
import {
  StreamingExportModal,
  useStreamingExport,
} from 'src/components/StreamingExportModal';
import {
  LOG_ACTIONS_CHANGE_DASHBOARD_FILTER,
  LOG_ACTIONS_EXPLORE_DASHBOARD_CHART,
  LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART,
  LOG_ACTIONS_EXPORT_XLSX_DASHBOARD_CHART,
  LOG_ACTIONS_FORCE_REFRESH_CHART,
} from 'src/logger/LogUtils';
import { postFormData } from 'src/explore/exploreUtils/formData';
import { URL_PARAMS, DEFAULT_CSV_STREAMING_ROW_THRESHOLD } from 'src/constants';
import { enforceSharedLabelsColorsArray } from 'src/utils/colorScheme';
import exportPivotExcel from 'src/utils/downloadAsPivotExcel';
import {
  convertChartStateToOwnState,
  hasChartStateConverter,
} from '../../../util/chartStateConverter';

import SliceHeader from '../../SliceHeader';
import MissingChart from '../../MissingChart';
import {
  addDangerToast,
  addSuccessToast,
} from '../../../../components/MessageToasts/actions';
import {
  setFocusedFilterField,
  toggleExpandSlice,
  unsetFocusedFilterField,
  updateChartState,
} from '../../../actions/dashboardState';
import { changeFilter } from '../../../actions/dashboardFilters';
import { refreshChart } from '../../../../components/Chart/chartAction';
import { logEvent } from '../../../../logger/actions';
import {
  getActiveFilters,
  getAppliedFilterValues,
} from '../../../util/activeDashboardFilters';
import getFormDataWithExtraFilters from '../../../util/charts/getFormDataWithExtraFilters';
import { PLACEHOLDER_DATASOURCE } from '../../../constants';

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
const EMPTY_ARRAY = [];

// Helper function to get chart state with fallback
const getChartStateWithFallback = (chartState, formData, vizType) => {
  if (!hasChartStateConverter(vizType)) {
    return null;
  }

  return (
    chartState?.state || formData.table_state || formData.pivot_table_state
  );
};

// Helper function to create own state with chart state conversion
const createOwnStateWithChartState = (baseOwnState, chartState, vizType) => {
  const state = getChartStateWithFallback(chartState, {}, vizType);

  if (!state) {
    return baseOwnState;
  }

  const convertedState = convertChartStateToOwnState(vizType, state);
  return {
    ...baseOwnState,
    ...convertedState,
    chartState: state,
  };
};

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
  const { queriesResponse, chartUpdateEndTime, chartStatus, annotationQuery } =
    chart;

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
  const maxRows = useSelector(
    state => state.dashboardInfo.common.conf.SQL_MAX_ROW,
  );
  const streamingThreshold = useSelector(
    state =>
      state.dashboardInfo.common.conf.CSV_STREAMING_ROW_THRESHOLD ||
      DEFAULT_CSV_STREAMING_ROW_THRESHOLD,
  );
  const datasource = useSelector(
    state =>
      (chart &&
        chart.form_data &&
        state.datasources[chart.form_data.datasource]) ||
      PLACEHOLDER_DATASOURCE,
  );
  const dashboardInfo = useSelector(state => state.dashboardInfo);

  const isCached = useMemo(
    // eslint-disable-next-line camelcase
    () => queriesResponse?.map(({ is_cached }) => is_cached) || [],
    [queriesResponse],
  );

  const [descriptionHeight, setDescriptionHeight] = useState(0);
  const [height, setHeight] = useState(props.height);
  const [width, setWidth] = useState(props.width);

  const [isStreamingModalVisible, setIsStreamingModalVisible] = useState(false);
  const {
    progress,
    isExporting,
    startExport,
    cancelExport,
    resetExport,
    retryExport,
  } = useStreamingExport({
    onComplete: () => {
      // Don't show toast here - wait for user to click Download button
    },
    onError: () => {
      boundActionCreators.addDangerToast(t('Export failed - please try again'));
    },
  });

  const handleDownloadComplete = useCallback(() => {
    boundActionCreators.addSuccessToast(t('CSV file downloaded successfully'));
  }, [boundActionCreators]);
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

  // Chart state handler for stateful charts
  const handleChartStateChange = useCallback(
    chartState => {
      if (hasChartStateConverter(slice?.viz_type)) {
        dispatch(updateChartState(props.id, slice.viz_type, chartState));
      }
    },
    [dispatch, props.id, slice?.viz_type],
  );

  useEffect(() => {
    if (isExpanded) {
      const descriptionHeight =
        isExpanded && descriptionRef.current
          ? descriptionRef.current?.offsetHeight
          : 0;
      setDescriptionHeight(descriptionHeight);
    } else {
      setDescriptionHeight(0);
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
      const computedMarginBottom = getComputedStyle(
        headerRef.current,
      ).getPropertyValue('margin-bottom');
      const marginBottom = parseInt(computedMarginBottom, 10) || 0;
      const computedHeight = getComputedStyle(
        headerRef.current,
      ).getPropertyValue('height');
      const height = parseInt(computedHeight, 10) || DEFAULT_HEADER_HEIGHT;
      return height + marginBottom;
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
      is_cached: isCached,
    });
  }, [boundActionCreators.logEvent, slice.slice_id, isCached]);

  const chartConfiguration = useSelector(
    state => state.dashboardInfo.metadata?.chart_configuration,
  );
  const chartCustomizationItems = useSelector(
    state =>
      state.dashboardInfo.metadata?.chart_customization_config || EMPTY_ARRAY,
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
  const chartState = useSelector(
    state => state.dashboardState.chartStates?.[props.id],
  );
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
        chart: { id: chart.id, form_data: chart.form_data }, // avoid passing the whole chart object
        chartConfiguration,
        chartCustomizationItems,
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
      chart.id,
      chart.form_data,
      chartConfiguration,
      chartCustomizationItems,
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

  formData.dashboardId = dashboardInfo.id;

  const ownState = useMemo(() => {
    const baseOwnState = dataMask[props.id]?.ownState || EMPTY_OBJECT;
    return createOwnStateWithChartState(
      baseOwnState,
      chartState,
      slice.viz_type,
    );
  }, [
    dataMask[props.id]?.ownState,
    props.id,
    slice.viz_type,
    chartState?.state,
  ]);

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
        is_cached: isCached,
      });

      const exportFormData = isFullCSV
        ? { ...formData, row_limit: maxRows }
        : formData;
      const resultType = isPivot ? 'post_processed' : 'full';

      let actualRowCount;
      const isTableViz = formData?.viz_type === 'table';

      if (
        isTableViz &&
        queriesResponse?.length > 1 &&
        queriesResponse[1]?.data?.[0]?.rowcount
      ) {
        actualRowCount = queriesResponse[1].data[0].rowcount;
      } else if (queriesResponse?.[0]?.sql_rowcount != null) {
        actualRowCount = queriesResponse[0].sql_rowcount;
      } else {
        actualRowCount = exportFormData?.row_limit;
      }

      // Handle streaming CSV exports based on row threshold
      const shouldUseStreaming =
        format === 'csv' && !isPivot && actualRowCount >= streamingThreshold;
      let filename;
      if (shouldUseStreaming) {
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const time = now.toISOString().slice(11, 19).replace(/:/g, '');
        const timestamp = `_${date}_${time}`;
        const chartName = slice.slice_name || formData.viz_type || 'chart';
        const safeChartName = chartName.replace(/[^a-zA-Z0-9_-]/g, '_');
        filename = `${safeChartName}${timestamp}.csv`;
      }
      const baseOwnState = dataMask[props.id]?.ownState || {};
      const state = getChartStateWithFallback(
        chartState,
        formData,
        slice.viz_type,
      );

      const ownState = state
        ? {
            ...baseOwnState,
            ...convertChartStateToOwnState(slice.viz_type, state),
          }
        : baseOwnState;

      exportChart({
        formData: exportFormData,
        resultType,
        resultFormat: format,
        force: true,
        ownState,
        onStartStreamingExport: shouldUseStreaming
          ? exportParams => {
              setIsStreamingModalVisible(true);
              startExport({
                ...exportParams,
                filename,
                expectedRows: actualRowCount,
              });
            }
          : null,
      });
    },
    [
      slice.slice_id,
      slice.viz_type,
      isCached,
      formData,
      maxRows,
      dataMask[props.id]?.ownState,
      chartState,
      props.id,
      boundActionCreators.logEvent,
      queriesResponse,
      startExport,
      resetExport,
      streamingThreshold,
    ],
  );

  const exportCSV = useCallback(() => {
    exportTable('csv', false);
  }, [exportTable]);

  const exportFullCSV = useCallback(() => {
    exportTable('csv', true);
  }, [exportTable]);

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
      is_cached: isCached,
    });
    return boundActionCreators.refreshChart(chart.id, true, props.dashboardId);
  }, [
    boundActionCreators.refreshChart,
    chart.id,
    props.dashboardId,
    slice.slice_id,
    isCached,
    boundActionCreators.logEvent,
  ]);

  if (chart === EMPTY_OBJECT || slice === EMPTY_OBJECT) {
    return <MissingChart height={getChartHeight()} />;
  }

  const isLoading = chartStatus === 'loading';
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
        exportPivotExcel={exportPivotExcel}
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
          ownState={createOwnStateWithChartState(
            dataMask[props.id]?.ownState || EMPTY_OBJECT,
            {
              state: getChartStateWithFallback(
                chartState,
                formData,
                slice.viz_type,
              ),
            },
            slice.viz_type,
          )}
          filterState={dataMask[props.id]?.filterState}
          queriesResponse={chart.queriesResponse}
          timeout={timeout}
          triggerQuery={chart.triggerQuery}
          vizType={slice.viz_type}
          setControlValue={props.setControlValue}
          datasetsStatus={datasetsStatus}
          isInView={props.isInView}
          emitCrossFilters={emitCrossFilters}
          onChartStateChange={handleChartStateChange}
        />
      </ChartWrapper>

      <StreamingExportModal
        visible={isStreamingModalVisible}
        onCancel={() => {
          cancelExport();
          setIsStreamingModalVisible(false);
          resetExport();
        }}
        onRetry={retryExport}
        onDownload={handleDownloadComplete}
        progress={progress}
        exportType="csv"
      />
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
    (prevProps.componentId === nextProps.componentId &&
      prevProps.isComponentVisible &&
      prevProps.isInView === nextProps.isInView &&
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
