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
import { snakeCase, isEqual, cloneDeep } from 'lodash';
import {
  createRef,
  useCallback,
  useState,
  useRef,
  useMemo,
  MouseEvent,
  ReactNode,
  memo,
} from 'react';
import {
  SuperChart,
  Behavior,
  getChartMetadataRegistry,
  VizType,
  isFeatureEnabled,
  FeatureFlag,
  QueryFormData,
  AnnotationData,
  DataMask,
  QueryData,
  JsonObject,
  LatestQueryFormData,
  AgGridChartState,
  ContextMenuFilters,
  DataRecordFilters,
} from '@superset-ui/core';
import { logging } from '@apache-superset/core';
import { t, SupersetTheme } from '@apache-superset/core/ui';
import { useTheme } from '@emotion/react';
import { Logger, LOG_ACTIONS_RENDER_CHART } from 'src/logger/LogUtils';
import { EmptyState } from '@superset-ui/core/components';
import { ChartSource } from 'src/types/ChartSource';
import type { Datasource, ChartStatus } from 'src/explore/types';
import type { Dispatch } from 'redux';
import ChartContextMenu, {
  ChartContextMenuRef,
} from './ChartContextMenu/ChartContextMenu';

// Types for filter values
type FilterValue = string | number | boolean | null | undefined;

// LegendState type based on ECharts
interface LegendState {
  [name: string]: boolean;
}

// Webpack globals declaration
declare const __webpack_require__:
  | {
      h?: () => string;
    }
  | undefined;

// Types for chart actions
interface ChartActions {
  chartRenderingSucceeded: (chartId: number) => Dispatch;
  chartRenderingFailed: (
    error: string,
    chartId: number,
    componentStack: string | null,
  ) => Dispatch;
  logEvent: (
    eventName: string,
    payload: {
      slice_id: number;
      viz_type?: string;
      start_offset: number;
      ts: number;
      duration: number;
      has_err?: boolean;
      error_details?: string;
    },
  ) => Dispatch;
  updateDataMask?: (chartId: number, dataMask: DataMask) => Dispatch;
}

// Types for own state
interface OwnState {
  searchText?: string;
  agGridFilterModel?: Record<string, unknown>;
  [key: string]: unknown;
}

// Types for filter state
interface FilterState {
  value?: FilterValue[];
  [key: string]: unknown;
}

// Props interface
export interface ChartRendererProps {
  annotationData?: AnnotationData;
  actions: ChartActions;
  chartId: number;
  datasource?: Datasource;
  initialValues?: DataRecordFilters;
  formData: QueryFormData;
  latestQueryFormData?: LatestQueryFormData;
  labelsColor?: Record<string, string>;
  labelsColorMap?: Record<string, string>;
  height?: number;
  width?: number;
  setControlValue?: (name: string, value: unknown) => void;
  vizType: string;
  triggerRender?: boolean;
  chartAlert?: string;
  chartStatus?: ChartStatus | null;
  queriesResponse?: QueryData[] | null;
  triggerQuery?: boolean;
  chartIsStale?: boolean;
  addFilter?: (
    col: string,
    vals: FilterValue[],
    merge?: boolean,
    refresh?: boolean,
  ) => void;
  setDataMask?: (dataMask: DataMask) => void;
  onFilterMenuOpen?: (chartId: number, column: string) => void;
  onFilterMenuClose?: (chartId: number, column: string) => void;
  ownState?: OwnState;
  filterState?: FilterState;
  postTransformProps?: (props: JsonObject) => JsonObject;
  source?: ChartSource;
  emitCrossFilters?: boolean;
  cacheBusterProp?: string;
  onChartStateChange?: (chartState: AgGridChartState) => void;
  suppressLoadingSpinner?: boolean;
}

// Hooks interface
interface ChartHooks {
  onAddFilter: (
    col: string,
    vals: FilterValue[],
    merge?: boolean,
    refresh?: boolean,
  ) => void;
  onContextMenu?: (
    offsetX: number,
    offsetY: number,
    filters?: ContextMenuFilters,
  ) => void;
  onError: (error: Error, info: { componentStack: string } | null) => void;
  setControlValue: (name: string, value: unknown) => void;
  onFilterMenuOpen?: (chartId: number, column: string) => void;
  onFilterMenuClose?: (chartId: number, column: string) => void;
  onLegendStateChanged: (legendState: LegendState) => void;
  setDataMask: (dataMask: DataMask) => void;
  onLegendScroll: (legendIndex: number) => void;
  onChartStateChange?: (chartState: AgGridChartState) => void;
}

const BLANK = {};

const BIG_NO_RESULT_MIN_WIDTH = 300;
const BIG_NO_RESULT_MIN_HEIGHT = 220;

const behaviors = [Behavior.InteractiveChart];

interface ChartRendererState {
  showContextMenu: boolean;
  inContextMenu: boolean;
  legendState: LegendState | undefined;
  legendIndex: number;
}

interface PrevPropsRef {
  queriesResponse: QueryData[] | null | undefined;
  datasource: Datasource | undefined;
  annotationData: AnnotationData | undefined;
  ownState: OwnState | undefined;
  filterState: FilterState | undefined;
  height: number | undefined;
  width: number | undefined;
  triggerRender: boolean;
  labelsColor: Record<string, string> | undefined;
  labelsColorMap: Record<string, string> | undefined;
  formData: QueryFormData;
  cacheBusterProp: string | undefined;
  emitCrossFilters: boolean | undefined;
  postTransformProps: ((props: JsonObject) => JsonObject) | undefined;
}

function ChartRendererComponent({
  addFilter = () => BLANK,
  onFilterMenuOpen = () => BLANK,
  onFilterMenuClose = () => BLANK,
  initialValues = BLANK,
  setControlValue = () => {},
  triggerRender = false,
  ...restProps
}: ChartRendererProps): JSX.Element | null {
  const {
    annotationData,
    actions,
    chartId,
    datasource,
    formData,
    latestQueryFormData,
    labelsColor,
    labelsColorMap,
    height,
    width,
    vizType: propVizType,
    chartAlert,
    chartStatus,
    queriesResponse,
    chartIsStale,
    ownState,
    filterState,
    postTransformProps,
    source,
    emitCrossFilters,
    cacheBusterProp,
    onChartStateChange,
  } = restProps;

  const theme = useTheme() as SupersetTheme;

  const suppressContextMenu = getChartMetadataRegistry().get(
    formData.viz_type ?? propVizType,
  )?.suppressContextMenu;

  const [state, setState] = useState<ChartRendererState>({
    showContextMenu:
      source === ChartSource.Dashboard &&
      !suppressContextMenu &&
      isFeatureEnabled(FeatureFlag.DrillToDetail),
    inContextMenu: false,
    legendState: undefined,
    legendIndex: 0,
  });

  const hasQueryResponseChangeRef = useRef(false);
  const renderStartTimeRef = useRef(0);
  const mutableQueriesResponseRef = useRef<QueryData[] | null | undefined>(
    cloneDeep(queriesResponse),
  );
  const contextMenuRef = createRef<ChartContextMenuRef>();

  // Track previous props for shouldComponentUpdate logic
  const prevPropsRef = useRef<PrevPropsRef>({
    queriesResponse,
    datasource,
    annotationData,
    ownState,
    filterState,
    height,
    width,
    triggerRender,
    labelsColor,
    labelsColorMap,
    formData,
    cacheBusterProp,
    emitCrossFilters,
    postTransformProps,
  });

  // Handler functions
  const handleAddFilter = useCallback(
    (col: string, vals: FilterValue[], merge = true, refresh = true): void => {
      addFilter?.(col, vals, merge, refresh);
    },
    [addFilter],
  );

  const handleRenderSuccess = useCallback((): void => {
    if (['loading', 'rendered'].indexOf(chartStatus as string) < 0) {
      actions.chartRenderingSucceeded(chartId);
    }

    // only log chart render time which is triggered by query results change
    if (hasQueryResponseChangeRef.current) {
      actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
        slice_id: chartId,
        viz_type: propVizType,
        start_offset: renderStartTimeRef.current,
        ts: new Date().getTime(),
        duration: Logger.getTimestamp() - renderStartTimeRef.current,
      });
    }
  }, [actions, chartId, chartStatus, propVizType]);

  const handleRenderFailure = useCallback(
    (error: Error, info: { componentStack: string } | null): void => {
      logging.warn(error);
      actions.chartRenderingFailed(
        error.toString(),
        chartId,
        info ? info.componentStack : null,
      );

      // only trigger render log when query is changed
      if (hasQueryResponseChangeRef.current) {
        actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
          slice_id: chartId,
          has_err: true,
          error_details: error.toString(),
          start_offset: renderStartTimeRef.current,
          ts: new Date().getTime(),
          duration: Logger.getTimestamp() - renderStartTimeRef.current,
        });
      }
    },
    [actions, chartId],
  );

  const handleSetControlValue = useCallback(
    (name: string, value: unknown): void => {
      if (setControlValue) {
        setControlValue(name, value);
      }
    },
    [setControlValue],
  );

  const handleOnContextMenu = useCallback(
    (offsetX: number, offsetY: number, filters?: ContextMenuFilters): void => {
      contextMenuRef.current?.open(offsetX, offsetY, filters);
      setState(prev => ({ ...prev, inContextMenu: true }));
    },
    [contextMenuRef],
  );

  const handleContextMenuSelected = useCallback((): void => {
    setState(prev => ({ ...prev, inContextMenu: false }));
  }, []);

  const handleContextMenuClosed = useCallback((): void => {
    setState(prev => ({ ...prev, inContextMenu: false }));
  }, []);

  const handleLegendStateChanged = useCallback(
    (legendState: LegendState): void => {
      setState(prev => ({ ...prev, legendState }));
    },
    [],
  );

  const handleLegendScroll = useCallback((legendIndex: number): void => {
    setState(prev => ({ ...prev, legendIndex }));
  }, []);

  // When viz plugins don't handle `contextmenu` event, fallback handler
  // calls `handleOnContextMenu` with no `filters` param.
  const onContextMenuFallback = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      if (!state.inContextMenu) {
        event.preventDefault();
        handleOnContextMenu(event.clientX, event.clientY);
      }
    },
    [handleOnContextMenu, state.inContextMenu],
  );

  const setDataMaskCallback = useCallback(
    (dataMask: DataMask) => {
      actions?.updateDataMask?.(chartId, dataMask);
    },
    [actions, chartId],
  );

  // Hooks object - memoized
  const hooks = useMemo<ChartHooks>(
    () => ({
      onAddFilter: handleAddFilter,
      onContextMenu: state.showContextMenu ? handleOnContextMenu : undefined,
      onError: handleRenderFailure,
      setControlValue: handleSetControlValue,
      onFilterMenuOpen,
      onFilterMenuClose,
      onLegendStateChanged: handleLegendStateChanged,
      setDataMask: setDataMaskCallback,
      onLegendScroll: handleLegendScroll,
      onChartStateChange,
    }),
    [
      handleAddFilter,
      handleLegendScroll,
      handleLegendStateChanged,
      handleOnContextMenu,
      handleRenderFailure,
      handleSetControlValue,
      onChartStateChange,
      onFilterMenuClose,
      onFilterMenuOpen,
      setDataMaskCallback,
      state.showContextMenu,
    ],
  );

  // shouldComponentUpdate logic - implemented as a useMemo that tracks if we should render
  // Note: The return value is not used directly, but the useMemo contains necessary
  // side effects (updating refs).
  useMemo(() => {
    const prevProps = prevPropsRef.current;
    const resultsReady =
      queriesResponse &&
      ['success', 'rendered'].indexOf(chartStatus as string) > -1 &&
      !queriesResponse?.[0]?.error;

    if (resultsReady) {
      hasQueryResponseChangeRef.current =
        queriesResponse !== prevProps.queriesResponse;

      if (hasQueryResponseChangeRef.current) {
        mutableQueriesResponseRef.current = cloneDeep(queriesResponse);
      }

      // Check if any matrixify-related properties have changed
      const hasMatrixifyChanges = (): boolean => {
        const nextFormData = formData as JsonObject;
        const currentFormData = prevProps.formData as JsonObject;
        const isMatrixifyEnabled =
          nextFormData.matrixify_enable_vertical_layout === true ||
          nextFormData.matrixify_enable_horizontal_layout === true;
        if (!isMatrixifyEnabled) return false;

        // Check all matrixify-related properties
        const matrixifyKeys = Object.keys(nextFormData).filter(key =>
          key.startsWith('matrixify_'),
        );

        return matrixifyKeys.some(
          key => !isEqual(nextFormData[key], currentFormData[key]),
        );
      };

      const nextFormData = formData as JsonObject;
      const currentFormData = prevProps.formData as JsonObject;

      const shouldRender =
        hasQueryResponseChangeRef.current ||
        !isEqual(datasource, prevProps.datasource) ||
        annotationData !== prevProps.annotationData ||
        ownState !== prevProps.ownState ||
        filterState !== prevProps.filterState ||
        height !== prevProps.height ||
        width !== prevProps.width ||
        triggerRender === true ||
        labelsColor !== prevProps.labelsColor ||
        labelsColorMap !== prevProps.labelsColorMap ||
        nextFormData.color_scheme !== currentFormData.color_scheme ||
        nextFormData.stack !== currentFormData.stack ||
        nextFormData.subcategories !== currentFormData.subcategories ||
        cacheBusterProp !== prevProps.cacheBusterProp ||
        emitCrossFilters !== prevProps.emitCrossFilters ||
        postTransformProps !== prevProps.postTransformProps ||
        hasMatrixifyChanges();

      // Update prev props ref
      prevPropsRef.current = {
        queriesResponse,
        datasource,
        annotationData,
        ownState,
        filterState,
        height,
        width,
        triggerRender,
        labelsColor,
        labelsColorMap,
        formData,
        cacheBusterProp,
        emitCrossFilters,
        postTransformProps,
      };

      return shouldRender;
    }
    return false;
  }, [
    annotationData,
    cacheBusterProp,
    chartStatus,
    datasource,
    emitCrossFilters,
    filterState,
    formData,
    height,
    labelsColor,
    labelsColorMap,
    ownState,
    postTransformProps,
    queriesResponse,
    triggerRender,
    width,
  ]);

  const hasAnyErrors = queriesResponse?.some(item => item?.error);
  const hasValidPreviousData =
    (queriesResponse?.length ?? 0) > 0 && !hasAnyErrors;

  if (!!chartAlert || chartStatus === null) {
    return null;
  }

  if (chartStatus === 'loading') {
    if (!restProps.suppressLoadingSpinner || !hasValidPreviousData) {
      return null;
    }
  }

  renderStartTimeRef.current = Logger.getTimestamp();

  const currentFormData =
    chartIsStale && latestQueryFormData ? latestQueryFormData : formData;
  const vizType = currentFormData.viz_type || propVizType;

  // It's bad practice to use unprefixed `vizType` as classnames for chart
  // container. It may cause css conflicts as in the case of legacy table chart.
  // When migrating charts, we should gradually add a `superset-chart-` prefix
  // to each one of them.
  const snakeCaseVizType = snakeCase(vizType);
  const chartClassName =
    vizType === VizType.Table
      ? `superset-chart-${snakeCaseVizType}`
      : snakeCaseVizType;

  const webpackHash =
    process.env.WEBPACK_MODE === 'development'
      ? `-${
          // eslint-disable-next-line camelcase
          typeof __webpack_require__ !== 'undefined' &&
          // eslint-disable-next-line camelcase, no-undef
          typeof __webpack_require__.h === 'function' &&
          // eslint-disable-next-line no-undef, camelcase
          __webpack_require__.h()
        }`
      : '';

  let noResultsComponent: ReactNode;
  const noResultTitle = t('No results were returned for this query');
  const noResultDescription =
    source === ChartSource.Explore
      ? t(
          'Make sure that the controls are configured properly and the datasource contains data for the selected time range',
        )
      : undefined;
  const noResultImage = 'chart.svg';
  if (
    (width ?? 0) > BIG_NO_RESULT_MIN_WIDTH &&
    (height ?? 0) > BIG_NO_RESULT_MIN_HEIGHT
  ) {
    noResultsComponent = (
      <EmptyState
        size="large"
        title={noResultTitle}
        description={noResultDescription}
        image={noResultImage}
      />
    );
  } else {
    noResultsComponent = (
      <EmptyState title={noResultTitle} image={noResultImage} size="small" />
    );
  }

  // Check for Behavior.DRILL_TO_DETAIL to tell if chart can receive Drill to
  // Detail props or if it'll cause side-effects (e.g. excessive re-renders).
  const drillToDetailProps = getChartMetadataRegistry()
    .get(vizType)
    ?.behaviors.find(behavior => behavior === Behavior.DrillToDetail)
    ? { inContextMenu: state.inContextMenu }
    : {};
  // By pass no result component when server pagination is enabled & the table has:
  // - a backend search query, OR
  // - non-empty AG Grid filter model
  const hasSearchText = (ownState?.searchText?.length || 0) > 0;
  const hasAgGridFilters =
    ownState?.agGridFilterModel &&
    Object.keys(ownState.agGridFilterModel).length > 0;

  const currentFormDataExtended = currentFormData as JsonObject;
  const bypassNoResult = !(
    currentFormDataExtended?.server_pagination &&
    (hasSearchText || hasAgGridFilters)
  );

  return (
    <>
      {state.showContextMenu && (
        <ChartContextMenu
          ref={contextMenuRef}
          id={chartId}
          formData={currentFormData as QueryFormData}
          onSelection={handleContextMenuSelected}
          onClose={handleContextMenuClosed}
        />
      )}
      <div
        onContextMenu={
          state.showContextMenu ? onContextMenuFallback : undefined
        }
      >
        <SuperChart
          disableErrorBoundary
          key={`${chartId}${webpackHash}`}
          id={`chart-id-${chartId}`}
          className={chartClassName}
          chartType={vizType}
          width={width}
          height={height}
          theme={theme}
          annotationData={annotationData}
          datasource={datasource}
          initialValues={initialValues}
          formData={currentFormData}
          ownState={ownState}
          filterState={filterState}
          hooks={hooks as unknown as Parameters<typeof SuperChart>[0]['hooks']}
          behaviors={behaviors}
          queriesData={mutableQueriesResponseRef.current ?? undefined}
          onRenderSuccess={handleRenderSuccess}
          onRenderFailure={handleRenderFailure}
          noResults={noResultsComponent}
          postTransformProps={postTransformProps}
          emitCrossFilters={emitCrossFilters}
          legendState={state.legendState}
          enableNoResults={bypassNoResult}
          legendIndex={state.legendIndex}
          isRefreshing={
            Boolean(restProps.suppressLoadingSpinner) &&
            chartStatus === 'loading'
          }
          {...drillToDetailProps}
        />
      </div>
    </>
  );
}

const ChartRenderer = memo(ChartRendererComponent);

export default ChartRenderer;
