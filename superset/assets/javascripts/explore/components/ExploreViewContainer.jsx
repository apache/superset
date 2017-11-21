/* eslint camelcase: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import ExploreChartPanel from './ExploreChartPanel';
import ControlPanelsContainer from './ControlPanelsContainer';
import SaveModal from './SaveModal';
import QueryAndSaveBtns from './QueryAndSaveBtns';
import { getExploreUrl } from '../exploreUtils';
import { areObjectsEqual } from '../../reduxUtils';
import { getFormDataFromControls } from '../stores/store';
import { chartPropType } from '../../chart/chartReducer';
import * as exploreActions from '../actions/exploreActions';
import * as saveModalActions from '../actions/saveModalActions';
import * as chartActions from '../../chart/chartAction';

const propTypes = {
  actions: PropTypes.object.isRequired,
  datasource_type: PropTypes.string.isRequired,
  isDatasourceMetaLoading: PropTypes.bool.isRequired,
  chartStatus: PropTypes.string,
  chart: PropTypes.shape(chartPropType).isRequired,
  controls: PropTypes.object.isRequired,
  forcedHeight: PropTypes.string,
  form_data: PropTypes.object.isRequired,
  standalone: PropTypes.bool.isRequired,
  timeout: PropTypes.number,
};

class ExploreViewContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      height: this.getHeight(),
      width: this.getWidth(),
      showModal: false,
    };
  }

  componentDidMount() {
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  componentWillReceiveProps(np) {
    if (np.controls.viz_type.value !== this.props.controls.viz_type.value) {
      this.props.actions.resetControls();
      this.props.actions.triggerQuery(true, this.props.chart.chartKey);
    }
    if (np.controls.datasource.value !== this.props.controls.datasource.value) {
      this.props.actions.fetchDatasourceMetadata(np.form_data.datasource, true);
    }
    // if any control value changed and it's an instant control
    if (Object.keys(np.controls).some(key => (np.controls[key].renderTrigger &&
      typeof this.props.controls[key] !== 'undefined' &&
      !areObjectsEqual(np.controls[key].value, this.props.controls[key].value)))) {
      this.props.actions.renderTriggered(new Date().getTime(), this.props.chart.chartKey);
    }
  }

  componentDidUpdate() {
    this.triggerQueryIfNeeded();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  onQuery() {
    // remove alerts when query
    this.props.actions.removeControlPanelAlert();
    this.props.actions.triggerQuery(true, this.props.chart.chartKey);

    history.pushState(
      {},
      document.title,
      getExploreUrl(this.props.form_data));
  }

  onStop() {
    this.props.actions.chartUpdateStopped(this.props.chart.queryRequest);
  }

  getWidth() {
    return `${window.innerWidth}px`;
  }

  getHeight() {
    if (this.props.forcedHeight) {
      return this.props.forcedHeight + 'px';
    }
    const navHeight = this.props.standalone ? 0 : 90;
    return `${window.innerHeight - navHeight}px`;
  }

  triggerQueryIfNeeded() {
    if (this.props.chart.triggerQuery && !this.hasErrors()) {
      this.props.actions.runQuery(this.props.form_data, false,
        this.props.timeout, this.props.chart.chartKey);
    }
  }

  handleResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.setState({ height: this.getHeight(), width: this.getWidth() });
    }, 250);
  }

  toggleModal() {
    this.setState({ showModal: !this.state.showModal });
  }
  hasErrors() {
    const ctrls = this.props.controls;
    return Object.keys(ctrls).some(
      k => ctrls[k].validationErrors && ctrls[k].validationErrors.length > 0);
  }
  renderErrorMessage() {
    // Returns an error message as a node if any errors are in the store
    const errors = [];
    for (const controlName in this.props.controls) {
      const control = this.props.controls[controlName];
      if (control.validationErrors && control.validationErrors.length > 0) {
        errors.push(
          <div key={controlName}>
            <strong>{`[ ${control.label} ] `}</strong>
            {control.validationErrors.join('. ')}
          </div>,
        );
      }
    }
    let errorMessage;
    if (errors.length > 0) {
      errorMessage = (
        <div style={{ textAlign: 'left' }}>{errors}</div>
      );
    }
    return errorMessage;
  }
  renderChartContainer() {
    return (
      <ExploreChartPanel
        width={this.state.width}
        height={this.state.height}
        {...this.props}
      />);
  }

  render() {
    if (this.props.standalone) {
      return this.renderChartContainer();
    }
    return (
      <div
        id="explore-container"
        className="container-fluid"
        style={{
          height: this.state.height,
          overflow: 'hidden',
        }}
      >
        {this.state.showModal &&
        <SaveModal
          onHide={this.toggleModal.bind(this)}
          actions={this.props.actions}
          form_data={this.props.form_data}
        />
      }
        <div className="row">
          <div className="col-sm-4">
            <QueryAndSaveBtns
              canAdd="True"
              onQuery={this.onQuery.bind(this)}
              onSave={this.toggleModal.bind(this)}
              onStop={this.onStop.bind(this)}
              loading={this.props.chart.chartStatus === 'loading'}
              errorMessage={this.renderErrorMessage()}
            />
            <br />
            <ControlPanelsContainer
              actions={this.props.actions}
              form_data={this.props.form_data}
              controls={this.props.controls}
              datasource_type={this.props.datasource_type}
              isDatasourceMetaLoading={this.props.isDatasourceMetaLoading}
            />
          </div>
          <div className="col-sm-8">
            {this.renderChartContainer()}
          </div>
        </div>
      </div>
    );
  }
}

ExploreViewContainer.propTypes = propTypes;

function mapStateToProps({ explore, charts }) {
  const form_data = getFormDataFromControls(explore.controls);
  const chartKey = Object.keys(charts)[0];
  const chart = charts[chartKey];
  return {
    isDatasourceMetaLoading: explore.isDatasourceMetaLoading,
    datasource: explore.datasource,
    datasource_type: explore.datasource.type,
    datasourceId: explore.datasource_id,
    controls: explore.controls,
    can_overwrite: !!explore.can_overwrite,
    can_download: !!explore.can_download,
    column_formats: explore.datasource ? explore.datasource.column_formats : null,
    containerId: explore.slice ? `slice-container-${explore.slice.slice_id}` : 'slice-container',
    isStarred: explore.isStarred,
    slice: explore.slice,
    form_data,
    table_name: form_data.datasource_name,
    vizType: form_data.viz_type,
    standalone: explore.standalone,
    forcedHeight: explore.forced_height,
    chart,
    timeout: explore.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
  };
}

function mapDispatchToProps(dispatch) {
  const actions = Object.assign({}, exploreActions, saveModalActions, chartActions);
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ExploreViewContainer };
export default connect(mapStateToProps, mapDispatchToProps)(ExploreViewContainer);
