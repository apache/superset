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
  loadStatsPropShape,
} from '../util/propShapes';
import { areObjectsEqual } from '../../reduxUtils';
import getFormDataWithExtraFilters from '../util/charts/getFormDataWithExtraFilters';
import {
  Logger,
  ActionLog,
  DASHBOARD_EVENT_NAMES,
  LOG_ACTIONS_MOUNT_DASHBOARD,
  LOG_ACTIONS_LOAD_DASHBOARD_PANE,
  LOG_ACTIONS_FIRST_DASHBOARD_LOAD,
} from '../../logger';

import { t } from '../../locales';

import '../stylesheets/index.less';

const propTypes = {
  actions: PropTypes.shape({
    addSliceToDashboard: PropTypes.func.isRequired,
    removeSliceFromDashboard: PropTypes.func.isRequired,
    runQuery: PropTypes.func.isRequired,
  }).isRequired,
  dashboardInfo: dashboardInfoPropShape.isRequired,
  dashboardState: dashboardStatePropShape.isRequired,
  charts: PropTypes.objectOf(chartPropShape).isRequired,
  slices: PropTypes.objectOf(slicePropShape).isRequired,
  datasources: PropTypes.object.isRequired,
  loadStats: loadStatsPropShape.isRequired,
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
    this.actionLog = new ActionLog({
      impressionId: props.impressionId,
      source: 'dashboard',
      sourceId: props.dashboardInfo.id,
      eventNames: DASHBOARD_EVENT_NAMES,
    });
    Logger.start(this.actionLog);
  }

  componentDidMount() {
    this.ts_mount = new Date().getTime();
    Logger.append(LOG_ACTIONS_MOUNT_DASHBOARD);
  }

  componentWillReceiveProps(nextProps) {
    if (!nextProps.dashboardState.editMode) {
      // log pane load times if a pane loaded
      const loadedPaneIds = [];
      const allLoaded = Object.entries(nextProps.loadStats).every(
        ([paneId, stats]) => {
          const { didLoad, minQueryStartTime, ...restStats } = stats;

          if (didLoad && !this.props.loadStats[paneId].didLoad) {
            const duration = new Date().getTime() - minQueryStartTime;
            Logger.append(LOG_ACTIONS_LOAD_DASHBOARD_PANE, {
              ...restStats,
              duration,
            });
            if (!this.firstLoad) Logger.send(this.actionLog);
          }
          if (didLoad) loadedPaneIds.push(paneId);
          return didLoad || stats.index !== 0;
        },
      );

      if (allLoaded && this.firstLoad) {
        Logger.append(LOG_ACTIONS_FIRST_DASHBOARD_LOAD, {
          pane_ids: loadedPaneIds,
          duration: new Date().getTime() - this.ts_mount,
        });
        Logger.send(this.actionLog);
        this.firstLoad = false;
      }
    }

    const currentChartIds = getChartIdsFromLayout(this.props.layout);
    const nextChartIds = getChartIdsFromLayout(nextProps.layout);

    if (currentChartIds.length < nextChartIds.length) {
      // adding new chart
      const newChartId = nextChartIds.find(
        key => currentChartIds.indexOf(key) === -1,
      );
      this.props.actions.addSliceToDashboard(newChartId);
    } else if (currentChartIds.length > nextChartIds.length) {
      // remove chart
      const removedChartId = currentChartIds.find(
        key => nextChartIds.indexOf(key) === -1,
      );
      this.props.actions.removeSliceFromDashboard(removedChartId);
    }
  }

  componentDidUpdate(prevProps) {
    const { refresh, filters, hasUnsavedChanges } = this.props.dashboardState;
    if (refresh) {
      // refresh charts if a filter was removed, added, or changed
      let changedFilterKey = null;
      const currFilterKeys = Object.keys(filters);
      const prevFilterKeys = Object.keys(prevProps.dashboardState.filters);

      currFilterKeys.forEach(key => {
        const prevFilter = prevProps.dashboardState.filters[key];
        if (
          // filter was added or changed
          typeof prevFilter === 'undefined' ||
          !areObjectsEqual(prevFilter, filters[key])
        ) {
          changedFilterKey = key;
        }
      });

      if (
        !!changedFilterKey ||
        currFilterKeys.length !== prevFilterKeys.length
      ) {
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

    this.getAllCharts().forEach(chart => {
      // filterKey is a string, immune array contains numbers
      if (String(chart.id) !== filterKey && immune.indexOf(chart.id) === -1) {
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
      }
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
