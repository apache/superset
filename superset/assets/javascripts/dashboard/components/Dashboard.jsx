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
  isFiltersChanged: PropTypes.bool,
  updateDashboardTitle: PropTypes.func,
  readFilters: PropTypes.func,
  fetchFaveStar: PropTypes.func,
  saveFaveStar: PropTypes.func,
  renderSlices: PropTypes.func,
  startPeriodicRender: PropTypes.func,
  getFormDataExtra: PropTypes.func,
  fetchSlice: PropTypes.func,
  saveSlice: PropTypes.func,
  removeSlice: PropTypes.func,
  removeChart: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  updateDashboardLayout: PropTypes.func,
  addSlicesToDashboard: PropTypes.func,
  addFilter: PropTypes.func,
  clearFilter: PropTypes.func,
  removeFilter: PropTypes.func,
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
  isFiltersChanged: false,
};

class Dashboard extends React.PureComponent {
  constructor(props) {
    super(props);
    this.refreshTimer = null;
    this.firstLoad = true;

    // alert for unsaved changes
    this.state = {
      alert: null,
    };
  }

  componentDidMount() {
    this.loadPreSelectFilters();
    this.firstLoad = false;
    this.bindResizeToWindowResize();
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
    return Object.keys(this.props.slices).map(key => (this.props.slices[key]));
  }

  getFormDataExtra(slice) {
    const formDataExtra = Object.assign({}, slice.formData);
    const extraFilters = this.effectiveExtraFilters(slice.slice_id);
    formDataExtra.filters = formDataExtra.filters.concat(extraFilters);
    return formDataExtra;
  }

  unload() {
    const message = t('You have unsaved changes.');
    window.event.returnValue = message; // Gecko + IE
    return message; // Gecko + Webkit, Safari, Chrome etc.
  }

  fetchSlice(slice, force = false) {
    return this.props.actions.runQuery(
      this.getFormDataExtra(slice), force, this.props.timeout, slice.chartKey);
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
          this.props.filters[key][col], false, false);
      }
    }
  }

  refreshExcept(sliceId) {
    const immune = this.props.dashboard.metadata.filter_immune_slices || [];
    const slices = this.getAllSlices()
      .filter(slice => slice.slice_id !== sliceId && immune.indexOf(slice.slice_id) === -1);
    this.renderSlices(slices);
  }

  stopPeriodicRender() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  startPeriodicRender(interval) {
    this.stopPeriodicRender();
    const dash = this;
    const immune = this.props.dashboard.metadata.timed_refresh_immune_slices || [];
    const refreshAll = () => {
      const affectedSlices = this.getAllSlices()
        .filter(slice => immune.indexOf(slice.slice_id) === -1);
      dash.renderSlices(affectedSlices, true, interval * 0.2);
    };
    const fetchAndRender = function () {
      refreshAll();
      if (interval > 0) {
        dash.refreshTimer = setTimeout(fetchAndRender, interval);
      }
    };

    fetchAndRender();
  }

  readFilters() {
    // Returns a list of human readable active filters
    return JSON.stringify(this.props.filters, null, '  ');
  }

  bindResizeToWindowResize() {
    let resizeTimer;
    const dash = this;
    const allSlices = this.getAllSlices();
    $(window).on('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(dash.renderSlices(allSlices), 500);
    });
  }

  updateDashboardTitle(title) {
    this.props.updateDashboardTitle(title);
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

  // render an list of slices
  renderSlices(slc, force = false, interval = 0) {
    const dash = this;
    const slices = slc || this.getAllSlices();
    if (!interval) {
      slices.forEach(slice => (dash.fetchSlice(slice, force)));
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
      setTimeout(() => dash.fetchSlice(slice, force), delay * i);
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
            updateDashboardTitle={this.updateDashboardTitle.bind(this)}
            onSave={this.onSave.bind(this)}
            onChange={this.onChange.bind(this)}
            serialize={this.serialize.bind(this)}
            readFilters={this.readFilters.bind(this)}
            fetchFaveStar={this.props.actions.fetchFaveStar.bind(this)}
            saveFaveStar={this.props.actions.saveFaveStar.bind(this)}
            renderSlices={this.renderSlices.bind(this, this.getAllSlices())}
            startPeriodicRender={this.startPeriodicRender.bind(this)}
            addSlicesToDashboard={this.props.actions.addSlicesToDashboard
              .bind(this, this.props.dashboard.id)}
          />
        </div>
        <div id="grid-container" className="slice-grid gridster">
          <GridLayout
            dashboard={this.props.dashboard}
            datasources={this.props.datasources}
            filters={this.props.filters}
            charts={this.props.slices}
            timeout={this.props.timeout}
            onChange={this.onChange.bind(this)}
            getFormDataExtra={this.getFormDataExtra.bind(this)}
            fetchSlice={this.fetchSlice.bind(this)}
            saveSlice={this.props.actions.saveSlice.bind(this)}
            removeSlice={this.props.actions.removeSlice.bind(this)}
            removeChart={this.props.actions.removeChart.bind(this)}
            updateDashboardLayout={this.props.actions.updateDashboardLayout.bind(this)}
            toggleExpandSlice={this.props.actions.toggleExpandSlice.bind(this)}
            addFilter={this.props.actions.addFilter.bind(this)}
            clearFilter={this.props.actions.clearFilter.bind(this)}
            removeFilter={this.props.actions.removeFilter.bind(this)}
          />
        </div>
      </div>
    );
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
