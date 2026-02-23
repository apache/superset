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
import { createRef, Component, RefObject, MouseEvent, ReactNode } from 'react';
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
import { t } from '@apache-superset/core/ui';
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

// State interface
interface ChartRendererState {
  showContextMenu: boolean;
  inContextMenu: boolean;
  legendState: LegendState | undefined;
  legendIndex: number;
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

const defaultProps: Partial<ChartRendererProps> = {
  addFilter: () => BLANK,
  onFilterMenuOpen: () => BLANK,
  onFilterMenuClose: () => BLANK,
  initialValues: BLANK,
  setControlValue: () => {},
  triggerRender: false,
};

class ChartRenderer extends Component<ChartRendererProps, ChartRendererState> {
  static defaultProps = defaultProps;

  private hasQueryResponseChange: boolean;

  private contextMenuRef: RefObject<ChartContextMenuRef>;

  private hooks: ChartHooks;

  private mutableQueriesResponse: QueryData[] | null | undefined;

  private renderStartTime: number;

  constructor(props: ChartRendererProps) {
    super(props);
    const suppressContextMenu = getChartMetadataRegistry().get(
      props.formData.viz_type ?? props.vizType,
    )?.suppressContextMenu;
    this.state = {
      showContextMenu:
        props.source === ChartSource.Dashboard &&
        !suppressContextMenu &&
        isFeatureEnabled(FeatureFlag.DrillToDetail),
      inContextMenu: false,
      legendState: undefined,
      legendIndex: 0,
    };
    this.hasQueryResponseChange = false;
    this.renderStartTime = 0;

    this.contextMenuRef = createRef<ChartContextMenuRef>();

    this.handleAddFilter = this.handleAddFilter.bind(this);
    this.handleRenderSuccess = this.handleRenderSuccess.bind(this);
    this.handleRenderFailure = this.handleRenderFailure.bind(this);
    this.handleSetControlValue = this.handleSetControlValue.bind(this);
    this.handleOnContextMenu = this.handleOnContextMenu.bind(this);
    this.handleContextMenuSelected = this.handleContextMenuSelected.bind(this);
    this.handleContextMenuClosed = this.handleContextMenuClosed.bind(this);
    this.handleLegendStateChanged = this.handleLegendStateChanged.bind(this);
    this.onContextMenuFallback = this.onContextMenuFallback.bind(this);
    this.handleLegendScroll = this.handleLegendScroll.bind(this);

    this.hooks = {
      onAddFilter: this.handleAddFilter,
      onContextMenu: this.state.showContextMenu
        ? this.handleOnContextMenu
        : undefined,
      onError: this.handleRenderFailure,
      setControlValue: this.handleSetControlValue,
      onFilterMenuOpen: this.props.onFilterMenuOpen,
      onFilterMenuClose: this.props.onFilterMenuClose,
      onLegendStateChanged: this.handleLegendStateChanged,
      setDataMask: (dataMask: DataMask) => {
        this.props.actions?.updateDataMask?.(this.props.chartId, dataMask);
      },
      onLegendScroll: this.handleLegendScroll,
      onChartStateChange: this.props.onChartStateChange,
    };

    // TODO: queriesResponse comes from Redux store but it's being edited by
    // the plugins, hence we need to clone it to avoid state mutation
    // until we change the reducers to use Redux Toolkit with Immer
    this.mutableQueriesResponse = cloneDeep(this.props.queriesResponse);
  }

  shouldComponentUpdate(
    nextProps: ChartRendererProps,
    nextState: ChartRendererState,
  ): boolean {
    const resultsReady =
      nextProps.queriesResponse &&
      ['success', 'rendered'].indexOf(nextProps.chartStatus as string) > -1 &&
      !nextProps.queriesResponse?.[0]?.error;

    if (resultsReady) {
      if (!isEqual(this.state, nextState)) {
        return true;
      }
      this.hasQueryResponseChange =
        nextProps.queriesResponse !== this.props.queriesResponse;

      if (this.hasQueryResponseChange) {
        this.mutableQueriesResponse = cloneDeep(nextProps.queriesResponse);
      }

      // Check if any matrixify-related properties have changed
      const hasMatrixifyChanges = (): boolean => {
        const nextFormData = nextProps.formData as JsonObject;
        const currentFormData = this.props.formData as JsonObject;
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

      const nextFormData = nextProps.formData as JsonObject;
      const currentFormData = this.props.formData as JsonObject;

      return (
        this.hasQueryResponseChange ||
        !isEqual(nextProps.datasource, this.props.datasource) ||
        nextProps.annotationData !== this.props.annotationData ||
        nextProps.ownState !== this.props.ownState ||
        nextProps.filterState !== this.props.filterState ||
        nextProps.height !== this.props.height ||
        nextProps.width !== this.props.width ||
        nextProps.triggerRender === true ||
        nextProps.labelsColor !== this.props.labelsColor ||
        nextProps.labelsColorMap !== this.props.labelsColorMap ||
        nextFormData.color_scheme !== currentFormData.color_scheme ||
        nextFormData.stack !== currentFormData.stack ||
        nextFormData.subcategories !== currentFormData.subcategories ||
        nextProps.cacheBusterProp !== this.props.cacheBusterProp ||
        nextProps.emitCrossFilters !== this.props.emitCrossFilters ||
        nextProps.postTransformProps !== this.props.postTransformProps ||
        hasMatrixifyChanges()
      );
    }
    return false;
  }

  handleAddFilter(
    col: string,
    vals: FilterValue[],
    merge = true,
    refresh = true,
  ): void {
    this.props.addFilter?.(col, vals, merge, refresh);
  }

  handleRenderSuccess(): void {
    const { actions, chartStatus, chartId, vizType } = this.props;
    if (['loading', 'rendered'].indexOf(chartStatus as string) < 0) {
      actions.chartRenderingSucceeded(chartId);
    }

    // only log chart render time which is triggered by query results change
    // currently we don't log chart re-render time, like window resize etc
    if (this.hasQueryResponseChange) {
      actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
        slice_id: chartId,
        viz_type: vizType,
        start_offset: this.renderStartTime,
        ts: new Date().getTime(),
        duration: Logger.getTimestamp() - this.renderStartTime,
      });
    }
  }

  handleRenderFailure(
    error: Error,
    info: { componentStack: string } | null,
  ): void {
    const { actions, chartId } = this.props;
    logging.warn(error);
    actions.chartRenderingFailed(
      error.toString(),
      chartId,
      info ? info.componentStack : null,
    );

    // only trigger render log when query is changed
    if (this.hasQueryResponseChange) {
      actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
        slice_id: chartId,
        has_err: true,
        error_details: error.toString(),
        start_offset: this.renderStartTime,
        ts: new Date().getTime(),
        duration: Logger.getTimestamp() - this.renderStartTime,
      });
    }
  }

  handleSetControlValue(name: string, value: unknown): void {
    const { setControlValue } = this.props;
    if (setControlValue) {
      setControlValue(name, value);
    }
  }

  handleOnContextMenu(
    offsetX: number,
    offsetY: number,
    filters?: ContextMenuFilters,
  ): void {
    this.contextMenuRef.current?.open(offsetX, offsetY, filters);
    this.setState({ inContextMenu: true });
  }

  handleContextMenuSelected(): void {
    this.setState({ inContextMenu: false });
  }

  handleContextMenuClosed(): void {
    this.setState({ inContextMenu: false });
  }

  handleLegendStateChanged(legendState: LegendState): void {
    this.setState({ legendState });
  }

  // When viz plugins don't handle `contextmenu` event, fallback handler
  // calls `handleOnContextMenu` with no `filters` param.
  onContextMenuFallback(event: MouseEvent<HTMLDivElement>): void {
    if (!this.state.inContextMenu) {
      event.preventDefault();
      this.handleOnContextMenu(event.clientX, event.clientY);
    }
  }

  handleLegendScroll(legendIndex: number): void {
    this.setState({ legendIndex });
  }

  render(): ReactNode {
    const { chartAlert, chartStatus, chartId, emitCrossFilters } = this.props;

    const hasAnyErrors = this.props.queriesResponse?.some(item => item?.error);
    const hasValidPreviousData =
      (this.props.queriesResponse?.length ?? 0) > 0 && !hasAnyErrors;

    if (!!chartAlert || chartStatus === null) {
      return null;
    }

    if (chartStatus === 'loading') {
      if (!this.props.suppressLoadingSpinner || !hasValidPreviousData) {
        return null;
      }
    }

    this.renderStartTime = Logger.getTimestamp();

    const {
      width,
      height,
      datasource,
      annotationData,
      initialValues,
      ownState,
      filterState,
      chartIsStale,
      formData,
      latestQueryFormData,
      postTransformProps,
    } = this.props;

    const currentFormData =
      chartIsStale && latestQueryFormData ? latestQueryFormData : formData;
    const vizType = currentFormData.viz_type || this.props.vizType;

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
      this.props.source === ChartSource.Explore
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
      ? { inContextMenu: this.state.inContextMenu }
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
        {this.state.showContextMenu && (
          <ChartContextMenu
            ref={this.contextMenuRef}
            id={chartId}
            formData={currentFormData as QueryFormData}
            onSelection={this.handleContextMenuSelected}
            onClose={this.handleContextMenuClosed}
          />
        )}
        <div
          onContextMenu={
            this.state.showContextMenu ? this.onContextMenuFallback : undefined
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hooks={this.hooks as any}
            behaviors={behaviors}
            queriesData={this.mutableQueriesResponse ?? undefined}
            onRenderSuccess={this.handleRenderSuccess}
            onRenderFailure={this.handleRenderFailure}
            noResults={noResultsComponent}
            postTransformProps={postTransformProps}
            emitCrossFilters={emitCrossFilters}
            legendState={this.state.legendState}
            enableNoResults={bypassNoResult}
            legendIndex={this.state.legendIndex}
            isRefreshing={
              Boolean(this.props.suppressLoadingSpinner) &&
              chartStatus === 'loading'
            }
            {...drillToDetailProps}
          />
        </div>
      </>
    );
  }
}

export default ChartRenderer;
