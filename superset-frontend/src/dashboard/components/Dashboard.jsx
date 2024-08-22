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
import { Component } from 'react';
import PropTypes from 'prop-types';
import { isFeatureEnabled, t, FeatureFlag } from '@superset-ui/core';

import { PluginContext } from 'src/components/DynamicPlugins';
import getBootstrapData from 'src/utils/getBootstrapData';
import getChartIdsFromLayout from '../util/getChartIdsFromLayout';
import getLayoutComponentFromChartId from '../util/getLayoutComponentFromChartId';

import {
  slicePropShape,
  dashboardInfoPropShape,
  dashboardStatePropShape,
} from '../util/propShapes';
import {
  LOG_ACTIONS_HIDE_BROWSER_TAB,
  LOG_ACTIONS_MOUNT_DASHBOARD,
  Logger,
} from '../../logger/LogUtils';
import { areObjectsEqual } from '../../reduxUtils';

import getLocationHash from '../util/getLocationHash';
import isDashboardEmpty from '../util/isDashboardEmpty';
import { getAffectedOwnDataCharts } from '../util/charts/getOwnDataCharts';

const propTypes = {
  actions: PropTypes.shape({
    addSliceToDashboard: PropTypes.func.isRequired,
    removeSliceFromDashboard: PropTypes.func.isRequired,
    triggerQuery: PropTypes.func.isRequired,
    logEvent: PropTypes.func.isRequired,
    clearDataMaskState: PropTypes.func.isRequired,
  }).isRequired,
  dashboardInfo: dashboardInfoPropShape.isRequired,
  dashboardState: dashboardStatePropShape.isRequired,
  slices: PropTypes.objectOf(slicePropShape).isRequired,
  activeFilters: PropTypes.object.isRequired,
  chartConfiguration: PropTypes.object,
  datasources: PropTypes.object.isRequired,
  ownDataCharts: PropTypes.object.isRequired,
  layout: PropTypes.object.isRequired,
  impressionId: PropTypes.string.isRequired,
  timeout: PropTypes.number,
  userId: PropTypes.string,
};

const defaultProps = {
  timeout: 60,
  userId: '',
};

class Dashboard extends Component {
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
    this.applyCharts = this.applyCharts.bind(this);

    this.state = {
      prevActiveFilters: {},
      prevOwnDataCharts: {},
      hasTriggered: false,
    };
  }

  componentDidMount() {
    const bootstrapData = getBootstrapData();
    const { dashboardState, layout } = this.props;
    const eventData = {
      is_soft_navigation: Logger.timeOriginOffset > 0,
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
  }

  componentDidUpdate() {
    this.applyCharts();
  }

  shouldComponentUpdate(nextProps) {
    const { activeFilters, ownDataCharts, chartConfiguration, dashboardState } =
      this.props;
    const nextDataMaskHydrated = nextProps.dashboardState.dataMaskHydrated;
    const nextActiveFilters = nextProps.activeFilters;
    const nextOwnDataCharts = nextProps.ownDataCharts;
    const nextChartConfiguration = nextProps.chartConfiguration;
    const nextDashboardState = nextProps.dashboardState;

    if (
      nextDataMaskHydrated &&
      (!areObjectsEqual(dashboardState, nextDashboardState, {
        ignoreUndefined: true,
      }) ||
        !areObjectsEqual(activeFilters, nextActiveFilters, {
          ignoreUndefined: true,
        }) ||
        !areObjectsEqual(ownDataCharts, nextOwnDataCharts, {
          ignoreUndefined: true,
        }) ||
        !areObjectsEqual(chartConfiguration, nextChartConfiguration, {
          ignoreUndefined: true,
        }))
    ) {
      return true;
    }
    return false;
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const currentChartIds = getChartIdsFromLayout(this.props.layout);
    const nextChartIds = getChartIdsFromLayout(nextProps.layout);

    if (this.props.dashboardInfo.id !== nextProps.dashboardInfo.id) {
      // single-page-app navigation check
      return;
    }

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
    const { activeFilters, ownDataCharts, chartConfiguration, dashboardState } =
      this.props;

    const { dataMaskHydrated } = dashboardState;

    if (
      isFeatureEnabled(FeatureFlag.DashboardCrossFilters) &&
      !chartConfiguration
    ) {
      // For a first loading we need to wait for cross filters charts data loaded to get all active filters
      // for correct comparing  of filters to avoid unnecessary requests
      return;
    }

    if (dataMaskHydrated) {
      const hasFilters =
        Object.keys(activeFilters).length > 0 ||
        Object.keys(ownDataCharts).length > 0;
      const hadFilters =
        Object.keys(this.state.prevActiveFilters).length > 0 ||
        Object.keys(this.state.prevOwnDataCharts).length > 0;
      const { hasTriggered } = this.state;

      const filtersChanged =
        !areObjectsEqual(appliedOwnDataCharts, ownDataCharts, {
          ignoreUndefined: true,
        }) ||
        !areObjectsEqual(appliedFilters, activeFilters, {
          ignoreUndefined: true,
        });

      // triggers when filters are/were present and are changed/removed
      if (!editMode && filtersChanged && (hasFilters || hadFilters)) {
        this.setState({
          prevActiveFilters: activeFilters,
          prevOwnDataCharts: ownDataCharts,
          hasTriggered: true,
        });
        this.applyFilters();
      }
      // triggers for dashboards with no filters
      if (
        (editMode || (!hasFilters && !hadFilters)) &&
        dashboardState.sliceIds.length > 0 &&
        !hasTriggered
      ) {
        this.setState({ hasTriggered: true });
        this.refreshCharts(dashboardState.sliceIds);
      }
    }

    if (hasUnsavedChanges) {
      Dashboard.onBeforeUnload(true);
    } else {
      Dashboard.onBeforeUnload(false);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.props.actions.clearDataMaskState();
    this.props.actions.onLeaveDashboard();
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
    return this.props.children;
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
