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
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { styled, t, supersetTheme, css } from '@superset-ui/core';
import { debounce } from 'lodash';
import { Resizable } from 're-resizable';

import { useDynamicPluginContext } from 'src/components/DynamicPlugins';
import { Global } from '@emotion/core';
import { Tooltip } from 'src/common/components/Tooltip';
import { usePrevious } from 'src/common/hooks/usePrevious';
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
  ...ExploreChartPanel.propTypes,
  height: PropTypes.string,
  width: PropTypes.string,
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
  vizType: PropTypes.string,
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
    flex: 1;
    min-width: ${({ theme }) => theme.gridUnit * 128}px;
    border-left: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    .panel {
      margin-bottom: 0;
    }
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
  .callpase-icon > svg {
    color: ${({ theme }) => theme.colors.primary.base};
  }
`;

const getWindowSize = () => ({
  height: window.innerHeight,
  width: window.innerWidth,
});

function useWindowSize({ delayMs = 250 } = {}) {
  const [size, setSize] = useState(getWindowSize());

  useEffect(() => {
    const onWindowResize = debounce(() => setSize(getWindowSize()), delayMs);
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, []);

  return size;
}

function ExploreViewContainer(props) {
  const dynamicPluginContext = useDynamicPluginContext();
  const dynamicPlugin = dynamicPluginContext.plugins[props.vizType];
  const isDynamicPluginLoading = dynamicPlugin && dynamicPlugin.loading;
  const wasDynamicPluginLoading = usePrevious(isDynamicPluginLoading);

  const previousControls = usePrevious(props.controls);
  const windowSize = useWindowSize();

  const [showingModal, setShowingModal] = useState(false);
  const [chartIsStale, setChartIsStale] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const width = `${windowSize.width}px`;
  const navHeight = props.standalone ? 0 : 90;
  const height = props.forcedHeight
    ? `${props.forcedHeight}px`
    : `${windowSize.height - navHeight}px`;

  const storageKeys = {
    controlsWidth: 'controls_width',
    dataSourceWidth: 'datasource_width',
  };

  const defaultSidebarsWidth = {
    controls_width: 320,
    datasource_width: 300,
  };

  function addHistory({ isReplace = false, title } = {}) {
    const payload = { ...props.form_data };
    const longUrl = getExploreLongUrl(
      props.form_data,
      props.standalone ? 'standalone' : null,
      false,
    );
    try {
      if (isReplace) {
        window.history.replaceState(payload, title, longUrl);
      } else {
        window.history.pushState(payload, title, longUrl);
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
  }

  function handlePopstate() {
    const formData = window.history.state;
    if (formData && Object.keys(formData).length) {
      props.actions.setExploreControls(formData);
      props.actions.postChartFormData(
        formData,
        false,
        props.timeout,
        props.chart.id,
      );
    }
  }

  function onQuery() {
    // remove alerts when query
    props.actions.removeControlPanelAlert();
    props.actions.triggerQuery(true, props.chart.id);

    setChartIsStale(false);
    addHistory();
  }

  function handleKeydown(event) {
    const controlOrCommand = event.ctrlKey || event.metaKey;
    if (controlOrCommand) {
      const isEnter = event.key === 'Enter' || event.keyCode === 13;
      const isS = event.key === 's' || event.keyCode === 83;
      if (isEnter) {
        onQuery();
      } else if (isS) {
        if (props.slice) {
          props.actions
            .saveSlice(props.form_data, {
              action: 'overwrite',
              slice_id: props.slice.slice_id,
              slice_name: props.slice.slice_name,
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

  function onStop() {
    if (props.chart && props.chart.queryController) {
      props.chart.queryController.abort();
    }
  }

  function toggleModal() {
    setShowingModal(!showingModal);
  }

  function toggleCollapse() {
    setIsCollapsed(!isCollapsed);
  }

  // effect to run on mount
  useEffect(() => {
    props.actions.logEvent(LOG_ACTIONS_MOUNT_EXPLORER);
    addHistory({ isReplace: true });
    window.addEventListener('popstate', handlePopstate);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('popstate', handlePopstate);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  useEffect(() => {
    if (wasDynamicPluginLoading && !isDynamicPluginLoading) {
      // reload the controls now that we actually have the control config
      props.actions.dynamicPluginControlsReady();
    }
  }, [isDynamicPluginLoading]);

  useEffect(() => {
    const hasError = Object.values(props.controls).some(
      control =>
        control.validationErrors && control.validationErrors.length > 0,
    );
    if (!hasError) {
      props.actions.triggerQuery(true, props.chart.id);
    }
  }, []);

  // effect to run when controls change
  useEffect(() => {
    if (previousControls) {
      if (props.controls.viz_type.value !== previousControls.viz_type.value) {
        props.actions.resetControls();
      }
      if (
        props.controls.datasource &&
        (previousControls.datasource == null ||
          props.controls.datasource.value !== previousControls.datasource.value)
      ) {
        // this should really be handled by actions
        fetchDatasourceMetadata(props.form_data.datasource, true);
      }

      const changedControlKeys = Object.keys(props.controls).filter(
        key =>
          typeof previousControls[key] !== 'undefined' &&
          !areObjectsEqual(
            props.controls[key].value,
            previousControls[key].value,
          ),
      );

      // this should also be handled by the actions that are actually changing the controls
      const hasDisplayControlChanged = changedControlKeys.some(
        key => props.controls[key].renderTrigger,
      );
      if (hasDisplayControlChanged) {
        props.actions.updateQueryFormData(
          getFormDataFromControls(props.controls),
          props.chart.id,
        );
        props.actions.renderTriggered(new Date().getTime(), props.chart.id);
        addHistory();
      }

      // this should be handled inside actions too
      const hasQueryControlChanged = changedControlKeys.some(
        key =>
          !props.controls[key].renderTrigger &&
          !props.controls[key].dontRefreshOnChange,
      );
      if (hasQueryControlChanged) {
        props.actions.logEvent(LOG_ACTIONS_CHANGE_EXPLORE_CONTROLS);
        setChartIsStale(true);
      }
    }
  }, [props.controls]);

  function renderErrorMessage() {
    // Returns an error message as a node if any errors are in the store
    const errors = Object.entries(props.controls)
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

  function renderChartContainer() {
    return (
      <ExploreChartPanel
        width={width}
        height={height}
        {...props}
        errorMessage={renderErrorMessage()}
        refreshOverlayVisible={chartIsStale}
        addHistory={addHistory}
        onQuery={onQuery}
      />
    );
  }

  function getSidebarWidths(key) {
    try {
      return localStorage.getItem(key) || defaultSidebarsWidth[key];
    } catch {
      return defaultSidebarsWidth[key];
    }
  }

  function setSidebarWidths(key, dimension) {
    try {
      const newDimension = Number(getSidebarWidths(key)) + dimension.width;
      localStorage.setItem(key, newDimension);
    } catch {
      // Catch in case localStorage is unavailable
    }
  }

  if (props.standalone) {
    return renderChartContainer();
  }

  return (
    <Styles id="explore-container" height={height}>
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
            height: 100vh;
          }
          #app-menu {
            flex-shrink: 0;
          }
        `}
      />
      {showingModal && (
        <SaveModal
          onHide={toggleModal}
          actions={props.actions}
          form_data={props.form_data}
          sliceName={props.sliceName}
          dashboardId={props.dashboardId}
        />
      )}
      <Resizable
        onResizeStop={(evt, direction, ref, d) =>
          setSidebarWidths(storageKeys.dataSourceWidth, d)
        }
        defaultSize={{
          width: getSidebarWidths(storageKeys.dataSourceWidth),
          height: '100%',
        }}
        minWidth={defaultSidebarsWidth[storageKeys.dataSourceWidth]}
        maxWidth="33%"
        enable={{ right: true }}
        className={
          isCollapsed ? 'no-show' : 'explore-column data-source-selection'
        }
      >
        <div className="title-container">
          <span className="horizont al-text">{t('Dataset')}</span>
          <span
            role="button"
            tabIndex={0}
            className="action-button"
            onClick={toggleCollapse}
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
          datasource={props.datasource}
          controls={props.controls}
          actions={props.actions}
        />
      </Resizable>
      {isCollapsed ? (
        <div
          className="sidebar"
          onClick={toggleCollapse}
          data-test="open-datasource-tab"
          role="button"
          tabIndex={0}
        >
          <span role="button" tabIndex={0} className="action-button">
            <Tooltip title={t('Open Datasource tab')}>
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
      <Resizable
        onResizeStop={(evt, direction, ref, d) =>
          setSidebarWidths(storageKeys.controlsWidth, d)
        }
        defaultSize={{
          width: getSidebarWidths(storageKeys.controlsWidth),
          height: '100%',
        }}
        minWidth={defaultSidebarsWidth[storageKeys.controlsWidth]}
        maxWidth="33%"
        enable={{ right: true }}
        className="col-sm-3 explore-column controls-column"
      >
        <QueryAndSaveBtns
          canAdd={!!(props.can_add || props.can_overwrite)}
          onQuery={onQuery}
          onSave={toggleModal}
          onStop={onStop}
          loading={props.chart.chartStatus === 'loading'}
          chartIsStale={chartIsStale}
          errorMessage={renderErrorMessage()}
          datasourceType={props.datasource_type}
        />
        <ConnectedControlPanelsContainer
          actions={props.actions}
          form_data={props.form_data}
          controls={props.controls}
          datasource_type={props.datasource_type}
          isDatasourceMetaLoading={props.isDatasourceMetaLoading}
        />
      </Resizable>
      <div
        className={`main-explore-content ${
          isCollapsed ? 'col-sm-9' : 'col-sm-7'
        }`}
      >
        {renderChartContainer()}
      </div>
    </Styles>
  );
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
