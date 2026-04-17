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
import type { ChartCustomization, JsonObject } from '@superset-ui/core';
import { styled, t } from '@apache-superset/core/ui';
import { debounce } from 'lodash';
import { bindActionCreators } from 'redux';
import { useDispatch, useSelector } from 'react-redux';

import { exportChart } from 'src/explore/exploreUtils';
import ChartContainer from 'src/components/Chart/ChartContainer';
import LastQueriedLabel from 'src/components/LastQueriedLabel';
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
import { DEFAULT_CSV_STREAMING_ROW_THRESHOLD } from 'src/constants';
import { enforceSharedLabelsColorsArray } from 'src/utils/colorScheme';
import exportPivotExcel from 'src/utils/downloadAsPivotExcel';
import type { RootState, Datasource, Slice } from 'src/dashboard/types';
import {
  convertChartStateToOwnState,
  hasChartStateConverter,
} from '../../../util/chartStateConverter';
import { useIsAutoRefreshing } from 'src/dashboard/contexts/AutoRefreshContext';

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
import { useChartCustomizationFromRedux } from '../../nativeFilters/state';
import { PLACEHOLDER_DATASOURCE } from '../../../constants';

interface ChartProps {
  id: number;
  componentId: string;
  dashboardId: number;
  width: number;
  height: number;
  updateSliceName: (sliceId: number, name: string) => void;
  isComponentVisible?: boolean;
  handleToggleFullSize: () => void;
  setControlValue?: (controlName: string, value: unknown) => void;
  sliceName: string;
  isFullSize?: boolean;
  extraControls?: JsonObject;
  isInView?: boolean;
  cacheBusterProp?: string | number;
}

const RESIZE_TIMEOUT = 500;
const DEFAULT_HEADER_HEIGHT = 22;
const QUERIED_LABEL_HEIGHT = 24;

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

const EMPTY_OBJECT: Record<string, never> = {};

// Helper function to get chart state with fallback
const getChartStateWithFallback = (
  chartState: { state?: JsonObject } | undefined,
  formData: JsonObject,
  vizType: string,
): JsonObject | null => {
  if (!hasChartStateConverter(vizType)) {
    return null;
  }

  return (
    chartState?.state || formData.table_state || formData.pivot_table_state
  );
};

// Helper function to create own state with chart state conversion
const createOwnStateWithChartState = (
  baseOwnState: JsonObject,
  chartState: { state?: JsonObject } | undefined,
  vizType: string,
): JsonObject => {
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

const Chart = (props: ChartProps) => {
  const dispatch = useDispatch();
  const descriptionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

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

  const chart = useSelector((state: RootState) => state.charts[props.id]);
  const queriesResponse = chart?.queriesResponse;
  const chartUpdateEndTime = chart?.chartUpdateEndTime;
  const chartStatus = chart?.chartStatus;
  const annotationQuery = chart?.annotationQuery;

  const slice: Slice | Record<string, never> = useSelector(
    (state: RootState) => state.sliceEntities.slices[props.id] || EMPTY_OBJECT,
  );
  const sliceVizType = slice.viz_type;
  const sliceSliceId = slice.slice_id;
  const sliceSliceName = slice.slice_name;
  const editMode = useSelector(
    (state: RootState) => state.dashboardState.editMode,
  );
  const isExpanded = useSelector(
    (state: RootState) =>
      !!(state.dashboardState as JsonObject).expandedSlices?.[props.id],
  );
  const supersetCanExplore = useSelector(
    (state: RootState) =>
      !!(state.dashboardInfo as JsonObject).superset_can_explore,
  );
  const supersetCanShare = useSelector(
    (state: RootState) =>
      !!(state.dashboardInfo as JsonObject).superset_can_share,
  );
  const supersetCanCSV = useSelector(
    (state: RootState) =>
      !!(state.dashboardInfo as JsonObject).superset_can_csv,
  );
  const timeout: number = useSelector(
    (state: RootState) =>
      state.dashboardInfo.common.conf.SUPERSET_WEBSERVER_TIMEOUT as number,
  );
  const emitCrossFilters = useSelector(
    (state: RootState) => !!state.dashboardInfo.crossFiltersEnabled,
  );
  const maxRows: number = useSelector(
    (state: RootState) => state.dashboardInfo.common.conf.SQL_MAX_ROW as number,
  );
  const streamingThreshold: number = useSelector(
    (state: RootState) =>
      (state.dashboardInfo.common.conf.CSV_STREAMING_ROW_THRESHOLD as number) ||
      DEFAULT_CSV_STREAMING_ROW_THRESHOLD,
  );
  const datasource: Datasource = useSelector(
    (state: RootState) =>
      (chart?.form_data?.datasource &&
        state.datasources[chart.form_data.datasource]) ||
      PLACEHOLDER_DATASOURCE,
  );
  const dashboardInfo = useSelector((state: RootState) => state.dashboardInfo);
  const showChartTimestamps: boolean = useSelector(
    (state: RootState) =>
      (state.dashboardInfo?.metadata as JsonObject)?.show_chart_timestamps ??
      false,
  );
  const suppressLoadingSpinner = useIsAutoRefreshing();

  const isCached: boolean[] = useMemo(
    () =>
      queriesResponse?.map(
        // eslint-disable-next-line camelcase
        (q: JsonObject) => q.is_cached as boolean,
      ) || [],
    [queriesResponse],
  );

  const [descriptionHeight, setDescriptionHeight] = useState(0);
  const [height, setHeight] = useState(props.height);
  const [width, setWidth] = useState(props.width);

  const [isStreamingModalVisible, setIsStreamingModalVisible] = useState(false);
  const { progress, startExport, cancelExport, resetExport, retryExport } =
    useStreamingExport({
      onComplete: () => {
        // Don't show toast here - wait for user to click Download button
      },
      onError: () => {
        boundActionCreators.addDangerToast(
          t('Export failed - please try again'),
        );
      },
    });

  const handleDownloadComplete = useCallback(() => {
    boundActionCreators.addSuccessToast(t('CSV file downloaded successfully'));
  }, [boundActionCreators]);
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  const resize = useCallback(
    debounce(() => {
      const { width, height } = props;
      setHeight(height);
      setWidth(width);
    }, RESIZE_TIMEOUT),
    [props.width, props.height],
  );

  const ownColorScheme = chart?.form_data?.color_scheme as string | undefined;

  const addFilter = useCallback(
    (col: string, vals: unknown[], merge = true, _refresh = true) => {
      boundActionCreators.logEvent(LOG_ACTIONS_CHANGE_DASHBOARD_FILTER, {
        id: chart?.id,
        columns: vals !== null ? [col] : [],
      });
      boundActionCreators.changeFilter(chart?.id, { [col]: vals }, merge);
    },
    [boundActionCreators.logEvent, boundActionCreators.changeFilter, chart?.id],
  );

  // Chart state handler for stateful charts
  const handleChartStateChange = useCallback(
    (chartStateArg: JsonObject) => {
      if (hasChartStateConverter(sliceVizType)) {
        dispatch(
          updateChartState(
            props.id,
            sliceVizType,
            chartStateArg as unknown as import('@superset-ui/core').AgGridChartState,
          ),
        );
      }
    },
    [dispatch, props.id, sliceVizType],
  );

  useEffect(() => {
    if (isExpanded) {
      const descHeight =
        isExpanded && descriptionRef.current
          ? descriptionRef.current?.offsetHeight
          : 0;
      setDescriptionHeight(descHeight);
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

  const getHeaderHeight = useCallback((): number => {
    if (headerRef.current) {
      const computedMarginBottom = getComputedStyle(
        headerRef.current,
      ).getPropertyValue('margin-bottom');
      const marginBottom = parseInt(computedMarginBottom, 10) || 0;
      const computedHeight = getComputedStyle(
        headerRef.current,
      ).getPropertyValue('height');
      const headerHeight =
        parseInt(computedHeight, 10) || DEFAULT_HEADER_HEIGHT;
      return headerHeight + marginBottom;
    }
    return DEFAULT_HEADER_HEIGHT;
  }, [headerRef]);

  const queriedDttm: string | null = Array.isArray(queriesResponse)
    ? (((queriesResponse[queriesResponse.length - 1] as JsonObject)
        ?.queried_dttm as string | null) ?? null)
    : null;

  const getChartHeight = useCallback((): number => {
    const headerHeight = getHeaderHeight();
    const queriedLabelHeight =
      showChartTimestamps && queriedDttm != null ? QUERIED_LABEL_HEIGHT : 0;
    return Math.max(
      height - headerHeight - descriptionHeight - queriedLabelHeight,
      20,
    );
  }, [
    getHeaderHeight,
    height,
    descriptionHeight,
    queriedDttm,
    showChartTimestamps,
  ]);

  const handleFilterMenuOpen = useCallback(
    (chartId: number, column: string) => {
      boundActionCreators.setFocusedFilterField(chartId, column);
    },
    [boundActionCreators.setFocusedFilterField],
  );

  const handleFilterMenuClose = useCallback(
    (chartId: number, column: string) => {
      boundActionCreators.unsetFocusedFilterField(chartId, column);
    },
    [boundActionCreators.unsetFocusedFilterField],
  );

  const logExploreChart = useCallback(() => {
    boundActionCreators.logEvent(LOG_ACTIONS_EXPLORE_DASHBOARD_CHART, {
      slice_id: sliceSliceId,
      is_cached: isCached,
    });
  }, [boundActionCreators.logEvent, sliceSliceId, isCached]);

  const chartConfiguration = useSelector(
    (state: RootState) => state.dashboardInfo.metadata?.chart_configuration,
  );
  const chartCustomizationItems = useChartCustomizationFromRedux();
  const colorScheme = useSelector(
    (state: RootState) => state.dashboardState.colorScheme,
  );
  const colorNamespace = useSelector(
    (state: RootState) =>
      (state.dashboardState as JsonObject).colorNamespace as string | undefined,
  );
  const datasetsStatus = useSelector(
    (state: RootState) =>
      (state.dashboardState as JsonObject).datasetsStatus as string | undefined,
  );
  const allSliceIds = useSelector(
    (state: RootState) => state.dashboardState.sliceIds,
  );
  const nativeFilters = useSelector(
    (state: RootState) => state.nativeFilters?.filters,
  );
  const dataMask = useSelector((state: RootState) => state.dataMask);
  const dataMaskOwnState = dataMask[props.id]?.ownState;
  const chartState = useSelector(
    (state: RootState) => state.dashboardState.chartStates?.[props.id],
  );
  const labelsColor: JsonObject = useSelector(
    (state: RootState) =>
      state.dashboardInfo?.metadata?.label_colors || EMPTY_OBJECT,
  );
  const labelsColorMap: JsonObject = useSelector(
    (state: RootState) =>
      state.dashboardInfo?.metadata?.map_label_colors || EMPTY_OBJECT,
  );
  const sharedLabelsColors = useSelector((state: RootState) =>
    enforceSharedLabelsColorsArray(
      state.dashboardInfo?.metadata?.shared_label_colors,
    ),
  );

  const formData = useMemo(
    () =>
      getFormDataWithExtraFilters({
        chart: { id: chart?.id ?? props.id, form_data: chart?.form_data }, // avoid passing the whole chart object
        chartConfiguration,
        chartCustomizationItems:
          chartCustomizationItems as ChartCustomization[],
        filters: getAppliedFilterValues(props.id),
        colorScheme,
        colorNamespace,
        sliceId: props.id,
        nativeFilters,
        allSliceIds,
        dataMask,
        extraControls: (props.extraControls || {}) as Record<
          string,
          string | boolean | null
        >,
        labelsColor,
        labelsColorMap,
        sharedLabelsColors,
        ownColorScheme,
      }),
    [
      chart?.id,
      chart?.form_data,
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

  (formData as JsonObject).dashboardId = dashboardInfo.id;

  const exportTable = useCallback(
    (format: string, isFullCSV: boolean, isPivot = false) => {
      const logAction =
        format === 'csv'
          ? LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART
          : LOG_ACTIONS_EXPORT_XLSX_DASHBOARD_CHART;
      boundActionCreators.logEvent(logAction, {
        slice_id: sliceSliceId,
        is_cached: isCached,
      });

      const exportFormData = isFullCSV
        ? { ...formData, row_limit: maxRows }
        : formData;
      const resultType = isPivot ? 'post_processed' : 'full';

      let actualRowCount: number | undefined;
      const isTableViz = (formData as JsonObject)?.viz_type === 'table';

      if (
        isTableViz &&
        queriesResponse &&
        queriesResponse.length > 1 &&
        (queriesResponse[1] as JsonObject)?.data?.[0]?.rowcount
      ) {
        actualRowCount = (
          (queriesResponse[1] as JsonObject).data as JsonObject[]
        )[0].rowcount as number;
      } else if ((queriesResponse?.[0] as JsonObject)?.sql_rowcount != null) {
        actualRowCount = (queriesResponse![0] as JsonObject)
          .sql_rowcount as number;
      } else if ((queriesResponse?.[0] as JsonObject)?.rowcount != null) {
        actualRowCount = (queriesResponse![0] as JsonObject).rowcount as number;
      } else {
        actualRowCount = (exportFormData as JsonObject)?.row_limit as
          | number
          | undefined;
      }

      // Handle streaming CSV exports based on row threshold
      const shouldUseStreaming =
        format === 'csv' &&
        !isPivot &&
        actualRowCount !== undefined &&
        actualRowCount >= streamingThreshold;
      let filename: string | undefined;
      if (shouldUseStreaming) {
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const time = now.toISOString().slice(11, 19).replace(/:/g, '');
        const timestamp = `_${date}_${time}`;
        const chartName =
          sliceSliceName || (formData as JsonObject).viz_type || 'chart';
        const safeChartName = (chartName as string).replace(
          /[^a-zA-Z0-9_-]/g,
          '_',
        );
        filename = `${safeChartName}${timestamp}.csv`;
      }
      const baseOwnState =
        (dataMask[props.id]?.ownState as Record<string, unknown>) || {};
      const state = getChartStateWithFallback(
        chartState as { state?: JsonObject } | undefined,
        formData,
        sliceVizType,
      );

      const exportOwnState = state
        ? {
            ...baseOwnState,
            ...convertChartStateToOwnState(sliceVizType, state),
          }
        : baseOwnState;

      exportChart({
        formData:
          exportFormData as unknown as import('@superset-ui/core').QueryFormData,
        resultType,
        resultFormat: format,
        force: true,
        ownState: exportOwnState,
        onStartStreamingExport: shouldUseStreaming
          ? (exportParams: JsonObject) => {
              setIsStreamingModalVisible(true);
              startExport({
                ...(exportParams as Record<string, unknown>),
                filename,
                expectedRows: actualRowCount,
              } as Parameters<typeof startExport>[0]);
            }
          : null,
      });
    },
    [
      sliceSliceId,
      sliceVizType,
      isCached,
      formData,
      maxRows,
      dataMaskOwnState,
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
      slice_id: sliceSliceId,
      is_cached: isCached,
    });
    return boundActionCreators.refreshChart(
      chart?.id ?? props.id,
      true,
      props.dashboardId,
    );
  }, [
    boundActionCreators.refreshChart,
    chart?.id,
    props.dashboardId,
    sliceSliceId,
    isCached,
    boundActionCreators.logEvent,
  ]);

  if (!chart || (slice as unknown) === EMPTY_OBJECT) {
    return <MissingChart height={getChartHeight()} />;
  }

  const isLoading = chartStatus === 'loading';
  const cachedDttm: string[] =
    queriesResponse?.map(
      // eslint-disable-next-line camelcase
      (q: JsonObject) => q.cached_dttm as string,
    ) || [];

  // Build slice header shape matching SliceHeaderControlsProps
  const sliceForHeader = {
    description: slice.description || '',
    viz_type: slice.viz_type,
    slice_name: slice.slice_name,
    slice_id: slice.slice_id,
    slice_description: '',
    datasource: slice.form_data?.datasource || '',
  };

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
        slice={sliceForHeader}
        isExpanded={isExpanded}
        isCached={isCached as boolean[]}
        cachedDttm={cachedDttm as string[]}
        queriedDttm={queriedDttm as string | null | undefined}
        updatedDttm={chartUpdateEndTime ?? null}
        toggleExpandSlice={boundActionCreators.toggleExpandSlice}
        forceRefresh={forceRefresh}
        editMode={editMode}
        annotationQuery={annotationQuery}
        logExploreChart={logExploreChart}
        logEvent={boundActionCreators.logEvent}
        exportCSV={exportCSV}
        exportPivotCSV={exportPivotCSV}
        exportXLSX={exportXLSX}
        exportFullCSV={exportFullCSV}
        exportFullXLSX={exportFullXLSX}
        updateSliceName={(name: string) =>
          props.updateSliceName(props.id, name)
        }
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
        chartStatus={chartStatus || ''}
        formData={
          formData as unknown as import('@superset-ui/core').QueryFormData
        }
        exploreUrl=""
        width={width}
        height={getHeaderHeight()}
        exportPivotExcel={exportPivotExcel as unknown as (arg0: string) => void}
      />

      {/*
          This usage of dangerouslySetInnerHTML is safe since it is being used to render
          markdown that is sanitized with nh3. See:
             https://github.com/apache/superset/pull/4390
          and
             https://github.com/apache/superset/pull/23862
        */}
      {isExpanded && slice.description_markdown && (
        <div
          className="slice_description bs-callout bs-callout-default"
          ref={descriptionRef}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: slice.description_markdown,
          }}
          role="complementary"
        />
      )}

      <ChartWrapper
        className={cx('dashboard-chart')}
        aria-label={slice.description}
      >
        {isLoading && !suppressLoadingSpinner && (
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
          annotationData={chart.annotationData ?? undefined}
          chartAlert={chart.chartAlert ?? undefined}
          chartId={props.id}
          chartStatus={chartStatus ?? undefined}
          datasource={datasource}
          dashboardId={props.dashboardId}
          initialValues={EMPTY_OBJECT}
          formData={
            formData as unknown as import('@superset-ui/core').QueryFormData
          }
          ownState={createOwnStateWithChartState(
            (dataMask[props.id]?.ownState as JsonObject) || EMPTY_OBJECT,
            {
              state:
                getChartStateWithFallback(
                  chartState as { state?: JsonObject } | undefined,
                  formData as JsonObject,
                  slice.viz_type,
                ) ?? undefined,
            },
            slice.viz_type,
          )}
          queriesResponse={chart.queriesResponse ?? null}
          timeout={timeout}
          triggerQuery={chart.triggerQuery}
          vizType={slice.viz_type}
          setControlValue={props.setControlValue ?? (() => {})}
          datasetsStatus={
            datasetsStatus as 'loading' | 'error' | 'complete' | undefined
          }
          isInView={props.isInView}
          emitCrossFilters={emitCrossFilters}
          onChartStateChange={handleChartStateChange}
          suppressLoadingSpinner={suppressLoadingSpinner}
        />
      </ChartWrapper>

      {!isLoading && showChartTimestamps && queriedDttm != null && (
        <LastQueriedLabel queriedDttm={queriedDttm} />
      )}

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
      />
    </SliceContainer>
  );
};

export default memo(Chart, (prevProps: ChartProps, nextProps: ChartProps) => {
  if (prevProps.cacheBusterProp !== nextProps.cacheBusterProp) {
    return false;
  }
  return !!(
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
