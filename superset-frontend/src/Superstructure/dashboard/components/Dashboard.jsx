// DODO-changed
import React from 'react';
import PropTypes from 'prop-types';
import { isFeatureEnabled, t, FeatureFlag } from '@superset-ui/core';

import { PluginContext } from 'src/components/DynamicPlugins';
import Loading from 'src/components/Loading';
import { PLUGIN_SELECTOR } from 'src/Superstructure/constants';
import getChartIdsFromLayout from 'src/dashboard/util/getChartIdsFromLayout';
import getLayoutComponentFromChartId from 'src/dashboard/util/getLayoutComponentFromChartId';
import DashboardBuilder from './DashboardBuilder/DashboardBuilder';
import {
  chartPropShape,
  slicePropShape,
  dashboardInfoPropShape,
  dashboardStatePropShape,
} from 'src/dashboard/util/propShapes';
import {
  LOG_ACTIONS_HIDE_BROWSER_TAB,
  LOG_ACTIONS_MOUNT_DASHBOARD,
  Logger,
} from 'src/logger/LogUtils';
// import OmniContainer from '../../components/OmniContainer';
import { areObjectsEqual } from 'src/reduxUtils';

import 'src/dashboard/stylesheets/index.less';
import getLocationHash from 'src/dashboard/util/getLocationHash';
import isDashboardEmpty from 'src/dashboard/util/isDashboardEmpty';
import { getAffectedOwnDataCharts } from 'src/dashboard/util/charts/getOwnDataCharts';

const propTypes = {
  actions: PropTypes.shape({
    addSliceToDashboard: PropTypes.func.isRequired,
    removeSliceFromDashboard: PropTypes.func.isRequired,
    triggerQuery: PropTypes.func.isRequired,
    logEvent: PropTypes.func.isRequired,
  }).isRequired,
  dashboardInfo: dashboardInfoPropShape.isRequired,
  dashboardState: dashboardStatePropShape.isRequired,
  charts: PropTypes.objectOf(chartPropShape).isRequired,
  slices: PropTypes.objectOf(slicePropShape).isRequired,
  activeFilters: PropTypes.object.isRequired,
  chartConfiguration: PropTypes.object.isRequired,
  datasources: PropTypes.object.isRequired,
  ownDataCharts: PropTypes.object.isRequired,
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
  static contextType = PluginContext;

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
    this.appliedFilters = props.activeFilters ?? {};
    this.appliedOwnDataCharts = props.ownDataCharts ?? {};
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
  }

  componentDidMount() {
    const appContainer = document.getElementById(PLUGIN_SELECTOR);
    const bootstrapData = appContainer?.getAttribute('data-bootstrap') || '';

    const { dashboardState, layout } = this.props;
    const eventData = {
      is_edit_mode: dashboardState.editMode,
      mount_duration: Logger.getTimestamp(),
      is_empty: isDashboardEmpty(layout),
      is_published: dashboardState.isPublished,
      bootstrap_data_length: bootstrapData.length,
    };
    const directLinkComponentId = getLocationHash();
    if (directLinkComponentId) {
      eventData.target_id = directLinkComponentId;
    }
    this.props.actions.logEvent(LOG_ACTIONS_MOUNT_DASHBOARD, eventData);

    // Handle browser tab visibility change
    if (document.visibilityState === 'hidden') {
      this.visibilityEventData = {
        start_offset: Logger.getTimestamp(),
        ts: new Date().getTime(),
      };
    }
    window.addEventListener('visibilitychange', this.onVisibilityChange);
    this.applyCharts();
  }

  componentDidUpdate() {
    this.applyCharts();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const currentChartIds = getChartIdsFromLayout(this.props.layout);
    const nextChartIds = getChartIdsFromLayout(nextProps.layout);

    if (currentChartIds.length < nextChartIds.length) {
      const newChartIds = nextChartIds.filter(
        key => currentChartIds.indexOf(key) === -1,
      );
      newChartIds.forEach(newChartId =>
        this.props.actions.addSliceToDashboard(
          newChartId,
          getLayoutComponentFromChartId(nextProps.layout, newChartId),
        ),
      );
    } else if (currentChartIds.length > nextChartIds.length) {
      // remove chart
      const removedChartIds = currentChartIds.filter(
        key => nextChartIds.indexOf(key) === -1,
      );
      removedChartIds.forEach(removedChartId =>
        this.props.actions.removeSliceFromDashboard(removedChartId),
      );
    }
  }

  applyCharts() {
    const { hasUnsavedChanges, editMode } = this.props.dashboardState;

    const { appliedFilters, appliedOwnDataCharts } = this;
    const { activeFilters, ownDataCharts, chartConfiguration } = this.props;
    if (
      isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS) &&
      !chartConfiguration
    ) {
      // For a first loading we need to wait for cross filters charts data loaded to get all active filters
      // for correct comparing  of filters to avoid unnecessary requests
      return;
    }

    if (
      !editMode &&
      (!areObjectsEqual(appliedOwnDataCharts, ownDataCharts, {
        ignoreUndefined: true,
      }) ||
        !areObjectsEqual(appliedFilters, activeFilters, {
          ignoreUndefined: true,
        }))
    ) {
      this.applyFilters();
    }

    if (hasUnsavedChanges) {
      Dashboard.onBeforeUnload(true);
    } else {
      Dashboard.onBeforeUnload(false);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      // from visible to hidden
      this.visibilityEventData = {
        start_offset: Logger.getTimestamp(),
        ts: new Date().getTime(),
      };
    } else if (document.visibilityState === 'visible') {
      // from hidden to visible
      const logStart = this.visibilityEventData.start_offset;
      this.props.actions.logEvent(LOG_ACTIONS_HIDE_BROWSER_TAB, {
        ...this.visibilityEventData,
        duration: Logger.getTimestamp() - logStart,
      });
    }
  }

  // return charts in array
  getAllCharts() {
    return Object.values(this.props.charts);
  }

  applyFilters() {
    const { appliedFilters } = this;
    const { activeFilters, ownDataCharts } = this.props;

    // refresh charts if a filter was removed, added, or changed
    const currFilterKeys = Object.keys(activeFilters);
    const appliedFilterKeys = Object.keys(appliedFilters);

    const allKeys = new Set(currFilterKeys.concat(appliedFilterKeys));
    const affectedChartIds = getAffectedOwnDataCharts(
      ownDataCharts,
      this.appliedOwnDataCharts,
    );
    [...allKeys].forEach(filterKey => {
      if (
        !currFilterKeys.includes(filterKey) &&
        appliedFilterKeys.includes(filterKey)
      ) {
        // filterKey is removed?
        affectedChartIds.push(...appliedFilters[filterKey].scope);
      } else if (!appliedFilterKeys.includes(filterKey)) {
        // filterKey is newly added?
        affectedChartIds.push(...activeFilters[filterKey].scope);
      } else {
        // if filterKey changes value,
        // update charts in its scope
        if (
          !areObjectsEqual(
            appliedFilters[filterKey].values,
            activeFilters[filterKey].values,
            {
              ignoreUndefined: true,
            },
          )
        ) {
          affectedChartIds.push(...activeFilters[filterKey].scope);
        }

        // if filterKey changes scope,
        // update all charts in its scope
        if (
          !areObjectsEqual(
            appliedFilters[filterKey].scope,
            activeFilters[filterKey].scope,
          )
        ) {
          const chartsInScope = (activeFilters[filterKey].scope || []).concat(
            appliedFilters[filterKey].scope || [],
          );
          affectedChartIds.push(...chartsInScope);
        }
      }
    });

    // remove dup in affectedChartIds
    this.refreshCharts([...new Set(affectedChartIds)]);
    this.appliedFilters = activeFilters;
    this.appliedOwnDataCharts = ownDataCharts;
  }

  refreshCharts(ids) {
    ids.forEach(id => {
      this.props.actions.triggerQuery(true, id);
    });
  }

  render() {
    if (this.context.loading) {
      return <Loading />;
    }
    return (
      <>
        {/* <OmniContainer logEvent={this.props.actions.logEvent} /> */}
        <DashboardBuilder />
      </>
    );
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
