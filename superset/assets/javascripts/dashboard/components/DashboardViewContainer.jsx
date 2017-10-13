import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import urlLib from 'url';

import AlertsWrapper from '../../components/AlertsWrapper';
import GridLayout from './GridLayout';
import Header from './Header';
import DashboardAlert from './DashboardAlert';
import * as Actions from '../actions';
import { getExploreUrl } from '../../explore/exploreUtils';
import { areObjectsEqual } from '../../reduxUtils';
import { t } from '../../locales';

import '../../../stylesheets/dashboard.css';

const propTypes = {
  actions: PropTypes.object.isRequired,
  initMessages: PropTypes.array,
  dashboard: PropTypes.object.isRequired,
  datasources: PropTypes.object,
  filters: PropTypes.object,
  refresh: PropTypes.bool,
  timeout: PropTypes.number,
  user_id: PropTypes.string,
  isStarred: PropTypes.bool,
};
const defaultProps = {
  actions: {},
  initMessages: [],
  dashboard: {},
  datasources: {},
  filters: {},
  refresh: false,
  timeout: 60,
  user_id: '',
  isStarred: false,
};

class DashboardViewContainer extends React.PureComponent {
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

  componentDidUpdate(prevProps) {
    // check filters is changed
    if (!areObjectsEqual(prevProps.filters, this.props.filters)) {
      this.updateFilterParamsInUrl();

      if (this.props.refresh) {
        Object.keys(this.props.filters).forEach(sliceId => (this.refreshExcept(sliceId)));
      }
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

  getFormDataExtra(slice) {
    const formDataExtra = Object.assign({}, slice.formData);
    const extraFilters = this.effectiveExtraFilters(slice.slice_id);
    formDataExtra.filters = formDataExtra.filters.concat(extraFilters);
    return formDataExtra;
  }

  readFilters() {
    // Returns a list of human readable active filters
    return JSON.stringify(this.props.filters, null, '  ');
  }

  addSlicesToDashboard(sliceIds) {
    return this.props.actions.addSlicesToDashboard(this.props.dashboard.id, sliceIds);
  }

  fetchSlice(slice, force = false) {
    const sliceUrl = this.jsonEndpoint(this.getFormDataExtra(slice), force);
    return this.props.actions.fetchSlice(slice, sliceUrl, this.props.timeout);
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

  unload() {
    const message = t('You have unsaved changes.');
    window.event.returnValue = message; // Gecko + IE
    return message; // Gecko + Webkit, Safari, Chrome etc.
  }

  loadPreSelectFilters() {
    for (const sliceId in this.props.filters) {
      for (const col in this.props.filters[sliceId]) {
        this.props.actions.addFilter(sliceId, col,
          this.props.filters[sliceId][col], false, false);
      }
    }
  }

  refreshExcept(sliceId) {
    const immune = this.props.dashboard.metadata.filter_immune_slices || [];
    const slices = this.props.dashboard.slices
      .filter(slice => slice.slice_id !== sliceId && immune.indexOf(slice.slice_id) === -1);
    this.renderSlices(slices);
  }

  updateFilterParamsInUrl() {
    const urlObj = urlLib.parse(location.href, true);
    urlObj.query = urlObj.query || {};
    urlObj.query.preselect_filters = this.readFilters();
    urlObj.search = null;
    history.pushState(urlObj.query, window.title, urlLib.format(urlObj));
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
      const affectedSlices = this.props.dashboard.slices
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

  bindResizeToWindowResize() {
    let resizeTimer;
    const dash = this;
    const allSlices = this.props.dashboard.slices;
    $(window).on('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(dash.renderSlices(allSlices), 500);
    });
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

  renderSlices(slc, force = false, interval = 0) {
    const dash = this;
    const slices = slc || this.props.dashboard.slices;
    if (!interval) {
      slices.forEach(slice => (dash.fetchSlice(slice, false)));
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
      setTimeout(() => dash.fetchSlice(slice), delay * i);
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
            user_id={this.props.user_id}
            isStarred={this.props.isStarred}
            addSlicesToDashboard={this.addSlicesToDashboard.bind(this)}
            fetchFaveStar={this.props.actions.fetchFaveStar}
            onSave={this.onSave.bind(this)}
            onChange={this.onChange.bind(this)}
            readFilters={this.readFilters.bind(this)}
            renderSlices={this.renderSlices.bind(this)}
            saveFaveStar={this.props.actions.saveFaveStar}
            serialize={this.serialize.bind(this)}
            startPeriodicRender={this.startPeriodicRender.bind(this)}
            updateDashboardTitle={this.updateDashboardTitle.bind(this)}
          />
        </div>
        <div id="grid-container" className="slice-grid gridster">
          <GridLayout
            dashboard={this.props.dashboard}
            onChange={this.onChange.bind(this)}
            actions={this.props.actions}
            getFormDataExtra={this.getFormDataExtra.bind(this)}
            fetchSlice={this.fetchSlice.bind(this)}
          />
        </div>
      </div>
    );
  }
}

DashboardViewContainer.propTypes = propTypes;
DashboardViewContainer.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    initMessages: state.common.flash_messages,
    timeout: state.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
    dashboard: state.dashboard,
    datasources: state.datasources,
    filters: state.filters,
    refresh: state.refresh,
    user_id: state.user_id,
    isStarred: !!state.isStarred,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export { DashboardViewContainer };
export default connect(mapStateToProps, mapDispatchToProps)(DashboardViewContainer);
