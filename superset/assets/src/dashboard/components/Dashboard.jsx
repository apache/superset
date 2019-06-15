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
import React from 'react';
import PropTypes from 'prop-types';
import { t } from '@superset-ui/translation';

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
import OmniContianer from '../../components/OmniContainer';

import '../stylesheets/index.less';

import getPublishSubscriberMap from '../util/getPublishSubscriberMap';
import { DASHBOARD_HEADER_ID } from '../util/constants';

import ChartModal from './ChartModal';
import { getModalSliceIDFor, getSubHeaderForSlice } from '../util/publishSubscriberUtil';
import { chart as initChart } from '../../chart/chartReducer';

const propTypes = {
  actions: PropTypes.shape({
    addSliceToDashboard: PropTypes.func.isRequired,
    removeSliceFromDashboard: PropTypes.func.isRequired,
    runQuery: PropTypes.func.isRequired,
  }).isRequired,
  dashboardInfo: dashboardInfoPropShape.isRequired,
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
  // eslint-disable-next-line react/sort-comp
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
    this.isFirstLoad = true;
    this.actionLog = new ActionLog({
      impressionId: props.impressionId,
      source: 'dashboard',
      sourceId: props.dashboardInfo.id,
      eventNames: DASHBOARD_EVENT_NAMES,
    });
    Logger.start(this.actionLog);
    this.initTs = new Date().getTime();
    //init  required modal props 
    this.modalChart = { ...initChart };
    this.modalDatasource = {};
    this.closeModal = this.closeModal.bind(this);
    this.modalAddFilterHandler = this.modalAddFilterHandler.bind(this);

  }

  componentDidMount() {
    Logger.append(LOG_ACTIONS_MOUNT_DASHBOARD);
  }

  componentWillReceiveProps(nextProps) {
    if (!nextProps.dashboardState.editMode) {
      // log pane loads
      const loadedPaneIds = [];
      let minQueryStartTime = Infinity;
      const allVisiblePanesDidLoad = Object.entries(nextProps.loadStats).every(
        ([paneId, stats]) => {
          const {
            didLoad,
            minQueryStartTime: paneMinQueryStart,
            ...restStats
          } = stats;
          if (
            didLoad &&
            this.props.loadStats[paneId] &&
            !this.props.loadStats[paneId].didLoad
          ) {
            Logger.append(LOG_ACTIONS_LOAD_DASHBOARD_PANE, {
              ...restStats,
              duration: new Date().getTime() - paneMinQueryStart,
              version: 'v2',
            });

            if (!this.isFirstLoad) {
              Logger.send(this.actionLog);
            }
          }
          if (this.isFirstLoad && didLoad && stats.slice_ids.length > 0) {
            loadedPaneIds.push(paneId);
            minQueryStartTime = Math.min(minQueryStartTime, paneMinQueryStart);
          }

          // return true if it is loaded, or it's index is not 0
          return didLoad || stats.index !== 0;
        },
      );

      if (allVisiblePanesDidLoad && this.isFirstLoad) {
        Logger.append(LOG_ACTIONS_FIRST_DASHBOARD_LOAD, {
          pane_ids: loadedPaneIds,
          duration: new Date().getTime() - minQueryStartTime,
          version: 'v2',
        });
        Logger.send(this.actionLog);
        this.isFirstLoad = false;
      }
    }

    const currentChartIds = getChartIdsFromLayout(this.props.layout);
    const nextChartIds = getChartIdsFromLayout(nextProps.layout);

    if (currentChartIds.length < nextChartIds.length) {
      const newChartIds = nextChartIds.filter(
        key => currentChartIds.indexOf(key) === -1,
      );
      newChartIds.forEach(newChartId =>
        this.props.actions.addSliceToDashboard(newChartId),
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

    if (nextProps.dashboardState.modalChartId != this.props.dashboardState.modalChartId) {
      // update modal  chart  state renedered
      this.updateModalProps(nextProps.dashboardState.modalChartId, (nextProps.dashboardState.modalChartId != -1))
    }

  }

  modalAddFilterHandler(...args) {
    this.props.actions.changeFilter(this.modalChart, ...args);
  }

  componentDidUpdate(prevProps) {
    const { refresh, filters, hasUnsavedChanges, doReconcile } = this.props.dashboardState;
    //reconcile dashboard
    if (doReconcile) {
      const publishSubscriberMap = getPublishSubscriberMap(this.getAllCharts());
      const savePayload = {
        positions: this.props.layout,
        css: this.props.dashboardState.css,
        expanded_slices: this.props.dashboardState.expandedSlices,
        dashboard_title: this.props.layout[DASHBOARD_HEADER_ID].meta.text,
        default_filters: JSON.stringify(this.props.dashboardState.filters),
        duplicate_slices: false,
        pub_sub_info: publishSubscriberMap,
      };
      const dashID = this.props.dashboardInfo.id;
      this.props.actions.reconcileSuccess(savePayload, dashID);
    }
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
        this.openModal(changedFilterKey);
        this.refreshExcept(changedFilterKey);
      }
    }

    if (hasUnsavedChanges) {
      Dashboard.onBeforeUnload(true);
    } else {
      Dashboard.onBeforeUnload(false);
    }
  }

  openModal(filterKey) {
    const slice_id = getModalSliceIDFor(this.props.dashboardState.publishSubscriberMap, filterKey);
    if (slice_id) {
      // open modal with chart in loading state
      this.updateModalProps(slice_id, true, 'loading')
    }
  }

  updateModalProps(slice_id, showModal, status = undefined) {
    this.showModal = showModal
    this.modalChart = this.props.charts[slice_id];
    if (this.modalChart) {
      if (status) {
        this.modalChart.chartStatus = status;
      }
      const modalTitle = this.props.slices[slice_id].slice_name;
      const modalSubTitle = getSubHeaderForSlice(this.props.dashboardState.publishSubscriberMap.subscribers, slice_id, this.props.dashboardState.filters)
      this.modalTitle = (modalSubTitle != '') ? modalTitle + ' ' + modalSubTitle : modalTitle;
      this.modalDatasource = this.props.datasources[this.modalChart.formData.datasource];
    }
  }

  updateModalChart(filterKey, responseChatId) {
    const slice_id = getModalSliceIDFor(this.props.dashboardState.publishSubscriberMap, filterKey);
    if (slice_id == responseChatId) {
      this.props.actions.updateModalChart(slice_id)
    }
  }

  closeModal() {
    this.props.actions.hideModal();
  }

  // return charts in array
  getAllCharts() {
    return Object.values(this.props.charts);
  }

  refreshExcept(filterKey) {
    const immune = this.props.dashboardInfo.metadata.filter_immune_slices || [];
    const subscribers = this.props.dashboardState.publishSubscriberMap && this.props.dashboardState.publishSubscriberMap.subscribers;

    this.getAllCharts().forEach(chart => {
      // filterKey is a string, immune array contains numbers
      if (String(chart.id) !== filterKey && immune.indexOf(chart.id) === -1 && this.isFilterkeyExistInLinkedSlices(subscribers, chart.id, filterKey)) {
        const updatedFormData = getFormDataWithExtraFilters({
          chart,
          dashboardMetadata: this.props.dashboardInfo.metadata,
          filters: this.props.dashboardState.filters,
          sliceId: chart.id,
          publishSubscriberMap: this.props.dashboardState.publishSubscriberMap,
        });

        this.props.actions.runQuery(
          updatedFormData,
          false,
          this.props.timeout,
          chart.id,
        ).then((responses) => {
          // 1st promise response is always about chart status
          const response = responses[0];
          if (this.props.dashboardState.modalSliceIds.indexOf(response.key) != -1) {
            this.updateModalChart(filterKey, response.key);
          }
        }).catch((response) => {
          console.log(response)
        });
      }
    });
  }

  isFilterkeyExistInLinkedSlices(subscribers, sliceId, publisherId) {
    let keyExists = false;
    if (subscribers && subscribers[sliceId]) {
      let applyFilterPublisherIds = subscribers[parseInt(sliceId)].actions['APPLY_FILTER'] || [];
      keyExists = (applyFilterPublisherIds.some((id) => id == parseInt(publisherId)));
    }
    return keyExists
  }

  render() {
    const {
      impressionId,
      dashboardInfo: { id },
    } = this.props;

    return (
      <React.Fragment>
        <OmniContianer impressionId={impressionId} dashboardId={id} />
        <DashboardBuilder />
        <ChartModal showModal={this.showModal}
          chart={this.modalChart}
          addFilter={this.modalAddFilterHandler}
          modalTitle={this.modalTitle}
          datasource={this.modalDatasource}
          close={this.closeModal}
        />
      </React.Fragment>
    );
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
