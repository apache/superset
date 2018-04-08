import React from 'react';
import PropTypes from 'prop-types';

import AlertsWrapper from '../../components/AlertsWrapper';
import GridLayout from './GridLayout';
import Header from './Header';
import { slicePropShape } from '../reducers/propShapes';
import { exportChart } from '../../explore/exploreUtils';
import { areObjectsEqual } from '../../reduxUtils';
import { Logger, ActionLog, LOG_ACTIONS_PAGE_LOAD,
  LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT } from '../../logger';
import { t } from '../../locales';

import '../../../stylesheets/dashboard.css';
import '../v2/stylesheets/index.less';

const propTypes = {
  actions: PropTypes.object,
  initMessages: PropTypes.array,
  dashboard: PropTypes.object.isRequired,
  charts: PropTypes.object.isRequired,
  allSlices:  PropTypes.objectOf(slicePropShape).isRequired,
  datasources: PropTypes.object.isRequired,
  layout: PropTypes.object.isRequired,
  filters: PropTypes.object,
  refresh: PropTypes.bool,
  timeout: PropTypes.number,
  userId: PropTypes.string,
  isStarred: PropTypes.bool,
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
  editMode: false,
};

class Dashboard extends React.PureComponent {
  constructor(props) {
    super(props);
    this.refreshTimer = null;
    this.firstLoad = true;
    this.loadingLog = new ActionLog({
      impressionId: props.impressionId,
      actionType: LOG_ACTIONS_PAGE_LOAD,
      source: 'dashboard',
      sourceId: props.dashboard.id,
      eventNames: [LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT],
    });
    Logger.start(this.loadingLog);

    // alert for unsaved changes
    this.state = { unsavedChanges: false };

    this.rerenderCharts = this.rerenderCharts.bind(this);
    this.updateDashboardTitle = this.updateDashboardTitle.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onChange = this.onChange.bind(this);
    this.fetchAllCharts = this.fetchCharts.bind(this, this.getAllCharts());
    this.startPeriodicRender = this.startPeriodicRender.bind(this);
    this.addSlicesToDashboard = this.addSlicesToDashboard.bind(this);
    this.fetchChart = this.fetchChart.bind(this);
    this.getFormDataExtra = this.getFormDataExtra.bind(this);
    this.exploreChart = this.exploreChart.bind(this);
    this.exportCSV = this.exportCSV.bind(this);
    this.props.actions.fetchFaveStar = this.props.actions.fetchFaveStar.bind(this);
    this.props.actions.saveFaveStar = this.props.actions.saveFaveStar.bind(this);
    this.props.actions.saveSliceName = this.props.actions.saveSliceName.bind(this);
    this.props.actions.removeSlice = this.props.actions.removeSlice.bind(this);
    this.props.actions.removeChart = this.props.actions.removeChart.bind(this);
    this.props.actions.toggleExpandSlice = this.props.actions.toggleExpandSlice.bind(this);
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

  onChange() {
    this.onBeforeUnload(true);
    this.setState({ unsavedChanges: true });
  }

  onSave() {
    this.onBeforeUnload(false);
    this.setState({ unsavedChanges: false });
  }

  // return charts in array
  getAllCharts() {
    return Object.values(this.props.charts);
  }

  getFormDataExtra(chart) {
    const formDataExtra = Object.assign({}, chart.formData);
    const extraFilters = this.effectiveExtraFilters(chart.slice_id);
    formDataExtra.extra_filters = formDataExtra.filters.concat(extraFilters);
    return formDataExtra;
  }

  getFilters(sliceId) {
    return this.props.filters[sliceId];
  }

  unload() {
    const message = t('You have unsaved changes.');
    window.event.returnValue = message; // Gecko + IE
    return message; // Gecko + Webkit, Safari, Chrome etc.
  }

  effectiveExtraFilters(sliceId) {
    const metadata = this.props.dashboard.metadata;
    const filters = this.props.filters;
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
    const immune = this.props.dashboard.metadata.filter_immune_slices || [];
    let charts = this.getAllCharts();
    if (filterKey) {
      charts = charts.filter(slice => (
        String(slice.slice_id) !== filterKey &&
        immune.indexOf(slice.slice_id) === -1
      ));
    }
    this.fetchCharts(charts);
  }

  stopPeriodicRender() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  startPeriodicRender(interval) {
    this.stopPeriodicRender();
    const immune = this.props.dashboard.metadata.timed_refresh_immune_slices || [];
    const refreshAll = () => {
      const affectedSlices = this.getAllCharts()
        .filter(chart => immune.indexOf(chart.slice_id) === -1);
      this.fetchCharts(affectedSlices, true, interval * 0.2);
    };
    const fetchAndRender = () => {
      refreshAll();
      if (interval > 0) {
        this.refreshTimer = setTimeout(fetchAndRender, interval);
      }
    };

    fetchAndRender();
  }

  updateDashboardTitle(title) {
    this.props.actions.updateDashboardTitle(title);
    this.onChange();
  }

  addSlicesToDashboard(sliceIds) {
    return this.props.actions.addSlicesToDashboard(this.props.dashboard.id, sliceIds);
  }

  fetchChart(chart, force = false) {
    return this.props.actions.runQuery(
      this.getFormDataExtra(chart), force, this.props.timeout, chart.chartKey,
    );
  }

  // fetch and render an list of charts
  fetchCharts(chart, force = false, interval = 0) {
    const charts = chart || this.getAllCharts();
    if (!interval) {
      charts.forEach((chart) => { this.fetchChart(chart, force); });
      return;
    }

    const meta = this.props.dashboard.metadata;
    const refreshTime = Math.max(interval, meta.stagger_time || 5000); // default 5 seconds
    if (typeof meta.stagger_refresh !== 'boolean') {
      meta.stagger_refresh = meta.stagger_refresh === undefined ?
        true : meta.stagger_refresh === 'true';
    }
    const delay = meta.stagger_refresh ? refreshTime / (charts.length - 1) : 0;
    charts.forEach((slice, i) => {
      setTimeout(() => { this.fetchChart(slice, force); }, delay * i);
    });
  }

  exploreChart(chart) {
    const formData = this.getFormDataExtra(chart);
    exportChart(formData);
  }

  exportCSV(chart) {
    const formData = this.getFormDataExtra(chart);
    exportChart(formData, 'csv');
  }

  // re-render chart without fetch
  rerenderCharts() {
    this.getAllCharts().forEach((chart) => {
      setTimeout(() => {
        this.props.actions.renderTriggered(new Date().getTime(), chart.chartKey);
      }, 50);
    });
  }

  render() {
    return (
      <div id="dashboard-container">
        <div id="dashboard-header">
          <AlertsWrapper initMessages={this.props.initMessages} />
          <Header
            dashboard={this.props.dashboard}
            layout={this.props.layout}
            unsavedChanges={this.state.unsavedChanges}
            filters={this.props.filters}
            userId={this.props.userId}
            isStarred={this.props.isStarred}
            updateDashboardTitle={this.updateDashboardTitle}
            onSave={this.onSave}
            onChange={this.onChange}
            fetchFaveStar={this.props.actions.fetchFaveStar}
            saveFaveStar={this.props.actions.saveFaveStar}
            renderSlices={this.fetchAllCharts}
            startPeriodicRender={this.startPeriodicRender}
            addSlicesToDashboard={this.addSlicesToDashboard}
            editMode={this.props.editMode}
            setEditMode={this.props.actions.setEditMode}
          />
        </div>
        <GridLayout
            dashboard={this.props.dashboard}
            layout={this.props.layout}
            datasources={this.props.datasources}
            allSlices={this.props.allSlices}
            filters={this.props.filters}
            charts={this.props.charts}
            timeout={this.props.timeout}
            onChange={this.onChange}
            rerenderCharts={this.rerenderCharts}
            getFormDataExtra={this.getFormDataExtra}
            exploreChart={this.exploreChart}
            exportCSV={this.exportCSV}
            fetchChart={this.fetchChart}
            saveSliceName={this.props.actions.saveSliceName}
            removeSlice={this.props.actions.removeSlice}
            removeChart={this.props.actions.removeChart}
            toggleExpandSlice={this.props.actions.toggleExpandSlice}
            addFilter={this.props.actions.addFilter}
            getFilters={this.getFilters}
            removeFilter={this.props.actions.removeFilter}
            editMode={this.props.editMode}
          />
      </div>
    );
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
