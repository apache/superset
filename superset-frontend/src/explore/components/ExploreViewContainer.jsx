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
import { styled, logging, t, supersetTheme, css } from '@superset-ui/core';
import { Global } from '@emotion/core';
import { Tooltip } from 'src/common/components/Tooltip';
import Icon from 'src/components/Icon';
import ExploreChartPanel from './ExploreChartPanel';
import ConnectedControlPanelsContainer from './ControlPanelsContainer';
import SaveModal from './SaveModal';
import QueryAndSaveBtns from './QueryAndSaveBtns';
import DataSourcePanel from './DatasourcePanel';
import { getExploreLongUrl } from '../exploreUtils';
import { areObjectsEqual } from '../../reduxUtils';
import { getFormDataFromControls } from '../controlUtils';
import { chartPropShape } from '../../dashboard/util/propShapes';
import * as exploreActions from '../actions/exploreActions';
import * as saveModalActions from '../actions/saveModalActions';
import * as chartActions from '../../chart/chartAction';
import { fetchDatasourceMetadata } from '../../dashboard/actions/datasources';
import * as logActions from '../../logger/actions';
import {
  LOG_ACTIONS_MOUNT_EXPLORER,
  LOG_ACTIONS_CHANGE_EXPLORE_CONTROLS,
} from '../../logger/LogUtils';

const propTypes = {
  actions: PropTypes.object.isRequired,
  datasource_type: PropTypes.string.isRequired,
  dashboardId: PropTypes.number,
  isDatasourceMetaLoading: PropTypes.bool.isRequired,
  chart: chartPropShape.isRequired,
  slice: PropTypes.object,
  sliceName: PropTypes.string,
  controls: PropTypes.object.isRequired,
  forcedHeight: PropTypes.string,
  form_data: PropTypes.object.isRequired,
  standalone: PropTypes.bool.isRequired,
  timeout: PropTypes.number,
  impressionId: PropTypes.string,
};

const Styles = styled.div`
  background: ${({ theme }) => theme.colors.grayscale.light5};
  text-align: left;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  .explore-column {
    display: flex;
    flex-direction: column;
    padding: ${({ theme }) => 2 * theme.gridUnit}px 0;
    max-height: 100%;
  }
  .data-source-selection {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
    padding: ${({ theme }) => 2 * theme.gridUnit}px 0;
    border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
  .main-explore-content {
    border-left: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
  .controls-column {
    align-self: flex-start;
    padding: 0;
  }
  .title-container {
    position: relative;
    display: flex;
    flex-direction: row;
    padding: 0 ${({ theme }) => 2 * theme.gridUnit}px;
    justify-content: space-between;
    .horizontal-text {
      text-transform: uppercase;
      color: ${({ theme }) => theme.colors.grayscale.light1};
      font-size: ${({ theme }) => 4 * theme.typography.sizes.s};
    }
  }
  .no-show {
    display: none;
  }
  .vertical-text {
    writing-mode: vertical-rl;
    text-orientation: mixed;
  }
  .sidebar {
    height: 100%;
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
    padding: ${({ theme }) => 2 * theme.gridUnit}px;
    width: ${({ theme }) => 8 * theme.gridUnit}px;
  }
  .data-tab {
    min-width: 288px;
  }
  .callpase-icon > svg {
    color: ${({ theme }) => theme.colors.primary.base};
  }
`;

class ExploreViewContainer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      height: this.getHeight(),
      width: this.getWidth(),
      showModal: false,
      chartIsStale: false,
      refreshOverlayVisible: false,
      collapse: true,
    };

    this.addHistory = this.addHistory.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handlePopstate = this.handlePopstate.bind(this);
    this.onStop = this.onStop.bind(this);
    this.onQuery = this.onQuery.bind(this);
    this.toggleModal = this.toggleModal.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.toggleCollapse = this.toggleCollapse.bind(this);
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
      return `${this.props.forcedHeight}px`;
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
        window.history.replaceState(payload, title, longUrl);
      } else {
        window.history.pushState(payload, title, longUrl);
      }
    } catch (e) {
      logging.warn(
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

  toggleCollapse() {
    this.setState(prevState => ({ collapse: !prevState.collapse }));
  }

  handleResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.setState({ height: this.getHeight(), width: this.getWidth() });
    }, 250);
  }

  handlePopstate() {
    const formData = window.history.state;
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
    this.setState(prevState => ({ showModal: !prevState.showModal }));
  }

  hasErrors() {
    const ctrls = this.props.controls;
    return Object.keys(ctrls).some(
      k => ctrls[k].validationErrors && ctrls[k].validationErrors.length > 0,
    );
  }

  renderErrorMessage() {
    // Returns an error message as a node if any errors are in the store
    const errors = Object.entries(this.props.controls)
      .filter(
        ([, control]) =>
          control.validationErrors && control.validationErrors.length > 0,
      )
      .map(([key, control]) => (
        <div key={key}>
          {t('Control labeled ')}
          <strong>{` "${control.label}" `}</strong>
          {control.validationErrors.join('. ')}
        </div>
      ));
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
    const { collapse } = this.state;
    if (this.props.standalone) {
      return this.renderChartContainer();
    }
    return (
      <Styles id="explore-container">
        <Global
          styles={css`
            .navbar {
              margin-bottom: 0;
            }
            body {
              max-height: 100vh;
              overflow: hidden;
            }
            #app-menu,
            #app {
              flex: 1 1 auto;
            }
            #app {
              flex-basis: 100%;
              overflow: hidden;
            }
            #app-menu {
              flex-shrink: 0;
            }
          `}
        />
        {this.state.showModal && (
          <SaveModal
            onHide={this.toggleModal}
            actions={this.props.actions}
            form_data={this.props.form_data}
            sliceName={this.props.sliceName}
            dashboardId={this.props.dashboardId}
          />
        )}
        <div
          className={
            collapse
              ? 'no-show'
              : 'data-tab explore-column data-source-selection'
          }
        >
          <div className="title-container">
            <span className="horizontal-text">{t('Datasource')}</span>
            <span
              role="button"
              tabIndex={0}
              className="action-button"
              onClick={this.toggleCollapse}
            >
              <Icon
                name="expand"
                color={supersetTheme.colors.primary.base}
                className="collapse-icon"
                width={16}
              />
            </span>
          </div>
          <DataSourcePanel
            datasource={this.props.datasource}
            controls={this.props.controls}
            actions={this.props.actions}
          />
        </div>
        {collapse ? (
          <div
            className="sidebar"
            onClick={this.toggleCollapse}
            data-test="open-datasource-tab"
            role="button"
            tabIndex={0}
          >
            <span role="button" tabIndex={0} className="action-button">
              <Tooltip title={t('Open Datasource Tab')}>
                <Icon
                  name="collapse"
                  color={supersetTheme.colors.primary.base}
                  className="collapse-icon"
                  width={16}
                />
              </Tooltip>
            </span>
            <Icon name="dataset-physical" width={16} />
          </div>
        ) : null}
        <div className="col-sm-3 explore-column controls-column">
          <QueryAndSaveBtns
            canAdd={!!(this.props.can_add || this.props.can_overwrite)}
            onQuery={this.onQuery}
            onSave={this.toggleModal}
            onStop={this.onStop}
            loading={this.props.chart.chartStatus === 'loading'}
            chartIsStale={this.state.chartIsStale}
            errorMessage={this.renderErrorMessage()}
            datasourceType={this.props.datasource_type}
          />
          <ConnectedControlPanelsContainer
            actions={this.props.actions}
            form_data={this.props.form_data}
            controls={this.props.controls}
            datasource_type={this.props.datasource_type}
            isDatasourceMetaLoading={this.props.isDatasourceMetaLoading}
          />
        </div>
        <div
          className={`main-explore-content ${
            collapse ? 'col-sm-9' : 'col-sm-7'
          }`}
        >
          {this.renderChartContainer()}
        </div>
      </Styles>
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
    dashboardId: explore.form_data ? explore.form_data.dashboardId : undefined,
    controls: explore.controls,
    can_overwrite: !!explore.can_overwrite,
    can_add: !!explore.can_add,
    can_download: !!explore.can_download,
    column_formats: explore.datasource
      ? explore.datasource.column_formats
      : null,
    containerId: explore.slice
      ? `slice-container-${explore.slice.slice_id}`
      : 'slice-container',
    isStarred: explore.isStarred,
    slice: explore.slice,
    sliceName: explore.sliceName,
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

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(ExploreViewContainer);
