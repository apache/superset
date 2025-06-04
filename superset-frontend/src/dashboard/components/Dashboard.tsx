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
import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { t } from '@superset-ui/core';

import { Loading } from '@superset-ui/core/components';
import { PluginContext } from 'src/components';
import getBootstrapData from 'src/utils/getBootstrapData';
import getChartIdsFromLayout from '../util/getChartIdsFromLayout';
import getLayoutComponentFromChartId from '../util/getLayoutComponentFromChartId';

import { slicePropShape } from '../util/propShapes';
import {
  LOG_ACTIONS_HIDE_BROWSER_TAB,
  LOG_ACTIONS_MOUNT_DASHBOARD,
  Logger,
} from '../../logger/LogUtils';
import { areObjectsEqual } from '../../reduxUtils';

import getLocationHash from '../util/getLocationHash';
import isDashboardEmpty from '../util/isDashboardEmpty';
import { getAffectedOwnDataCharts } from '../util/charts/getOwnDataCharts';
import { getRelatedCharts } from '../util/getRelatedCharts';

const propTypes = {
  actions: PropTypes.shape({
    addSliceToDashboard: PropTypes.func.isRequired,
    removeSliceFromDashboard: PropTypes.func.isRequired,
    triggerQuery: PropTypes.func.isRequired,
    logEvent: PropTypes.func.isRequired,
    clearDataMaskState: PropTypes.func.isRequired,
  }).isRequired,
  dashboardId: PropTypes.number.isRequired,
  editMode: PropTypes.bool,
  isPublished: PropTypes.bool,
  hasUnsavedChanges: PropTypes.bool,
  slices: PropTypes.objectOf(slicePropShape).isRequired,
  activeFilters: PropTypes.object.isRequired,
  chartConfiguration: PropTypes.object,
  datasources: PropTypes.object.isRequired,
  ownDataCharts: PropTypes.object.isRequired,
  layout: PropTypes.object.isRequired,
  impressionId: PropTypes.string.isRequired,
  timeout: PropTypes.number,
  userId: PropTypes.string,
  children: PropTypes.node,
};

const defaultProps = {
  timeout: 60,
  userId: '',
};

class Dashboard extends PureComponent {
  static contextType = PluginContext;

  appliedFilters: $TSFixMe;

  appliedOwnDataCharts: $TSFixMe;

  visibilityEventData: $TSFixMe;

  static onBeforeUnload(hasChanged: $TSFixMe) {
    if (hasChanged) {
      window.addEventListener('beforeunload', Dashboard.unload);
    } else {
      window.removeEventListener('beforeunload', Dashboard.unload);
    }
  }

  static unload() {
    const message = t('You have unsaved changes.');
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    window.event.returnValue = message; // Gecko + IE
    return message; // Gecko + Webkit, Safari, Chrome etc.
  }

  constructor(props: $TSFixMe) {
    super(props);
    this.appliedFilters = props.activeFilters ?? {};
    this.appliedOwnDataCharts = props.ownDataCharts ?? {};
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
  }

  componentDidMount() {
    const bootstrapData = getBootstrapData();
    // @ts-expect-error TS(2339): Property 'editMode' does not exist on type 'Readon... Remove this comment to see the full error message
    const { editMode, isPublished, layout } = this.props;
    const eventData = {
      is_soft_navigation: Logger.timeOriginOffset > 0,
      is_edit_mode: editMode,
      mount_duration: Logger.getTimestamp(),
      is_empty: isDashboardEmpty(layout),
      is_published: isPublished,
      // @ts-expect-error TS(2339): Property 'length' does not exist on type 'Bootstra... Remove this comment to see the full error message
      bootstrap_data_length: bootstrapData.length,
    };
    const directLinkComponentId = getLocationHash();
    if (directLinkComponentId) {
      // @ts-expect-error TS(2339): Property 'target_id' does not exist on type '{ is_... Remove this comment to see the full error message
      eventData.target_id = directLinkComponentId;
    }
    // @ts-expect-error TS(2339): Property 'actions' does not exist on type 'Readonl... Remove this comment to see the full error message
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

  UNSAFE_componentWillReceiveProps(nextProps: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'layout' does not exist on type 'Readonly... Remove this comment to see the full error message
    const currentChartIds = getChartIdsFromLayout(this.props.layout);
    const nextChartIds = getChartIdsFromLayout(nextProps.layout);

    // @ts-expect-error TS(2339): Property 'dashboardId' does not exist on type 'Rea... Remove this comment to see the full error message
    if (this.props.dashboardId !== nextProps.dashboardId) {
      // single-page-app navigation check
      return;
    }

    // @ts-expect-error TS(2571): Object is of type 'unknown'.
    if (currentChartIds.length < nextChartIds.length) {
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
      const newChartIds = nextChartIds.filter(
        // @ts-expect-error TS(2571): Object is of type 'unknown'.
        (key: $TSFixMe) => currentChartIds.indexOf(key) === -1,
      );
      newChartIds.forEach((newChartId: $TSFixMe) =>
        // @ts-expect-error TS(2339): Property 'actions' does not exist on type 'Readonl... Remove this comment to see the full error message
        this.props.actions.addSliceToDashboard(
          newChartId,
          getLayoutComponentFromChartId(nextProps.layout, newChartId),
        ),
      );
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
    } else if (currentChartIds.length > nextChartIds.length) {
      // remove chart
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
      const removedChartIds = currentChartIds.filter(
        // @ts-expect-error TS(2571): Object is of type 'unknown'.
        (key: $TSFixMe) => nextChartIds.indexOf(key) === -1,
      );
      removedChartIds.forEach((removedChartId: $TSFixMe) =>
        // @ts-expect-error TS(2339): Property 'actions' does not exist on type 'Readonl... Remove this comment to see the full error message
        this.props.actions.removeSliceFromDashboard(removedChartId),
      );
    }
  }

  applyCharts() {
    const {
      // @ts-expect-error TS(2339): Property 'activeFilters' does not exist on type 'R... Remove this comment to see the full error message
      activeFilters,
      // @ts-expect-error TS(2339): Property 'ownDataCharts' does not exist on type 'R... Remove this comment to see the full error message
      ownDataCharts,
      // @ts-expect-error TS(2339): Property 'chartConfiguration' does not exist on ty... Remove this comment to see the full error message
      chartConfiguration,
      // @ts-expect-error TS(2339): Property 'hasUnsavedChanges' does not exist on typ... Remove this comment to see the full error message
      hasUnsavedChanges,
      // @ts-expect-error TS(2339): Property 'editMode' does not exist on type 'Readon... Remove this comment to see the full error message
      editMode,
    } = this.props;
    const { appliedFilters, appliedOwnDataCharts } = this;
    if (!chartConfiguration) {
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
    // @ts-expect-error TS(2339): Property 'actions' does not exist on type 'Readonl... Remove this comment to see the full error message
    this.props.actions.clearDataMaskState();
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
      // @ts-expect-error TS(2339): Property 'actions' does not exist on type 'Readonl... Remove this comment to see the full error message
      this.props.actions.logEvent(LOG_ACTIONS_HIDE_BROWSER_TAB, {
        ...this.visibilityEventData,
        duration: Logger.getTimestamp() - logStart,
      });
    }
  }

  applyFilters() {
    const { appliedFilters } = this;
    // @ts-expect-error TS(2339): Property 'activeFilters' does not exist on type 'R... Remove this comment to see the full error message
    const { activeFilters, ownDataCharts, slices } = this.props;

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
        affectedChartIds.push(
          // @ts-expect-error TS(2345): Argument of type 'number' is not assignable to par... Remove this comment to see the full error message
          ...getRelatedCharts(filterKey, appliedFilters[filterKey], slices),
        );
      } else if (!appliedFilterKeys.includes(filterKey)) {
        // filterKey is newly added?
        affectedChartIds.push(
          // @ts-expect-error TS(2345): Argument of type 'number' is not assignable to par... Remove this comment to see the full error message
          ...getRelatedCharts(filterKey, activeFilters[filterKey], slices),
        );
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
          affectedChartIds.push(
            // @ts-expect-error TS(2345): Argument of type 'number' is not assignable to par... Remove this comment to see the full error message
            ...getRelatedCharts(filterKey, activeFilters[filterKey], slices),
          );
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

  refreshCharts(ids: $TSFixMe) {
    ids.forEach((id: $TSFixMe) => {
      // @ts-expect-error TS(2339): Property 'actions' does not exist on type 'Readonl... Remove this comment to see the full error message
      this.props.actions.triggerQuery(true, id);
    });
  }

  render() {
    if (this.context.loading) {
      return <Loading />;
    }
    return this.props.children;
  }
}

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
Dashboard.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
Dashboard.defaultProps = defaultProps;

export default Dashboard;
