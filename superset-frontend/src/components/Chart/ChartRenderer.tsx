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
import { snakeCase, cloneDeep } from 'lodash';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  SuperChart,
  logging,
  Behavior,
  t,
  isFeatureEnabled,
  FeatureFlag,
  getChartMetadataRegistry,
  QueryFormData,
  ChartDataResponse,
  VizType as enumVizType,
  JsonObject,
  FilterState,
} from '@superset-ui/core';
import { Logger, LOG_ACTIONS_RENDER_CHART } from 'src/logger/LogUtils';
import { EmptyState } from 'src/components/EmptyState';
import { ChartSource } from 'src/types/ChartSource';
import { Annotation } from 'src/explore/components/controls/AnnotationLayerControl';
import ChartContextMenu from './ChartContextMenu/ChartContextMenu';
import { Actions } from './Chart';

type ChartRendererProps = {
  dashboardId?: number;
  latestQueryFormData?: QueryFormData;
  labelsColorMap?: string;
  setDataMask?: (dataMask: any) => void;
  source?: ChartSource;
  annotationData?: Annotation;
  actions: Actions;
  chartId: string;
  datasource?: {
    database?: {
      name: string;
    };
  };
  initialValues?: object;
  formData: QueryFormData;
  labelsColor?: string;
  height?: number;
  width?: number;
  setControlValue?: Function;
  vizType: string;
  triggerRender?: boolean;
  chartAlert?: string;
  chartStatus?: string;
  queriesResponse?: ChartDataResponse[];
  triggerQuery?: boolean;
  chartIsStale?: boolean;
  filterState?: FilterState[];
  addFilter?: (
    col: string,
    vals: string | string[],
    merge: boolean,
    refresh: boolean,
  ) => void;
  onFilterMenuOpen?: (chartId: string, column: string) => void;
  onFilterMenuClose?: (chartId: string, column: string) => void;
  ownState?: boolean | JsonObject;
  postTransformProps?: Function;
  emitCrossFilters?: boolean;
};

const BLANK = {};
const BIG_NO_RESULT_MIN_WIDTH = 300;
const BIG_NO_RESULT_MIN_HEIGHT = 220;
const behaviors = [Behavior.InteractiveChart];

const ChartRenderer = (props: ChartRendererProps) => {
  const {
    annotationData,
    actions,
    chartId,
    datasource,
    initialValues = BLANK,
    formData,
    latestQueryFormData,
    height,
    width,
    setControlValue,
    vizType,
    chartStatus,
    queriesResponse = [],
    chartIsStale,
    chartAlert,
    addFilter = () => BLANK,
    setDataMask,
    onFilterMenuOpen = () => BLANK,
    onFilterMenuClose = () => BLANK,
    ownState,
    filterState,
    postTransformProps,
    source,
  } = props;

  const hasQueryResponseChange = false;
  const suppressContextMenu = getChartMetadataRegistry().get(
    formData.viz_type ?? vizType,
  )?.suppressContextMenu;

  const [showContextMenu, setShowContextMenu] = useState<Boolean>(false);
  const [inContextMenu, setInContextMenu] = useState(false);
  const [legendState, setLegendState] = useState<any>(undefined);
  const contextMenuRef = useRef<any>(null);
  const mutableQueriesResponse = useRef(cloneDeep(queriesResponse));
  const renderStartTime = useRef<number>(0);

  if (chartStatus === 'loading' || !!chartAlert || chartStatus === null) {
    return null;
  }

  useEffect(() => {
    mutableQueriesResponse.current = cloneDeep(queriesResponse);
  }, [queriesResponse]);

  useEffect(() => {
    const shouldShowContextMenu =
      source === ChartSource.Dashboard &&
      !suppressContextMenu &&
      isFeatureEnabled(FeatureFlag.DrillToDetail);

    setShowContextMenu(shouldShowContextMenu);
  }, [source, suppressContextMenu]);

  // only log chart render time which is triggered by query results change
  // currently we don't log chart re-render time, like window resize etc
  if (hasQueryResponseChange) {
    actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
      slice_id: chartId,
      has_err: false,
      error_details: '',
      start_offset: renderStartTime.current,
      ts: new Date().getTime(),
      duration: Logger.getTimestamp() - renderStartTime.current,
    });
  }
  const handleAddFilter = (
    col: string,
    vals: string | string[],
    merge = true,
    refresh = true,
  ) => {
    alert(col);
    console.log(col, vals, merge, refresh);
    addFilter(col, vals, merge, refresh);
  };

  const handleOnContextMenu = (
    offsetX: number,
    offsetY: number,
    filters: undefined,
  ) => {
    contextMenuRef.current.open(offsetX, offsetY, filters);
    // setInContextMenu({ inContextMenu: true });
    setInContextMenu(true);
  };

  const handleSetControlValue = (...args: string[]) => {
    setControlValue;
    if (setControlValue) {
      setControlValue(...args);
    }
  };

  const handleRenderFailure = (
    error: { toString: () => string },
    info: { componentStack: string } | null,
  ) => {
    logging.warn(error);
    actions.chartRenderingFailed(
      error.toString(),
      chartId,
      info ? info.componentStack : null,
    );

    // only trigger render log when query is changed
    if (hasQueryResponseChange) {
      actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
        slice_id: chartId,
        has_err: true,
        error_details: error.toString(),
        start_offset: renderStartTime.current,
        ts: new Date().getTime(),
        duration: Logger.getTimestamp() - renderStartTime.current,
      });
    }
  };

  const handleRenderSuccess = useCallback(() => {
    if (!['loading', 'rendered'].includes(chartStatus || '')) {
      actions.chartRenderingSucceeded({ key: chartId });
    }
    actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
      slice_id: chartId,
      has_err: false,
      error_details: '',
      start_offset: renderStartTime.current,
      ts: new Date().getTime(),
      duration: Logger.getTimestamp() - renderStartTime.current,
    });
  }, [actions, chartId, chartStatus, vizType]);

  // renderStartTime.current = Logger.getTimestamp();

  const currentFormData =
    chartIsStale && latestQueryFormData ? latestQueryFormData : formData;

  const snakeCaseVizType = snakeCase(currentFormData.viz_type || vizType);

  const chartClassName =
    vizType === enumVizType.Table
      ? `superset-chart-${snakeCaseVizType}`
      : snakeCaseVizType;

  const webpackHash =
    process.env.WEBPACK_MODE === 'development'
      ? `-${
          // eslint-disable-next-line camelcase
          // @ts-ignore
          typeof __webpack_require__ !== 'undefined' &&
          // @ts-ignore
          typeof __webpack_require__.h === 'function' &&
          // eslint-disable-next-line camelcase, no-undef
          // @ts-ignore
          typeof __webpack_require__.h === 'function' &&
          // eslint-disable-next-line no-undef, camelcase
          // @ts-ignore
          __webpack_require__.h()
        }`
      : '';

  let noResultsComponent;
  const noResultTitle = t('No results were returned for this query');
  const noResultDescription =
    source === ChartSource.Explore
      ? t(
          'Make sure that the controls are configured properly and the datasource contains data for the selected time range',
        )
      : undefined;
  const noResultImage = 'chart.svg';

  if (
    typeof width === 'number' &&
    typeof height === 'number' &&
    width > BIG_NO_RESULT_MIN_WIDTH &&
    height > BIG_NO_RESULT_MIN_HEIGHT
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
      <EmptyState size="small" title={noResultTitle} image={noResultImage} />
    );
  }

  // Check for Behavior.DRILL_TO_DETAIL to tell if chart can receive Drill to
  // Detail props or if it'll cause side-effects (e.g. excessive re-renders).
  const drillToDetailProps = getChartMetadataRegistry()
    .get(formData.viz_type)
    ?.behaviors.find(behavior => behavior === Behavior.DrillToDetail)
    ? { inContextMenu }
    : {};

  const hooks = useMemo(
    () => ({
      onAddFilter: handleAddFilter,
      onContextMenu: showContextMenu ? handleOnContextMenu : undefined,
      onError: handleRenderFailure,
      setControlValue: handleSetControlValue,
      onFilterMenuOpen,
      onFilterMenuClose,
      onLegendChange: setLegendState,
      setDataMask: (dataMask: any) =>
        actions?.updateDataMask(chartId, { dataMask }),
    }),
    [
      handleAddFilter,
      showContextMenu,
      handleOnContextMenu,
      handleRenderFailure,
      handleSetControlValue,
      onFilterMenuOpen,
      onFilterMenuClose,
      setLegendState,
      legendState,
      setDataMask,
      chartId,
    ],
  );

  return (
    <>
      {showContextMenu && (
        <ChartContextMenu
          ref={contextMenuRef}
          id={chartId as unknown as number}
          formData={currentFormData}
          onSelection={() => setInContextMenu(false)}
          onClose={() => setInContextMenu(false)}
        />
      )}
      <div
        onContextMenu={
          showContextMenu
            ? event => {
                event.preventDefault();
                handleOnContextMenu(event.clientX, event.clientY, undefined);
              }
            : undefined
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
          annotationData={annotationData}
          datasource={datasource}
          initialValues={initialValues}
          formData={currentFormData}
          ownState={ownState}
          filterState={filterState}
          hooks={hooks}
          behaviors={behaviors}
          queriesData={mutableQueriesResponse.current}
          onRenderSuccess={handleRenderSuccess}
          onRenderFailure={handleRenderFailure}
          noResults={noResultsComponent}
          postTransformProps={postTransformProps}
          // emitCrossFilters={emitCrossFilters}
          legendState={legendState}
          {...drillToDetailProps}
        />
      </div>
    </>
  );
};

export default ChartRenderer;
