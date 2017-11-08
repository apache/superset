import React from 'react';
import PropTypes from 'prop-types';

import AlertsWrapper from '../../components/AlertsWrapper';
import GridLayout from './GridLayout';
import Header from './Header';
import DashboardAlert from './DashboardAlert';
import { getExploreUrl } from '../../explore/exploreUtils';
import { areObjectsEqual } from '../../reduxUtils';
import { t } from '../../locales';

import '../../../stylesheets/dashboard.css';

const propTypes = {
  actions: PropTypes.object,
  initMessages: PropTypes.array,
  dashboard: PropTypes.object.isRequired,
  slices: PropTypes.object,
  datasources: PropTypes.object,
  filters: PropTypes.object,
  refresh: PropTypes.bool,
  timeout: PropTypes.number,
  userId: PropTypes.string,
  isStarred: PropTypes.bool,
};

const defaultProps = {
  initMessages: [],
  dashboard: {},
  slices: {},
  datasources: {},
  filters: {},
  timeout: 60,
  userId: '',
  isStarred: false,
};

class Dashboard extends React.PureComponent {
  constructor(props) {
    super(props);
    this.refreshTimer = null;
    this.firstLoad = true;

    // alert for unsaved changes
    this.state = {
      alert: null,
      trigger: false,
    };

    this.rerenderCharts = this.rerenderCharts.bind(this);
    this.updateDashboardTitle = this.updateDashboardTitle.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onChange = this.onChange.bind(this);
    this.serialize = this.serialize.bind(this);
    this.readFilters = this.readFilters.bind(this);
    this.fetchAllSlices = this.fetchSlices.bind(this, this.getAllSlices());
    this.startPeriodicRender = this.startPeriodicRender.bind(this);
    this.addSlicesToDashboard = this.addSlicesToDashboard.bind(this);
    this.fetchSlice = this.fetchSlice.bind(this);
    this.getFormDataExtra = this.getFormDataExtra.bind(this);
    this.props.actions.fetchFaveStar = this.props.actions.fetchFaveStar.bind(this);
    this.props.actions.saveFaveStar = this.props.actions.saveFaveStar.bind(this);
    this.props.actions.saveSlice = this.props.actions.saveSlice.bind(this);
    this.props.actions.removeSlice = this.props.actions.removeSlice.bind(this);
    this.props.actions.removeChart = this.props.actions.removeChart.bind(this);
    this.props.actions.updateDashboardLayout = this.props.actions.updateDashboardLayout.bind(this);
    this.props.actions.toggleExpandSlice = this.props.actions.toggleExpandSlice.bind(this);
    this.props.actions.addFilter = this.props.actions.addFilter.bind(this);
    this.props.actions.clearFilter = this.props.actions.clearFilter.bind(this);
    this.props.actions.removeFilter = this.props.actions.removeFilter.bind(this);
  }

  componentDidMount() {
    this.loadPreSelectFilters();
    this.firstLoad = false;
    window.addEventListener('resize', this.rerenderCharts);
  }

  componentWillReceiveProps(nextProps) {
    // check filters is changed
    if (!areObjectsEqual(nextProps.filters, this.props.filters)) {
      this.renderUnsavedChangeAlert();
    }
  }

  componentDidUpdate(prevProps) {
    if (!areObjectsEqual(prevProps.filters, this.props.filters) && this.props.refresh) {
      Object.keys(this.props.filters).forEach(sliceId => (this.refreshExcept(sliceId)));
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
    this.renderUnsavedChangeAlert();
  }

  onSave() {
    this.onBeforeUnload(false);
    this.setState({
      alert: '',
    });
  }

  // return charts in array
  getAllSlices() {
    return Object.values(this.props.slices);
  }

  getFormDataExtra(slice) {
    const formDataExtra = Object.assign({}, slice.formData);
    const extraFilters = this.effectiveExtraFilters(slice.slice_id);
    formDataExtra.filters = formDataExtra.filters.concat(extraFilters);
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

  jsonEndpoint(data, force = false) {
    let endpoint = getExploreUrl(data, 'json', force);
    if (endpoint.charAt(0) !== '/') {
      // Known issue for IE <= 11:
      // https://connect.microsoft.com/IE/feedbackdetail/view/1002846/pathname-incorrect-for-out-of-document-elements
      endpoint = '/' + endpoint;
    }
    return endpoint;
  }

  loadPreSelectFilters() {
    for (const key in this.props.filters) {
      for (const col in this.props.filters[key]) {
        const sliceId = parseInt(key, 10);
        this.props.actions.addFilter(sliceId, col,
          this.props.filters[key][col], false, false,
        );
      }
    }
  }

  refreshExcept(sliceId) {
    const immune = this.props.dashboard.metadata.filter_immune_slices || [];
    const slices = this.getAllSlices()
      .filter(slice => slice.slice_id !== sliceId && immune.indexOf(slice.slice_id) === -1);
    this.fetchSlices(slices);
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
      const affectedSlices = this.getAllSlices()
        .filter(slice => immune.indexOf(slice.slice_id) === -1);
      this.fetchSlices(affectedSlices, true, interval * 0.2);
    };
    const fetchAndRender = () => {
      refreshAll();
      if (interval > 0) {
        this.refreshTimer = setTimeout(fetchAndRender, interval);
      }
    };

    fetchAndRender();
  }

  readFilters() {
    // Returns a list of human readable active filters
    return JSON.stringify(this.props.filters, null, '  ');
  }

  updateDashboardTitle(title) {
    this.props.actions.updateDashboardTitle(title);
    this.onChange();
  }

  serialize() {
    return this.props.dashboard.layout.map(reactPos => ({
      slice_id: reactPos.i,
      col: reactPos.x + 1,
      row: reactPos.y,
      size_x: reactPos.w,
      size_y: reactPos.h,
    }));
  }

  addSlicesToDashboard(sliceIds) {
    return this.props.actions.addSlicesToDashboard(this.props.dashboard.id, sliceIds);
  }

  fetchSlice(slice, force = false) {
    return this.props.actions.runQuery(
      this.getFormDataExtra(slice), force, this.props.timeout, slice.chartKey,
    );
  }

  // fetch and render an list of slices
  fetchSlices(slc, force = false, interval = 0) {
    const slices = slc || this.getAllSlices();
    if (!interval) {
      slices.forEach((slice) => { this.fetchSlice(slice, force); });
      return;
    }

    const meta = this.props.dashboard.metadata;
    const refreshTime = Math.max(interval, meta.stagger_time || 5000); // default 5 seconds
    if (typeof meta.stagger_refresh !== 'boolean') {
      meta.stagger_refresh = meta.stagger_refresh === undefined ?
        true : meta.stagger_refresh === 'true';
    }
    const delay = meta.stagger_refresh ? refreshTime / (slices.length - 1) : 0;
    slices.forEach((slice, i) => {
      setTimeout(() => { this.fetchSlice(slice, force); }, delay * i);
    });
  }

  // re-render chart without fetch
  rerenderCharts() {
    this.getAllSlices().forEach((slice) => {
      setTimeout(() => {
        this.props.actions.renderTriggered(new Date().getTime(), slice.chartKey);
      }, 50);
    });
  }

  renderUnsavedChangeAlert() {
    this.setState({
      alert: (
        <span>
          <strong>{t('You have unsaved changes.')}</strong> {t('Click the')} &nbsp;
          <i className="fa fa-save" />&nbsp;
          {t('button on the top right to save your changes.')}
        </span>
      ),
    });
  }

  render() {
    return (
      <div id="dashboard-container">
        {this.state.alert && <DashboardAlert alertContent={this.state.alert} />}
        <div id="dashboard-header">
          <AlertsWrapper initMessages={this.props.initMessages} />
          <Header
            dashboard={this.props.dashboard}
            userId={this.props.userId}
            isStarred={this.props.isStarred}
            updateDashboardTitle={this.updateDashboardTitle}
            onSave={this.onSave}
            onChange={this.onChange}
            serialize={this.serialize}
            readFilters={this.readFilters}
            fetchFaveStar={this.props.actions.fetchFaveStar}
            saveFaveStar={this.props.actions.saveFaveStar}
            renderSlices={this.fetchAllSlices}
            startPeriodicRender={this.startPeriodicRender}
            addSlicesToDashboard={this.addSlicesToDashboard}
          />
        </div>
        <div id="grid-container" className="slice-grid gridster">
          <GridLayout
            dashboard={this.props.dashboard}
            datasources={this.props.datasources}
            filters={this.props.filters}
            charts={this.props.slices}
            timeout={this.props.timeout}
            onChange={this.onChange}
            getFormDataExtra={this.getFormDataExtra}
            fetchSlice={this.fetchSlice}
            saveSlice={this.props.actions.saveSlice}
            removeSlice={this.props.actions.removeSlice}
            removeChart={this.props.actions.removeChart}
            updateDashboardLayout={this.props.actions.updateDashboardLayout}
            toggleExpandSlice={this.props.actions.toggleExpandSlice}
            addFilter={this.props.actions.addFilter}
            getFilters={this.getFilters}
            clearFilter={this.props.actions.clearFilter}
            removeFilter={this.props.actions.removeFilter}
          />
        </div>
      </div>
    );
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
