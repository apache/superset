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
import PropTypes from 'prop-types';
import { createRef, Component } from 'react';
import {
  SuperChart,
  logging,
  Behavior,
  t,
  getChartMetadataRegistry,
  VizType,
  isFeatureEnabled,
  FeatureFlag,
} from '@superset-ui/core';
import { Logger, LOG_ACTIONS_RENDER_CHART } from 'src/logger/LogUtils';
import { EmptyState } from '@superset-ui/core/components';
import { ChartSource } from 'src/types/ChartSource';
import ChartContextMenu from './ChartContextMenu/ChartContextMenu';

const propTypes = {
  annotationData: PropTypes.object,
  actions: PropTypes.object,
  chartId: PropTypes.number.isRequired,
  datasource: PropTypes.object,
  initialValues: PropTypes.object,
  formData: PropTypes.object.isRequired,
  latestQueryFormData: PropTypes.object,
  labelsColor: PropTypes.object,
  labelsColorMap: PropTypes.object,
  height: PropTypes.number,
  width: PropTypes.number,
  setControlValue: PropTypes.func,
  vizType: PropTypes.string.isRequired,
  triggerRender: PropTypes.bool,
  // state
  chartAlert: PropTypes.string,
  chartStatus: PropTypes.string,
  queriesResponse: PropTypes.arrayOf(PropTypes.object),
  triggerQuery: PropTypes.bool,
  chartIsStale: PropTypes.bool,
  // dashboard callbacks
  addFilter: PropTypes.func,
  setDataMask: PropTypes.func,
  onFilterMenuOpen: PropTypes.func,
  onFilterMenuClose: PropTypes.func,
  ownState: PropTypes.object,
  postTransformProps: PropTypes.func,
  source: PropTypes.oneOf([ChartSource.Dashboard, ChartSource.Explore]),
  emitCrossFilters: PropTypes.bool,
};

const BLANK = {};

const BIG_NO_RESULT_MIN_WIDTH = 300;
const BIG_NO_RESULT_MIN_HEIGHT = 220;

const behaviors = [Behavior.InteractiveChart];

const defaultProps = {
  addFilter: () => BLANK,
  onFilterMenuOpen: () => BLANK,
  onFilterMenuClose: () => BLANK,
  initialValues: BLANK,
  setControlValue() {},
  triggerRender: false,
};

class ChartRenderer extends Component {
  contextMenuRef: $TSFixMe;

  hasQueryResponseChange: $TSFixMe;

  hooks: $TSFixMe;

  mutableQueriesResponse: $TSFixMe;

  renderStartTime: $TSFixMe;

  constructor(props: $TSFixMe) {
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
    };
    this.hasQueryResponseChange = false;

    this.contextMenuRef = createRef();

    this.handleAddFilter = this.handleAddFilter.bind(this);
    this.handleRenderSuccess = this.handleRenderSuccess.bind(this);
    this.handleRenderFailure = this.handleRenderFailure.bind(this);
    this.handleSetControlValue = this.handleSetControlValue.bind(this);
    this.handleOnContextMenu = this.handleOnContextMenu.bind(this);
    this.handleContextMenuSelected = this.handleContextMenuSelected.bind(this);
    this.handleContextMenuClosed = this.handleContextMenuClosed.bind(this);
    this.handleLegendStateChanged = this.handleLegendStateChanged.bind(this);
    this.onContextMenuFallback = this.onContextMenuFallback.bind(this);

    this.hooks = {
      onAddFilter: this.handleAddFilter,
      // @ts-expect-error TS(2339): Property 'showContextMenu' does not exist on type ... Remove this comment to see the full error message
      onContextMenu: this.state.showContextMenu
        ? this.handleOnContextMenu
        : undefined,
      onError: this.handleRenderFailure,
      setControlValue: this.handleSetControlValue,
      // @ts-expect-error TS(2339): Property 'onFilterMenuOpen' does not exist on type... Remove this comment to see the full error message
      onFilterMenuOpen: this.props.onFilterMenuOpen,
      // @ts-expect-error TS(2339): Property 'onFilterMenuClose' does not exist on typ... Remove this comment to see the full error message
      onFilterMenuClose: this.props.onFilterMenuClose,
      onLegendStateChanged: this.handleLegendStateChanged,
      setDataMask: (dataMask: $TSFixMe) => {
        // @ts-expect-error TS(2339): Property 'actions' does not exist on type 'Readonl... Remove this comment to see the full error message
        this.props.actions?.updateDataMask(this.props.chartId, dataMask);
      },
    };

    // TODO: queriesResponse comes from Redux store but it's being edited by
    // the plugins, hence we need to clone it to avoid state mutation
    // until we change the reducers to use Redux Toolkit with Immer
    // @ts-expect-error TS(2339): Property 'queriesResponse' does not exist on type ... Remove this comment to see the full error message
    this.mutableQueriesResponse = cloneDeep(this.props.queriesResponse);
  }

  shouldComponentUpdate(nextProps: $TSFixMe, nextState: $TSFixMe) {
    const resultsReady =
      nextProps.queriesResponse &&
      ['success', 'rendered'].indexOf(nextProps.chartStatus) > -1 &&
      !nextProps.queriesResponse?.[0]?.error;

    if (resultsReady) {
      if (!isEqual(this.state, nextState)) {
        return true;
      }
      this.hasQueryResponseChange =
        // @ts-expect-error TS(2339): Property 'queriesResponse' does not exist on type ... Remove this comment to see the full error message
        nextProps.queriesResponse !== this.props.queriesResponse;

      if (this.hasQueryResponseChange) {
        this.mutableQueriesResponse = cloneDeep(nextProps.queriesResponse);
      }

      return (
        this.hasQueryResponseChange ||
        // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
        !isEqual(nextProps.datasource, this.props.datasource) ||
        // @ts-expect-error TS(2339): Property 'annotationData' does not exist on type '... Remove this comment to see the full error message
        nextProps.annotationData !== this.props.annotationData ||
        // @ts-expect-error TS(2339): Property 'ownState' does not exist on type 'Readon... Remove this comment to see the full error message
        nextProps.ownState !== this.props.ownState ||
        // @ts-expect-error TS(2339): Property 'filterState' does not exist on type 'Rea... Remove this comment to see the full error message
        nextProps.filterState !== this.props.filterState ||
        // @ts-expect-error TS(2339): Property 'height' does not exist on type 'Readonly... Remove this comment to see the full error message
        nextProps.height !== this.props.height ||
        // @ts-expect-error TS(2339): Property 'width' does not exist on type 'Readonly<... Remove this comment to see the full error message
        nextProps.width !== this.props.width ||
        nextProps.triggerRender ||
        // @ts-expect-error TS(2339): Property 'labelsColor' does not exist on type 'Rea... Remove this comment to see the full error message
        nextProps.labelsColor !== this.props.labelsColor ||
        // @ts-expect-error TS(2339): Property 'labelsColorMap' does not exist on type '... Remove this comment to see the full error message
        nextProps.labelsColorMap !== this.props.labelsColorMap ||
        // @ts-expect-error TS(2339): Property 'formData' does not exist on type 'Readon... Remove this comment to see the full error message
        nextProps.formData.color_scheme !== this.props.formData.color_scheme ||
        // @ts-expect-error TS(2339): Property 'formData' does not exist on type 'Readon... Remove this comment to see the full error message
        nextProps.formData.stack !== this.props.formData.stack ||
        // @ts-expect-error TS(2339): Property 'cacheBusterProp' does not exist on type ... Remove this comment to see the full error message
        nextProps.cacheBusterProp !== this.props.cacheBusterProp ||
        // @ts-expect-error TS(2339): Property 'emitCrossFilters' does not exist on type... Remove this comment to see the full error message
        nextProps.emitCrossFilters !== this.props.emitCrossFilters
      );
    }
    return false;
  }

  handleAddFilter(col: $TSFixMe, vals: $TSFixMe, merge = true, refresh = true) {
    // @ts-expect-error TS(2339): Property 'addFilter' does not exist on type 'Reado... Remove this comment to see the full error message
    this.props.addFilter(col, vals, merge, refresh);
  }

  handleRenderSuccess() {
    // @ts-expect-error TS(2339): Property 'actions' does not exist on type 'Readonl... Remove this comment to see the full error message
    const { actions, chartStatus, chartId, vizType } = this.props;
    if (['loading', 'rendered'].indexOf(chartStatus) < 0) {
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

  handleRenderFailure(error: $TSFixMe, info: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'actions' does not exist on type 'Readonl... Remove this comment to see the full error message
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

  handleSetControlValue(...args: $TSFixMe[]) {
    // @ts-expect-error TS(2339): Property 'setControlValue' does not exist on type ... Remove this comment to see the full error message
    const { setControlValue } = this.props;
    if (setControlValue) {
      setControlValue(...args);
    }
  }

  handleOnContextMenu(offsetX: $TSFixMe, offsetY: $TSFixMe, filters: $TSFixMe) {
    this.contextMenuRef.current.open(offsetX, offsetY, filters);
    this.setState({ inContextMenu: true });
  }

  handleContextMenuSelected() {
    this.setState({ inContextMenu: false });
  }

  handleContextMenuClosed() {
    this.setState({ inContextMenu: false });
  }

  handleLegendStateChanged(legendState: $TSFixMe) {
    this.setState({ legendState });
  }

  // When viz plugins don't handle `contextmenu` event, fallback handler
  // calls `handleOnContextMenu` with no `filters` param.
  onContextMenuFallback(event: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'inContextMenu' does not exist on type 'R... Remove this comment to see the full error message
    if (!this.state.inContextMenu) {
      event.preventDefault();
      // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
      this.handleOnContextMenu(event.clientX, event.clientY);
    }
  }

  render() {
    // @ts-expect-error TS(2339): Property 'chartAlert' does not exist on type 'Read... Remove this comment to see the full error message
    const { chartAlert, chartStatus, chartId, emitCrossFilters } = this.props;

    // Skip chart rendering
    if (chartStatus === 'loading' || !!chartAlert || chartStatus === null) {
      return null;
    }

    this.renderStartTime = Logger.getTimestamp();

    const {
      // @ts-expect-error TS(2339): Property 'width' does not exist on type 'Readonly<... Remove this comment to see the full error message
      width,
      // @ts-expect-error TS(2339): Property 'height' does not exist on type 'Readonly... Remove this comment to see the full error message
      height,
      // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
      datasource,
      // @ts-expect-error TS(2339): Property 'annotationData' does not exist on type '... Remove this comment to see the full error message
      annotationData,
      // @ts-expect-error TS(2339): Property 'initialValues' does not exist on type 'R... Remove this comment to see the full error message
      initialValues,
      // @ts-expect-error TS(2339): Property 'ownState' does not exist on type 'Readon... Remove this comment to see the full error message
      ownState,
      // @ts-expect-error TS(2339): Property 'filterState' does not exist on type 'Rea... Remove this comment to see the full error message
      filterState,
      // @ts-expect-error TS(2339): Property 'chartIsStale' does not exist on type 'Re... Remove this comment to see the full error message
      chartIsStale,
      // @ts-expect-error TS(2339): Property 'formData' does not exist on type 'Readon... Remove this comment to see the full error message
      formData,
      // @ts-expect-error TS(2339): Property 'latestQueryFormData' does not exist on t... Remove this comment to see the full error message
      latestQueryFormData,
      // @ts-expect-error TS(2339): Property 'postTransformProps' does not exist on ty... Remove this comment to see the full error message
      postTransformProps,
    } = this.props;

    const currentFormData =
      chartIsStale && latestQueryFormData ? latestQueryFormData : formData;
    // @ts-expect-error TS(2339): Property 'vizType' does not exist on type 'Readonl... Remove this comment to see the full error message
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
            // @ts-expect-error TS(2304): Cannot find name '__webpack_require__'.
            // eslint-disable-next-line camelcase
            typeof __webpack_require__ !== 'undefined' &&
            // @ts-expect-error TS(2304): Cannot find name '__webpack_require__'.
            // eslint-disable-next-line camelcase, no-undef
            typeof __webpack_require__.h === 'function' &&
            // @ts-expect-error TS(2304): Cannot find name '__webpack_require__'.
            // eslint-disable-next-line no-undef, camelcase
            __webpack_require__.h()
          }`
        : '';

    let noResultsComponent;
    const noResultTitle = t('No results were returned for this query');
    const noResultDescription =
      // @ts-expect-error TS(2339): Property 'source' does not exist on type 'Readonly... Remove this comment to see the full error message
      this.props.source === ChartSource.Explore
        ? t(
            'Make sure that the controls are configured properly and the datasource contains data for the selected time range',
          )
        : undefined;
    const noResultImage = 'chart.svg';
    if (width > BIG_NO_RESULT_MIN_WIDTH && height > BIG_NO_RESULT_MIN_HEIGHT) {
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
      .get(formData.viz_type)
      ?.behaviors.find(behavior => behavior === Behavior.DrillToDetail)
      ? // @ts-expect-error TS(2339): Property 'inContextMenu' does not exist on type 'R... Remove this comment to see the full error message
        { inContextMenu: this.state.inContextMenu }
      : {};
    // By pass no result component when server pagination is enabled & the table has a backend search query
    const bypassNoResult = !(
      formData?.server_pagination && (ownState?.searchText?.length || 0) > 0
    );

    return (
      <>
        // @ts-expect-error TS(2339): Property 'showContextMenu' does not exist
        on type ... Remove this comment to see the full error message
        {this.state.showContextMenu && (
          <ChartContextMenu
            ref={this.contextMenuRef}
            id={chartId}
            formData={currentFormData}
            onSelection={this.handleContextMenuSelected}
            onClose={this.handleContextMenuClosed}
          />
        )}
        <div
          onContextMenu={
            // @ts-expect-error TS(2339): Property 'showContextMenu' does not exist on type ... Remove this comment to see the full error message
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
            hooks={this.hooks}
            behaviors={behaviors}
            queriesData={this.mutableQueriesResponse}
            onRenderSuccess={this.handleRenderSuccess}
            onRenderFailure={this.handleRenderFailure}
            noResults={noResultsComponent}
            postTransformProps={postTransformProps}
            // @ts-expect-error TS(2322): Type '{ inContextMenu: any; disableErrorBoundary: ... Remove this comment to see the full error message
            emitCrossFilters={emitCrossFilters}
            // @ts-expect-error TS(2339): Property 'legendState' does not exist on type 'Rea... Remove this comment to see the full error message
            legendState={this.state.legendState}
            enableNoResults={bypassNoResult}
            {...drillToDetailProps}
          />
        </div>
      </>
    );
  }
}

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
ChartRenderer.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
ChartRenderer.defaultProps = defaultProps;

export default ChartRenderer;
