import React from 'react';
import PropTypes from 'prop-types';

import AlertsWrapper from '../../components/AlertsWrapper';
import GridLayout from './GridLayout';
import Header from './Header';
import {
  chartPropShape,
  slicePropShape,
  dashboardInfoPropShape,
  dashboardStatePropShape,
} from '../v2/util/propShapes';
import { exportChart } from '../../explore/exploreUtils';
import { areObjectsEqual } from '../../reduxUtils';
import { Logger, ActionLog, LOG_ACTIONS_PAGE_LOAD,
  LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT } from '../../logger';
import { t } from '../../locales';

import '../../../stylesheets/dashboard.css';
import '../v2/stylesheets/index.less';

const propTypes = {
  actions: PropTypes.object.isRequired,
  dashboardInfo: dashboardInfoPropShape.isRequired,
  dashboardState: dashboardStatePropShape.isRequired,
  charts: PropTypes.objectOf(chartPropShape).isRequired,
  slices:  PropTypes.objectOf(slicePropShape).isRequired,
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
    this.refreshTimer = null;
    this.firstLoad = true;
    this.loadingLog = new ActionLog({
      impressionId: props.impressionId,
      actionType: LOG_ACTIONS_PAGE_LOAD,
      source: 'dashboard',
      sourceId: props.dashboardInfo.id,
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
    this.fetchChart = this.fetchChart.bind(this);
    this.getFilters = this.getFilters.bind(this);
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
    if (this.props.dashboardState.refresh) {
      let changedFilterKey;
      const prevFiltersKeySet = new Set(Object.keys(prevProps.dashboardState.filters));
      Object.keys(this.props.dashboardState.filters).some((key) => {
        prevFiltersKeySet.delete(key);
        if (prevProps.dashboardState.filters[key] === undefined ||
          !areObjectsEqual(prevProps.dashboardState.filters[key], this.props.dashboardState.filters[key])) {
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
      charts = charts.filter(chart => (
        String(chart.id) !== filterKey &&
        immune.indexOf(chart.id) === -1
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
    const immune = this.props.dashboardInfo.metadata.timed_refresh_immune_slices || [];
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

  fetchChart(chart, force = false) {
    return this.props.actions.runQuery(
      this.getFormDataExtra(chart), force, this.props.timeout, chart.id,
    );
  }

  // fetch and render an list of charts
  fetchCharts(charts, force = false, interval = 0) {
    const allCharts = charts || this.getAllCharts();
    if (!interval) {
      allCharts.forEach((chart) => { this.fetchChart(chart, force); });
      return;
    }

    const meta = this.props.dashboardInfo.metadata;
    const refreshTime = Math.max(interval, meta.stagger_time || 5000); // default 5 seconds
    if (typeof meta.stagger_refresh !== 'boolean') {
      meta.stagger_refresh = meta.stagger_refresh === undefined ?
        true : meta.stagger_refresh === 'true';
    }
    const delay = meta.stagger_refresh ? refreshTime / (allCharts.length - 1) : 0;
    allCharts.forEach((slice, i) => {
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
        this.props.actions.renderTriggered(new Date().getTime(), chart.id);
      }, 50);
    });
  }

  render() {
    const { title, expandedSlices = {}, filters, sliceIds, editMode } = this.props.dashboardState;

    return (
      <div id="dashboard-container">
        <div id="dashboard-header">
          <AlertsWrapper initMessages={this.props.initMessages} />
          <Header
            dashboardTitle={title}
            dashboardInfo={this.props.dashboardInfo}
            unsavedChanges={this.state.unsavedChanges}
            layout={this.props.layout}
            filters={filters}
            userId={this.props.dashboardInfo.userId}
            updateDashboardTitle={this.updateDashboardTitle}
            onSave={this.onSave}
            onChange={this.onChange}
            serialize={this.serialize}
            fetchFaveStar={this.props.actions.fetchFaveStar}
            saveFaveStar={this.props.actions.saveFaveStar}
            renderSlices={this.fetchAllSlices}
            startPeriodicRender={this.startPeriodicRender}
            editMode={editMode}
            setEditMode={this.props.actions.setEditMode}
          />
        </div>
        <div id="grid-container" className="slice-grid gridster">
          <GridLayout
            dashboardInfo={this.props.dashboardInfo}
            datasources={this.props.datasources}
            layout={this.props.layout}
            slices={this.props.slices}
            sliceIds={sliceIds}
            expandedSlices={expandedSlices}
            filters={filters}
            charts={this.props.charts}
            timeout={this.props.timeout}
            onChange={this.onChange}
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
            editMode={editMode}
          />
        </div>
      </div>
    );
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
