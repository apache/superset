import React from 'react';
import PropTypes from 'prop-types';

import AlertsWrapper from '../../components/AlertsWrapper';
import DashboardBuilder from '../v2/containers/DashboardBuilder';
import { slicePropShape } from '../reducers/propShapes';
import { areObjectsEqual } from '../../reduxUtils';
import getFormDataWithExtraFilters from '../v2/util/charts/getFormDataWithExtraFilters';
import {
  Logger,
  ActionLog,
  LOG_ACTIONS_PAGE_LOAD,
  LOG_ACTIONS_LOAD_EVENT,
  LOG_ACTIONS_RENDER_EVENT,
} from '../../logger';
import { t } from '../../locales';

import '../../../stylesheets/dashboard.less';
import '../v2/stylesheets/index.less';

const propTypes = {
  actions: PropTypes.object,
  initMessages: PropTypes.array,
  dashboard: PropTypes.object.isRequired,
  charts: PropTypes.object.isRequired,
  slices: PropTypes.objectOf(slicePropShape).isRequired,
  datasources: PropTypes.object.isRequired,
  layout: PropTypes.object.isRequired,
  filters: PropTypes.object,
  refresh: PropTypes.bool,
  timeout: PropTypes.number,
  userId: PropTypes.string,
  isStarred: PropTypes.bool,
  showBuilderPane: PropTypes.bool,
  hasUnsavedChanges: PropTypes.bool.isRequired,
  editMode: PropTypes.bool,
  impressionId: PropTypes.string,
};

const defaultProps = {
  initMessages: [],
  filters: {},
  refresh: false,
  timeout: 60,
  userId: '',
  isStarred: false,
  showBuilderPane: false,
  editMode: false,
};

class Dashboard extends React.PureComponent {
  constructor(props) {
    super(props);

    this.firstLoad = true;
    this.loadingLog = new ActionLog({
      impressionId: props.impressionId,
      actionType: LOG_ACTIONS_PAGE_LOAD,
      source: 'dashboard',
      sourceId: props.dashboard.id,
      eventNames: [LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT],
    });
    Logger.start(this.loadingLog);
  }

  componentWillReceiveProps(nextProps) {
    if (this.firstLoad &&
      Object.values(nextProps.charts)
        .every(chart => (['rendered', 'failed', 'stopped'].indexOf(chart.chartStatus) > -1))
    ) {
      Logger.end(this.loadingLog);
      this.firstLoad = false;
    }

    const currentCharts = this.getChartKeysFromLayout(this.props.layout);
    const nextCharts = this.getChartKeysFromLayout(nextProps.layout);
    if (currentCharts.length < nextCharts.length) {
      // adding new chart
      const newChartKey = nextCharts.find((key) => (currentCharts.indexOf(key) === -1));
      this.props.actions.addSliceToDashboard(newChartKey);
      this.props.actions.onChange();
    } else if (currentCharts.length > nextCharts.length) {
      // remove chart
      const removedChartKey = currentCharts.find((key) => (nextCharts.indexOf(key) === -1));
      this.props.actions.removeSliceFromDashboard(this.props.charts[removedChartKey]);
      this.props.actions.onChange();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.refresh) {
      let changedFilterKey;
      const prevFiltersKeySet = new Set(Object.keys(prevProps.filters));
      Object.keys(this.props.filters).some((key) => {
        prevFiltersKeySet.delete(key);
        if (prevProps.filters[key] === undefined ||
          !areObjectsEqual(prevProps.filters[key], this.props.filters[key])) {
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

    if (this.props.hasUnsavedChanges) {
      this.onBeforeUnload(true);
    } else {
      this.onBeforeUnload(false);
    }
  }

  componentWillUnmount() {
    // window.removeEventListener('resize', this.rerenderCharts);
  }

  onBeforeUnload(hasChanged) {
    if (hasChanged) {
      window.addEventListener('beforeunload', this.unload);
    } else {
      window.removeEventListener('beforeunload', this.unload);
    }
  }

  // return charts in array
  getAllCharts() {
    return Object.values(this.props.charts);
  }

  getChartKeysFromLayout(layout) {
    return Object.values(layout)
      .reduce((chartKeys, value) => {
        if (value && value.meta && value.meta.chartKey) {
          chartKeys.push(value.meta.chartKey);
        }
        return chartKeys;
      }, []);
  }

  unload() {
    const message = t('You have unsaved changes.');
    window.event.returnValue = message; // Gecko + IE
    return message; // Gecko + Webkit, Safari, Chrome etc.
  }

  refreshExcept(filterKey) {
    const immune = this.props.dashboard.metadata.filter_immune_slices || [];
    let charts = this.getAllCharts();
    if (filterKey) {
      charts = charts.filter(chart => (
        String(chart.slice_id) !== filterKey &&
        immune.indexOf(chart.slice_id) === -1
      ));
    }
    charts.forEach((chart) => {
      const updatedFormData = getFormDataWithExtraFilters({
        chart,
        dashboardMetadata: this.props.dashboard.metadata,
        filters: this.props.filters,
        sliceId: chart.chartKey,
      });

      this.props.actions.runQuery(updatedFormData, false, this.props.timeout, chart.chartKey);
    });
  }

  render() {
    return (
      <div id="dashboard-container">
        <div id="dashboard-header">
          <AlertsWrapper initMessages={this.props.initMessages} />
        </div>

        <DashboardBuilder />
      </div>
    );
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
