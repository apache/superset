/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint camelcase: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { t } from '@superset-ui/translation';

import ExploreChartPanel from './ExploreChartPanel';
import ControlPanelsContainer from './ControlPanelsContainer';
import SaveModal from './SaveModal';
import QueryAndSaveBtns from './QueryAndSaveBtns';
import { getExploreUrl, getExploreLongUrl } from '../exploreUtils';
import { areObjectsEqual } from '../../reduxUtils';
import { getFormDataFromControls } from '../controlUtils';
import { chartPropShape } from '../../dashboard/util/propShapes';
import * as exploreActions from '../actions/exploreActions';
import * as saveModalActions from '../actions/saveModalActions';
import * as chartActions from '../../chart/chartAction';
import { fetchDatasourceMetadata } from '../../dashboard/actions/datasources';
import * as logActions from '../../logger/actions/';
import {
  LOG_ACTIONS_MOUNT_EXPLORER,
  LOG_ACTIONS_CHANGE_EXPLORE_CONTROLS,
} from '../../logger/LogUtils';
import Hotkeys from '../../components/Hotkeys';

// Prolly need to move this to a global context
const keymap = {
  RUN: 'ctrl + r, ctrl + enter',
  SAVE: 'ctrl + s',
};

const getHotKeys = () =>
  Object.keys(keymap).map(k => ({
    name: k,
    descr: keymap[k],
    key: k,
  }));

const propTypes = {
  actions: PropTypes.object.isRequired,
  datasource_type: PropTypes.string.isRequired,
  isDatasourceMetaLoading: PropTypes.bool.isRequired,
  chart: chartPropShape.isRequired,
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
    this.onStop = this.onStop.bind(this);
    this.onQuery = this.onQuery.bind(this);
    this.toggleModal = this.toggleModal.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
  }

  componentDidMount() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('popstate', this.handlePopstate);
    document.addEventListener('keydown', this.handleKeydown);
    this.addHistory({ isReplace: true });
    this.props.actions.logEvent(LOG_ACTIONS_MOUNT_EXPLORER);

    // Trigger the chart if there are no errors
    const { chart } = this.props;
    if (!this.hasErrors()) {
      this.props.actions.triggerQuery(true, this.props.chart.id);
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (
      nextProps.controls.viz_type.value !== this.props.controls.viz_type.value
    ) {
      this.props.actions.resetControls();
    }
    if (
      nextProps.controls.datasource &&
      (this.props.controls.datasource == null ||
        nextProps.controls.datasource.value !==
          this.props.controls.datasource.value)
    ) {
      fetchDatasourceMetadata(nextProps.form_data.datasource, true);
    }

    const changedControlKeys = this.findChangedControlKeys(
      this.props.controls,
      nextProps.controls,
    );
    if (this.hasDisplayControlChanged(changedControlKeys, nextProps.controls)) {
      this.props.actions.updateQueryFormData(
        getFormDataFromControls(nextProps.controls),
        this.props.chart.id,
      );
      this.props.actions.renderTriggered(
        new Date().getTime(),
        this.props.chart.id,
      );
    }
    if (this.hasQueryControlChanged(changedControlKeys, nextProps.controls)) {
      this.props.actions.logEvent(LOG_ACTIONS_CHANGE_EXPLORE_CONTROLS);
      this.setState({ chartIsStale: true, refreshOverlayVisible: true });
    }
  }

  /* eslint no-unused-vars: 0 */
  componentDidUpdate(prevProps, prevState) {
    const changedControlKeys = this.findChangedControlKeys(
      prevProps.controls,
      this.props.controls,
    );
    if (
      this.hasDisplayControlChanged(changedControlKeys, this.props.controls)
    ) {
      this.addHistory({});
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('popstate', this.handlePopstate);
    document.removeEventListener('keydown', this.handleKeydown);
  }

  onQuery() {
    // remove alerts when query
    this.props.actions.removeControlPanelAlert();
    this.props.actions.triggerQuery(true, this.props.chart.id);

    this.setState({ chartIsStale: false, refreshOverlayVisible: false });
    this.addHistory({});
  }

  onStop() {
    if (this.props.chart && this.props.chart.queryController) {
      this.props.chart.queryController.abort();
    }
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

  handleKeydown(event) {
    const controlOrCommand = event.ctrlKey || event.metaKey;
    if (controlOrCommand) {
      const isEnter = event.key === 'Enter' || event.keyCode === 13;
      const isS = event.key === 's' || event.keyCode === 83;
      if (isEnter) {
        this.onQuery();
      } else if (isS) {
        if (this.props.slice) {
          this.props.actions
            .saveSlice(this.props.form_data, {
              action: 'overwrite',
              slice_id: this.props.slice.slice_id,
              slice_name: this.props.slice.slice_name,
              add_to_dash: 'noSave',
              goto_dash: false,
            })
            .then(({ data }) => {
              window.location = data.slice.slice_url;
            });
        }
      }
    }
  }

  findChangedControlKeys(prevControls, currentControls) {
    return Object.keys(currentControls).filter(
      key =>
        typeof prevControls[key] !== 'undefined' &&
        !areObjectsEqual(currentControls[key].value, prevControls[key].value),
    );
  }

  hasDisplayControlChanged(changedControlKeys, currentControls) {
    return changedControlKeys.some(key => currentControls[key].renderTrigger);
  }

  hasQueryControlChanged(changedControlKeys, currentControls) {
    return changedControlKeys.some(
      key =>
        !currentControls[key].renderTrigger &&
        !currentControls[key].dontRefreshOnChange,
    );
  }

  addHistory({ isReplace = false, title }) {
    const payload = { ...this.props.form_data };
    const longUrl = getExploreLongUrl(this.props.form_data, null, false);
    try {
      if (isReplace) {
        history.replaceState(payload, title, longUrl);
      } else {
        history.pushState(payload, title, longUrl);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        'Failed at altering browser history',
        payload,
        title,
        longUrl,
      );
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
      this.props.actions.postChartFormData(
        formData,
        false,
        this.props.timeout,
        this.props.chart.id,
      );
    }
  }

  toggleModal() {
    this.setState({ showModal: !this.state.showModal });
  }
  hasErrors() {
    const ctrls = this.props.controls;
    return Object.keys(ctrls).some(
      k => ctrls[k].validationErrors && ctrls[k].validationErrors.length > 0,
    );
  }
  renderErrorMessage() {
    // Returns an error message as a node if any errors are in the store
    const errors = [];
    const ctrls = this.props.controls;
    for (const controlName in this.props.controls) {
      const control = this.props.controls[controlName];
      if (control.validationErrors && control.validationErrors.length > 0) {
        errors.push(
          <div key={controlName}>
            {t('Control labeled ')}
            <strong>{` "${control.label}" `}</strong>
            {control.validationErrors.join('. ')}
          </div>,
        );
      }
    }
    let errorMessage;
    if (errors.length > 0) {
      errorMessage = <div style={{ textAlign: 'left' }}>{errors}</div>;
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
        onQuery={this.onQuery}
      />
    );
  }

  render() {
    if (this.props.standalone) {
      return this.renderChartContainer();
    }
    return (
      <div
        id="explore-container"
        className="container-fluid"
        style={{ height: this.state.height, overflow: 'hidden' }}
      >
        {this.state.showModal && (
          <SaveModal
            onHide={this.toggleModal}
            actions={this.props.actions}
            form_data={this.props.form_data}
          />
        )}
        <div className="row">
          <div className="col-sm-4">
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <QueryAndSaveBtns
                canAdd="True"
                onQuery={this.onQuery}
                onSave={this.toggleModal}
                onStop={this.onStop}
                loading={this.props.chart.chartStatus === 'loading'}
                chartIsStale={this.state.chartIsStale}
                errorMessage={this.renderErrorMessage()}
                datasourceType={this.props.datasource_type}
              />
              <div className="m-l-5 text-muted">
                <Hotkeys
                  header="Keyboard shortcuts"
                  hotkeys={getHotKeys()}
                  placement="right"
                />
              </div>
            </div>
            <br />
            <ControlPanelsContainer
              actions={this.props.actions}
              form_data={this.props.form_data}
              controls={this.props.controls}
              datasource_type={this.props.datasource_type}
              isDatasourceMetaLoading={this.props.isDatasourceMetaLoading}
            />
          </div>
          <div className="col-sm-8">{this.renderChartContainer()}</div>
        </div>
      </div>
    );
  }
}

ExploreViewContainer.propTypes = propTypes;

function mapStateToProps(state) {
  const { explore, charts, impressionId } = state;
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
    column_formats: explore.datasource
      ? explore.datasource.column_formats
      : null,
    containerId: explore.slice
      ? `slice-container-${explore.slice.slice_id}`
      : 'slice-container',
    isStarred: explore.isStarred,
    slice: explore.slice,
    triggerRender: explore.triggerRender,
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
  const actions = {
    ...exploreActions,
    ...saveModalActions,
    ...chartActions,
    ...logActions,
  };
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ExploreViewContainer };
export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(ExploreViewContainer);
