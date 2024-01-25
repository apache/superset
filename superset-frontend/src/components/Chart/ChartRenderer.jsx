/* eslint-disable no-lonely-if */
/* eslint-disable camelcase */
/* eslint-disable no-restricted-syntax */
// DODO was here
import { snakeCase, isEqual, cloneDeep } from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import {
  SuperChart,
  logging,
  Behavior,
  t,
  isFeatureEnabled,
  FeatureFlag,
  getChartMetadataRegistry,
} from '@superset-ui/core';
import { Logger, LOG_ACTIONS_RENDER_CHART } from 'src/logger/LogUtils';
// DODO swapped component
import {
  EmptyStateBig,
  EmptyStateBig as EmptyStateBigPlugin,
  EmptyStateSmall,
  EmptyStateSmall as EmptyStateSmallPlugin,
} from 'src/Superstructure/components/EmptyState';
import { ChartSource } from 'src/types/ChartSource';
// DODO added
import { LimitWarning } from 'src/Superstructure/components/LimitWarning';
import ChartContextMenu from './ChartContextMenu/ChartContextMenu';

const propTypes = {
  annotationData: PropTypes.object,
  actions: PropTypes.object,
  chartId: PropTypes.number.isRequired,
  datasource: PropTypes.object,
  initialValues: PropTypes.object,
  formData: PropTypes.object.isRequired,
  latestQueryFormData: PropTypes.object,
  labelColors: PropTypes.object,
  sharedLabelColors: PropTypes.object,
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

const behaviors = [Behavior.INTERACTIVE_CHART];

const defaultProps = {
  addFilter: () => BLANK,
  onFilterMenuOpen: () => BLANK,
  onFilterMenuClose: () => BLANK,
  initialValues: BLANK,
  setControlValue() {},
  triggerRender: false,
};

class ChartRenderer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showContextMenu:
        props.source === ChartSource.Dashboard &&
        (isFeatureEnabled(FeatureFlag.DRILL_TO_DETAIL) ||
          isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)),
      inContextMenu: false,
      legendState: undefined,
    };
    this.hasQueryResponseChange = false;

    this.contextMenuRef = React.createRef();

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
      onContextMenu: this.state.showContextMenu
        ? this.handleOnContextMenu
        : undefined,
      onError: this.handleRenderFailure,
      setControlValue: this.handleSetControlValue,
      onFilterMenuOpen: this.props.onFilterMenuOpen,
      onFilterMenuClose: this.props.onFilterMenuClose,
      onLegendStateChanged: this.handleLegendStateChanged,
      setDataMask: dataMask => {
        this.props.actions?.updateDataMask(this.props.chartId, dataMask);
      },
    };

    // TODO: queriesResponse comes from Redux store but it's being edited by
    // the plugins, hence we need to clone it to avoid state mutation
    // until we change the reducers to use Redux Toolkit with Immer
    this.mutableQueriesResponse = cloneDeep(this.props.queriesResponse);
  }

  shouldComponentUpdate(nextProps, nextState) {
    const resultsReady =
      nextProps.queriesResponse &&
      ['success', 'rendered'].indexOf(nextProps.chartStatus) > -1 &&
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

      return (
        this.hasQueryResponseChange ||
        !isEqual(nextProps.datasource, this.props.datasource) ||
        nextProps.annotationData !== this.props.annotationData ||
        nextProps.ownState !== this.props.ownState ||
        nextProps.filterState !== this.props.filterState ||
        nextProps.height !== this.props.height ||
        nextProps.width !== this.props.width ||
        nextProps.triggerRender ||
        nextProps.labelColors !== this.props.labelColors ||
        nextProps.sharedLabelColors !== this.props.sharedLabelColors ||
        nextProps.formData.color_scheme !== this.props.formData.color_scheme ||
        nextProps.formData.stack !== this.props.formData.stack ||
        nextProps.cacheBusterProp !== this.props.cacheBusterProp ||
        nextProps.emitCrossFilters !== this.props.emitCrossFilters
      );
    }
    return false;
  }

  handleAddFilter(col, vals, merge = true, refresh = true) {
    this.props.addFilter(col, vals, merge, refresh);
  }

  handleRenderSuccess() {
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

  handleRenderFailure(error, info) {
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

  handleSetControlValue(...args) {
    const { setControlValue } = this.props;
    if (setControlValue) {
      setControlValue(...args);
    }
  }

  handleOnContextMenu(offsetX, offsetY, filters) {
    this.contextMenuRef.current.open(offsetX, offsetY, filters);
    this.setState({ inContextMenu: true });
  }

  handleContextMenuSelected() {
    this.setState({ inContextMenu: false });
  }

  handleContextMenuClosed() {
    this.setState({ inContextMenu: false });
  }

  handleLegendStateChanged(legendState) {
    this.setState({ legendState });
  }

  // When viz plugins don't handle `contextmenu` event, fallback handler
  // calls `handleOnContextMenu` with no `filters` param.
  onContextMenuFallback(event) {
    if (!this.state.inContextMenu) {
      event.preventDefault();
      this.handleOnContextMenu(event.clientX, event.clientY);
    }
  }

  render() {
    const {
      chartAlert,
      chartStatus,
      chartId,
      emitCrossFilters,
      // DODO added
      formData: { row_limit },
    } = this.props;

    // Skip chart rendering
    if (chartStatus === 'loading' || !!chartAlert || chartStatus === null) {
      return null;
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
      // DODO added
      chartName,
      queriesResponse,
    } = this.props;

    const currentFormData =
      chartIsStale && latestQueryFormData ? latestQueryFormData : formData;
    const vizType = currentFormData.viz_type || this.props.vizType;

    console.groupCollapsed('ALL ALTERED', chartName);
    console.log('datasource', datasource);
    // console.log('alteredDatasource', alteredDatasource);
    console.log('+_+_+_+');
    console.log('currentFormData', currentFormData);
    // console.log('alteredFormData', alteredFormData);
    console.log('+_+_+_+');
    console.log('Queries Response', queriesResponse);
    console.log('datasource.verbose_map', datasource.verbose_map);
    // console.log('alteredVerboseMap', alteredVerboseMap);
    console.log('+_+_+_+');
    console.groupEnd();
    console.log('');

    // DODO added
    const rowCount = Number(queriesResponse[0].rowcount) || 0;
    const rowLimit = Number(row_limit) || 0;

    // It's bad practice to use unprefixed `vizType` as classnames for chart
    // container. It may cause css conflicts as in the case of legacy table chart.
    // When migrating charts, we should gradually add a `superset-chart-` prefix
    // to each one of them.
    const snakeCaseVizType = snakeCase(vizType);
    const chartClassName =
      vizType === 'table'
        ? `superset-chart-${snakeCaseVizType}`
        : snakeCaseVizType;

    const webpackHash =
      process.env.WEBPACK_MODE === 'development'
        ? `-${
            // eslint-disable-next-line camelcase
            typeof __webpack_require__ !== 'undefined' &&
            // eslint-disable-next-line camelcase, no-undef
            typeof __webpack_require__.h === 'function' &&
            // eslint-disable-next-line no-undef
            __webpack_require__.h()
          }`
        : '';

    let noResultsComponent;
    const noResultTitle = t('No results were returned for this query');
    const noResultDescription =
      this.props.source === ChartSource.Explore
        ? t(
            'Make sure that the controls are configured properly and the datasource contains data for the selected time range',
          )
        : undefined;
    const noResultImage = 'chart.svg';

    console.log('ChartRenderer [ process.env.type => ', process.env.type, ']');

    if (width > BIG_NO_RESULT_MIN_WIDTH && height > BIG_NO_RESULT_MIN_HEIGHT) {
      // DODO added
      if (process.env.type === undefined) {
        noResultsComponent = (
          <EmptyStateBig
            title={noResultTitle}
            description={noResultDescription}
            image={noResultImage}
          />
        );
      } else {
        noResultsComponent = (
          <EmptyStateBigPlugin
            title={noResultTitle}
            description={noResultDescription}
            image={noResultImage}
          />
        );
      }
    } else {
      // DODO added
      if (process.env.type === undefined) {
        noResultsComponent = (
          <EmptyStateSmall title={noResultTitle} image={noResultImage} />
        );
      } else {
        noResultsComponent = (
          <EmptyStateSmallPlugin title={noResultTitle} image={noResultImage} />
        );
      }
    }

    // DODO added
    if (rowCount > 0 && rowLimit > 0 && rowCount >= rowLimit) {
      return <LimitWarning limit={rowLimit} />;
    }

    // Check for Behavior.DRILL_TO_DETAIL to tell if chart can receive Drill to
    // Detail props or if it'll cause side-effects (e.g. excessive re-renders).
    const drillToDetailProps = getChartMetadataRegistry()
      .get(formData.viz_type)
      ?.behaviors.find(behavior => behavior === Behavior.DRILL_TO_DETAIL)
      ? { inContextMenu: this.state.inContextMenu }
      : {};

    return (
      <>
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
            emitCrossFilters={emitCrossFilters}
            legendState={this.state.legendState}
            {...drillToDetailProps}
          />
        </div>
      </>
    );
  }
}

ChartRenderer.propTypes = propTypes;
ChartRenderer.defaultProps = defaultProps;

export default ChartRenderer;
