import React from 'react';
import PropTypes from 'prop-types';

import AlertsWrapper from '../../components/AlertsWrapper';
import GridLayout from './GridLayout';
import {
  chartPropShape,
  slicePropShape,
  dashboardInfoPropShape,
  dashboardStatePropShape,
} from '../v2/util/propShapes';
import { exportChart } from '../../explore/exploreUtils';
import { areObjectsEqual } from '../../reduxUtils';
import { getChartIdsFromLayout } from '../util/dashboardHelper';
import { Logger, ActionLog, LOG_ACTIONS_PAGE_LOAD,
  LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT } from '../../logger';
import { t } from '../../locales';

import '../../../stylesheets/dashboard.less';
import '../v2/stylesheets/index.less';

const propTypes = {
  actions: PropTypes.object.isRequired,
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

    this.rerenderCharts = this.rerenderCharts.bind(this);
    this.getFilters = this.getFilters.bind(this);
    this.refreshExcept = this.refreshExcept.bind(this);
    this.getFormDataExtra = this.getFormDataExtra.bind(this);
    this.exploreChart = this.exploreChart.bind(this);
    this.exportCSV = this.exportCSV.bind(this);

    this.props.actions.saveSliceName = this.props.actions.saveSliceName.bind(this);
    this.props.actions.removeSliceFromDashboard =
      this.props.actions.removeSliceFromDashboard.bind(this);
    this.props.actions.toggleExpandSlice =
      this.props.actions.toggleExpandSlice.bind(this);
    this.props.actions.addFilter = this.props.actions.addFilter.bind(this);
    this.props.actions.removeFilter = this.props.actions.removeFilter.bind(this);
  }

  componentDidMount() {
    window.addEventListener('resize', this.rerenderCharts);
  }

  componentWillReceiveProps(nextProps) {
    if (this.firstLoad &&
      Object.values(nextProps.charts)
        .every(chart => (['rendered', 'failed', 'stopped'].indexOf(chart.chartStatus) > -1))
    ) {
      Logger.end(this.loadingLog);
      this.firstLoad = false;
    }

    const currentChartIds = getChartIdsFromLayout(this.props.layout);
    const nextChartIds = getChartIdsFromLayout(nextProps.layout);
    if (currentChartIds.length < nextChartIds.length) {
      // adding new chart
      const newChartId = nextChartIds.find(key => (currentChartIds.indexOf(key) === -1));
      this.props.actions.addSliceToDashboard(newChartId);
      this.props.actions.onChange();
    } else if (currentChartIds.length > nextChartIds.length) {
      // remove chart
      const removedChartId = currentChartIds.find(key => (nextChartIds.indexOf(key) === -1));
      this.props.actions.removeSliceFromDashboard(this.props.charts[removedChartId]);
      this.props.actions.onChange();
    }
  }

  componentDidUpdate(prevProps) {
    const { refresh, filters, hasUnsavedChanges } = this.props.dashboardState;
    if (refresh) {
      let changedFilterKey;
      const prevFiltersKeySet = new Set(Object.keys(prevProps.dashboardState.filters));
      Object.keys(filters).some((key) => {
        prevFiltersKeySet.delete(key);
        if (prevProps.dashboardState.filters[key] === undefined ||
          !areObjectsEqual(prevProps.dashboardState.filters[key], filters[key])) {
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
      this.onBeforeUnload(true);
    } else {
      this.onBeforeUnload(false);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.rerenderCharts);
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

  getFormDataExtra(chart) {
    const extraFilters = this.effectiveExtraFilters(chart.id);
    const formDataExtra = {
      ...chart.formData,
      extra_filters: extraFilters,
    };
    return formDataExtra;
  }

  getFilters(sliceId) {
    return this.props.dashboardState.filters[sliceId];
  }

  unload() {
    const message = t('You have unsaved changes.');
    window.event.returnValue = message; // Gecko + IE
    return message; // Gecko + Webkit, Safari, Chrome etc.
  }

  effectiveExtraFilters(sliceId) {
    const metadata = this.props.dashboardInfo.metadata;
    const filters = this.props.dashboardState.filters;
    const f = [];
    const immuneSlices = metadata.filter_immune_slices || [];
    if (sliceId && immuneSlices.includes(sliceId)) {
      // The slice is immune to dashboard filters
      return f;
    }

    // Building a list of fields the slice is immune to filters on
    let immuneToFields = [];
    if (
      sliceId &&
      metadata.filter_immune_slice_fields &&
      metadata.filter_immune_slice_fields[sliceId]) {
      immuneToFields = metadata.filter_immune_slice_fields[sliceId];
    }
    for (const filteringSliceId in filters) {
      if (filteringSliceId === sliceId.toString()) {
        // Filters applied by the slice don't apply to itself
        continue;
      }
      for (const field in filters[filteringSliceId]) {
        if (!immuneToFields.includes(field)) {
          f.push({
            col: field,
            op: 'in',
            val: filters[filteringSliceId][field],
          });
        }
      }
    }
    return f;
  }

  refreshExcept(filterKey) {
    const immune = this.props.dashboardInfo.metadata.filter_immune_slices || [];
    let charts = this.getAllCharts();
    if (filterKey) {
      charts = charts.filter(
        chart => (String(chart.id) !== filterKey && immune.indexOf(chart.id) === -1),
      );
    }
    charts.forEach((chart) => {
      const updatedFormData = this.getFormDataExtra(chart);
      this.props.actions.runQuery(updatedFormData, false, this.props.timeout, chart.id);
    });
  }

  exploreChart(chartId) {
    const chart = this.props.charts[chartId];
    const formData = this.getFormDataExtra(chart);
    exportChart(formData);
  }

  exportCSV(chartId) {
    const chart = this.props.charts[chartId];
    const formData = this.getFormDataExtra(chart);
    exportChart(formData, 'csv');
  }

  // re-render chart without fetch
  rerenderCharts() {
    this.getAllCharts().forEach((chart) => {
      setTimeout(() => {
        this.props.actions.renderTriggered(new Date().getTime(), chart.id);
      }, 50);
    });
  }

  render() {
    const {
      expandedSlices = {}, filters, sliceIds,
      editMode, showBuilderPane,
    } = this.props.dashboardState;

    return (
      <div id="dashboard-container">
        <div>
          <AlertsWrapper initMessages={this.props.initMessages} />
        </div>
        <GridLayout
          dashboardInfo={this.props.dashboardInfo}
          layout={this.props.layout}
          datasources={this.props.datasources}
          slices={this.props.slices}
          sliceIds={sliceIds}
          expandedSlices={expandedSlices}
          filters={filters}
          charts={this.props.charts}
          timeout={this.props.timeout}
          onChange={this.onChange}
          rerenderCharts={this.rerenderCharts}
          getFormDataExtra={this.getFormDataExtra}
          exploreChart={this.exploreChart}
          exportCSV={this.exportCSV}
          refreshChart={this.props.actions.refreshChart}
          saveSliceName={this.props.actions.saveSliceName}
          toggleExpandSlice={this.props.actions.toggleExpandSlice}
          addFilter={this.props.actions.addFilter}
          getFilters={this.getFilters}
          removeFilter={this.props.actions.removeFilter}
          editMode={editMode}
          showBuilderPane={showBuilderPane}
        />
      </div>
    );
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
