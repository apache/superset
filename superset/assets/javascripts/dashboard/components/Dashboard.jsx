import React from 'react';
import PropTypes from 'prop-types';

import AlertsWrapper from '../../components/AlertsWrapper';
import GridLayout from './GridLayout';
import Header from './Header';
import DashboardAlert from './DashboardAlert';
import { t } from '../../locales';

import '../../../stylesheets/dashboard.css';

const propTypes = {
  initMessages: PropTypes.array,
  dashboard: PropTypes.object.isRequired,
  slices: PropTypes.object,
  datasources: PropTypes.object,
  filters: PropTypes.object,
  refresh: PropTypes.bool,
  timeout: PropTypes.number,
  user_id: PropTypes.string,
  isStarred: PropTypes.bool,
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
  refresh: false,
  timeout: 60,
  user_id: '',
  isStarred: false,
};

class Dashboard extends React.PureComponent {
  constructor(props) {
    super(props);

    // alert for unsaved changes
    this.state = {
      alert: null,
    };
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

  unload() {
    const message = t('You have unsaved changes.');
    window.event.returnValue = message; // Gecko + IE
    return message; // Gecko + Webkit, Safari, Chrome etc.
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
            updateDashboardTitle={this.updateDashboardTitle.bind(this)}
            onSave={this.onSave.bind(this)}
            onChange={this.onChange.bind(this)}
            serialize={this.serialize.bind(this)}
            readFilters={this.props.readFilters.bind(this)}
            fetchFaveStar={this.props.fetchFaveStar}
            saveFaveStar={this.props.saveFaveStar}
            renderSlices={this.props.renderSlices}
            startPeriodicRender={this.props.startPeriodicRender}
            addSlicesToDashboard={this.props.addSlicesToDashboard}
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
            getFormDataExtra={this.props.getFormDataExtra}
            fetchSlice={this.props.fetchSlice}
            saveSlice={this.props.saveSlice}
            removeSlice={this.props.removeSlice}
            removeChart={this.props.removeChart}
            updateDashboardLayout={this.props.updateDashboardLayout}
            toggleExpandSlice={this.props.toggleExpandSlice}
            addFilter={this.props.addFilter}
            clearFilter={this.props.clearFilter}
            removeFilter={this.props.removeFilter}
          />
        </div>
      </div>
    );
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
