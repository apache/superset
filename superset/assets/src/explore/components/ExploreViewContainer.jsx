/* eslint camelcase: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import ExploreChartPanel from './ExploreChartPanel';
import ControlPanelsContainer from './ControlPanelsContainer';
import SaveModal from './SaveModal';
import QueryAndSaveBtns from './QueryAndSaveBtns';
import { getExploreUrlAndPayload, getExploreLongUrl } from '../exploreUtils';
import { areObjectsEqual } from '../../reduxUtils';
import { getFormDataFromControls } from '../store';
import { chartPropType } from '../../chart/chartReducer';
import * as exploreActions from '../actions/exploreActions';
import * as saveModalActions from '../actions/saveModalActions';
import * as chartActions from '../../chart/chartAction';
import { Logger, ActionLog, LOG_ACTIONS_PAGE_LOAD,
  LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT } from '../../logger';

const propTypes = {
  actions: PropTypes.object.isRequired,
  datasource_type: PropTypes.string.isRequired,
  isDatasourceMetaLoading: PropTypes.bool.isRequired,
  chart: PropTypes.shape(chartPropType).isRequired,
  slice: PropTypes.object,
  controls: PropTypes.object.isRequired,
  forcedHeight: PropTypes.string,
  form_data: PropTypes.object.isRequired,
  standalone: PropTypes.bool.isRequired,
  timeout: PropTypes.number,
  impressionId: PropTypes.string,
};

class ExploreViewContainer extends React.Component {
  constructor(props) {
    super(props);
    this.firstLoad = true;
    this.loadingLog = new ActionLog({
      impressionId: props.impressionId,
      actionType: LOG_ACTIONS_PAGE_LOAD,
      source: 'slice',
      sourceId: props.slice ? props.slice.slice_id : 0,
      eventNames: [LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT],
    });
    Logger.start(this.loadingLog);

    this.state = {
      height: this.getHeight(),
      width: this.getWidth(),
      showModal: false,
      chartIsStale: false,
      refreshOverlayVisible: false,
    };

    this.addHistory = this.addHistory.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handlePopstate = this.handlePopstate.bind(this);
  }

  componentDidMount() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('popstate', this.handlePopstate);
    this.addHistory({ isReplace: true });
  }

  componentWillReceiveProps(np) {
    if (this.firstLoad &&
      ['rendered', 'failed', 'stopped'].indexOf(np.chart.chartStatus) > -1) {
      Logger.end(this.loadingLog);
      this.firstLoad = false;
    }
    if (np.controls.viz_type.value !== this.props.controls.viz_type.value) {
      this.props.actions.resetControls();
      this.props.actions.triggerQuery(true, this.props.chart.chartKey);
    }
    if (np.controls.datasource.value !== this.props.controls.datasource.value) {
      this.props.actions.fetchDatasourceMetadata(np.form_data.datasource, true);
    }

    const changedControlKeys = this.findChangedControlKeys(this.props.controls, np.controls);
    if (this.hasDisplayControlChanged(changedControlKeys, np.controls)) {
      this.props.actions.updateQueryFormData(
        getFormDataFromControls(np.controls), this.props.chart.chartKey);
      this.props.actions.renderTriggered(new Date().getTime(), this.props.chart.chartKey);
    }
    if (this.hasQueryControlChanged(changedControlKeys, np.controls)) {
      this.setState({ chartIsStale: true, refreshOverlayVisible: true });
    }
  }

  /* eslint no-unused-vars: 0 */
  componentDidUpdate(prevProps, prevState) {
    this.triggerQueryIfNeeded();

    const changedControlKeys = this.findChangedControlKeys(prevProps.controls, this.props.controls);
    if (this.hasDisplayControlChanged(changedControlKeys, this.props.controls)) {
      this.addHistory({});
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('popstate', this.handlePopstate);
  }

  onQuery() {
    // remove alerts when query
    this.props.actions.removeControlPanelAlert();
    this.props.actions.triggerQuery(true, this.props.chart.chartKey);

    this.setState({ chartIsStale: false, refreshOverlayVisible: false });
    this.addHistory({});
  }

  onDismissRefreshOverlay() {
    this.setState({ refreshOverlayVisible: false });
  }

  onStop() {
    return this.props.chart.queryRequest.abort();
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

  findChangedControlKeys(prevControls, currentControls) {
    return Object.keys(currentControls).filter(key => (
      typeof prevControls[key] !== 'undefined' &&
      !areObjectsEqual(currentControls[key].value, prevControls[key].value)
    ));
  }

  hasDisplayControlChanged(changedControlKeys, currentControls) {
    return changedControlKeys.some(key => (currentControls[key].renderTrigger));
  }

  hasQueryControlChanged(changedControlKeys, currentControls) {
    return changedControlKeys.some(key => (
      !currentControls[key].renderTrigger && !currentControls[key].dontRefreshOnChange
    ));
  }

  triggerQueryIfNeeded() {
    if (this.props.chart.triggerQuery && !this.hasErrors()) {
      this.props.actions.runQuery(this.props.form_data, false,
        this.props.timeout, this.props.chart.chartKey);
    }
  }

  addHistory({ isReplace = false, title }) {
    const { payload } = getExploreUrlAndPayload({ formData: this.props.form_data });
    const longUrl = getExploreLongUrl(this.props.form_data);
    if (isReplace) {
      history.replaceState(
        payload,
        title,
        longUrl);
    } else {
      history.pushState(
        payload,
        title,
        longUrl);
    }

    // it seems some browsers don't support pushState title attribute
    if (title) {
      document.title = title;
    }
  }

  handleResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.setState({ height: this.getHeight(), width: this.getWidth() });
    }, 250);
  }

  handlePopstate() {
    const formData = history.state;
    if (formData && Object.keys(formData).length) {
      this.props.actions.setExploreControls(formData);
      this.props.actions.runQuery(
        formData,
        false,
        this.props.timeout,
        this.props.chart.chartKey,
      );
    }
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
        errorMessage={this.renderErrorMessage()}
        refreshOverlayVisible={this.state.refreshOverlayVisible}
        addHistory={this.addHistory}
        onQuery={this.onQuery.bind(this)}
        onDismissRefreshOverlay={this.onDismissRefreshOverlay.bind(this)}
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
              chartIsStale={this.state.chartIsStale}
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

function mapStateToProps({ explore, charts, impressionId }) {
  const form_data = getFormDataFromControls(explore.controls);
  // fill in additional params stored in form_data but not used by control
  Object.keys(explore.rawFormData)
    .forEach((key) => {
      if (form_data[key] === undefined) {
        form_data[key] = explore.rawFormData[key];
      }
    });
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
    impressionId,
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
