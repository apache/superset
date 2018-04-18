import React from 'react';
import PropTypes from 'prop-types';

import AlertsWrapper from '../../components/AlertsWrapper';
import DashboardBuilder from '../v2/containers/DashboardBuilder';
// import GridLayout from './GridLayout';
import { slicePropShape } from '../reducers/propShapes';
// import { exportChart } from '../../explore/exploreUtils';
import { areObjectsEqual } from '../../reduxUtils';
import { Logger, ActionLog, LOG_ACTIONS_PAGE_LOAD,
  LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT } from '../../logger';
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

    // this.rerenderCharts = this.rerenderCharts.bind(this);
    // this.getFormDataExtra = this.getFormDataExtra.bind(this);
    // this.exploreChart = this.exploreChart.bind(this);
    // this.exportCSV = this.exportCSV.bind(this);

    // this.props.actions.saveSliceName = this.props.actions.saveSliceName.bind(this);
    // this.props.actions.removeSliceFromDashboard =
      // this.props.actions.removeSliceFromDashboard.bind(this);
    // this.props.actions.toggleExpandSlice =
      // this.props.actions.toggleExpandSlice.bind(this);
    // this.props.actions.addFilter = this.props.actions.addFilter.bind(this);
    // this.props.actions.removeFilter = this.props.actions.removeFilter.bind(this);
  }

  componentDidMount() {
    // grid does this now
    // window.addEventListener('resize', this.rerenderCharts);
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

  // getFormDataExtra(chart) {
  //   const formDataExtra = Object.assign({}, chart.formData);
  //   const extraFilters = this.effectiveExtraFilters(chart.slice_id);
  //   formDataExtra.extra_filters = formDataExtra.filters.concat(extraFilters);
  //   return formDataExtra;
  // }

  getFilters(sliceId) {
    return this.props.filters[sliceId];
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

  // effectiveExtraFilters(sliceId) {
  //   const metadata = this.props.dashboard.metadata;
  //   const filters = this.props.filters;
  //   const f = [];
  //   const immuneSlices = metadata.filter_immune_slices || [];
  //   if (sliceId && immuneSlices.includes(sliceId)) {
  //     // The slice is immune to dashboard filters
  //     return f;
  //   }
  //
  //   // Building a list of fields the slice is immune to filters on
  //   let immuneToFields = [];
  //   if (
  //     sliceId &&
  //     metadata.filter_immune_slice_fields &&
  //     metadata.filter_immune_slice_fields[sliceId]) {
  //     immuneToFields = metadata.filter_immune_slice_fields[sliceId];
  //   }
  //   for (const filteringSliceId in filters) {
  //     if (filteringSliceId === sliceId.toString()) {
  //       // Filters applied by the slice don't apply to itself
  //       continue;
  //     }
  //     for (const field in filters[filteringSliceId]) {
  //       if (!immuneToFields.includes(field)) {
  //         f.push({
  //           col: field,
  //           op: 'in',
  //           val: filters[filteringSliceId][field],
  //         });
  //       }
  //     }
  //   }
  //   return f;
  // }

  refreshExcept(filterKey) {
    const immune = this.props.dashboard.metadata.filter_immune_slices || [];
    let charts = this.getAllCharts();
    if (filterKey) {
      charts = charts.filter(slice => (
        String(slice.slice_id) !== filterKey &&
        immune.indexOf(slice.slice_id) === -1
      ));
    }
    charts.forEach((chart) => {
      const updatedFormData = this.getFormDataExtra(chart);
      this.props.actions.runQuery(updatedFormData, false, this.props.timeout, chart.chartKey);
    });
  }

  // exploreChart(chartKey) {
  //   const chart = this.props.charts[chartKey];
  //   const formData = this.getFormDataExtra(chart);
  //   exportChart(formData);
  // }
  //
  // exportCSV(chartKey) {
  //   const chart = this.props.charts[chartKey];
  //   const formData = this.getFormDataExtra(chart);
  //   exportChart(formData, 'csv');
  // }

  // re-render chart without fetch
  // rerenderCharts() {
  //   this.getAllCharts().forEach((chart) => {
  //     setTimeout(() => {
  //       this.props.actions.renderTriggered(new Date().getTime(), chart.chartKey);
  //     }, 50);
  //   });
  // }

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
