/* global window */
import React from 'react';
import PropTypes from 'prop-types';

import AlertsWrapper from '../../components/AlertsWrapper';
import getChartIdsFromLayout from '../util/getChartIdsFromLayout';
import DashboardBuilder from '../containers/DashboardBuilder';
import {
  chartPropShape,
  slicePropShape,
  dashboardInfoPropShape,
  dashboardStatePropShape,
} from '../util/propShapes';
import { areObjectsEqual } from '../../reduxUtils';
import getFormDataWithExtraFilters from '../util/charts/getFormDataWithExtraFilters';
import {
  Logger,
  ActionLog,
  LOG_ACTIONS_PAGE_LOAD,
  LOG_ACTIONS_LOAD_EVENT,
  LOG_ACTIONS_RENDER_EVENT,
} from '../../logger';
import { t } from '../../locales';

import '../stylesheets/index.less';

const propTypes = {
  actions: PropTypes.shape({
    addSliceToDashboard: PropTypes.func.isRequired,
    onChange: PropTypes.func.isRequired,
    removeSliceFromDashboard: PropTypes.func.isRequired,
    runQuery: PropTypes.func.isRequired,
  }).isRequired,
  dashboardInfo: dashboardInfoPropShape.isRequired,
  dashboardState: dashboardStatePropShape.isRequired,
  charts: PropTypes.objectOf(chartPropShape).isRequired,
  slices: PropTypes.objectOf(slicePropShape).isRequired,
  datasources: PropTypes.object.isRequired,
  layout: PropTypes.object.isRequired,
  impressionId: PropTypes.string.isRequired,
  initMessages: PropTypes.array,
  timeout: PropTypes.number,
  userId: PropTypes.string,
};

const defaultProps = {
  initMessages: [],
  timeout: 60,
  userId: '',
};

class Dashboard extends React.PureComponent {
  static onBeforeUnload(hasChanged) {
    if (hasChanged) {
      window.addEventListener('beforeunload', Dashboard.unload);
    } else {
      window.removeEventListener('beforeunload', Dashboard.unload);
    }
  }

  static unload() {
    const message = t('You have unsaved changes.');
    window.event.returnValue = message; // Gecko + IE
    return message; // Gecko + Webkit, Safari, Chrome etc.
  }

  constructor(props) {
    super(props);

    this.firstLoad = true;
    this.loadingLog = new ActionLog({
      impressionId: props.impressionId,
      actionType: LOG_ACTIONS_PAGE_LOAD,
      source: 'dashboard',
      sourceId: props.dashboardInfo.id,
      eventNames: [LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT],
    });
    Logger.start(this.loadingLog);
  }

  componentWillReceiveProps(nextProps) {
    if (
      this.firstLoad &&
      Object.values(nextProps.charts).every(
        chart =>
          ['rendered', 'failed', 'stopped'].indexOf(chart.chartStatus) > -1,
      )
    ) {
      Logger.end(this.loadingLog);
      this.firstLoad = false;
    }

    const currentChartIds = getChartIdsFromLayout(this.props.layout);
    const nextChartIds = getChartIdsFromLayout(nextProps.layout);
    if (currentChartIds.length < nextChartIds.length) {
      // adding new chart
      const newChartId = nextChartIds.find(
        key => currentChartIds.indexOf(key) === -1,
      );
      this.props.actions.addSliceToDashboard(newChartId);
      this.props.actions.onChange();
    } else if (currentChartIds.length > nextChartIds.length) {
      // remove chart
      const removedChartId = currentChartIds.find(
        key => nextChartIds.indexOf(key) === -1,
      );
      this.props.actions.removeSliceFromDashboard(
        this.props.charts[removedChartId],
      );
      this.props.actions.onChange();
    }
  }

  componentDidUpdate(prevProps) {
    const { refresh, filters, hasUnsavedChanges } = this.props.dashboardState;
    if (refresh) {
      let changedFilterKey;
      const prevFiltersKeySet = new Set(
        Object.keys(prevProps.dashboardState.filters),
      );
      Object.keys(filters).some(key => {
        prevFiltersKeySet.delete(key);
        if (
          prevProps.dashboardState.filters[key] === undefined ||
          !areObjectsEqual(prevProps.dashboardState.filters[key], filters[key])
        ) {
          changedFilterKey = key;
          return true;
        }
        return false;
      });
      // has changed filter or removed a filter?
      if (!!changedFilterKey || prevFiltersKeySet.size) {
        this.refreshExcept(changedFilterKey);
      }
    }

    if (hasUnsavedChanges) {
      Dashboard.onBeforeUnload(true);
    } else {
      Dashboard.onBeforeUnload(false);
    }
  }

  // return charts in array
  getAllCharts() {
    return Object.values(this.props.charts);
  }

  refreshExcept(filterKey) {
    const immune = this.props.dashboardInfo.metadata.filter_immune_slices || [];
    let charts = this.getAllCharts();
    if (filterKey) {
      charts = charts.filter(
        chart =>
          String(chart.id) !== filterKey && immune.indexOf(chart.id) === -1,
      );
    }
    charts.forEach(chart => {
      const updatedFormData = getFormDataWithExtraFilters({
        chart,
        dashboardMetadata: this.props.dashboardInfo.metadata,
        filters: this.props.dashboardState.filters,
        sliceId: chart.id,
      });

      this.props.actions.runQuery(
        updatedFormData,
        false,
        this.props.timeout,
        chart.id,
      );
    });
  }

  render() {
    return (
      <div>
        <AlertsWrapper initMessages={this.props.initMessages} />
        <DashboardBuilder />
      </div>
    );
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
