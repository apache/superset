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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { styled, t, css, useTheme, logging } from '@superset-ui/core';
import { debounce, pick } from 'lodash';
import { Resizable } from 're-resizable';
import { useChangeEffect } from 'src/hooks/useChangeEffect';
import { usePluginContext } from 'src/components/DynamicPlugins';
import { Global } from '@emotion/react';
import { Tooltip } from 'src/components/Tooltip';
import { usePrevious } from 'src/hooks/usePrevious';
import { useComponentDidMount } from 'src/hooks/useComponentDidMount';
import Icons from 'src/components/Icons';
import {
  getItem,
  setItem,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';
import { RESERVED_CHART_URL_PARAMS, URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import cx from 'classnames';
import * as chartActions from 'src/components/Chart/chartAction';
import { fetchDatasourceMetadata } from 'src/dashboard/actions/datasources';
import { chartPropShape } from 'src/dashboard/util/propShapes';
import { mergeExtraFormData } from 'src/dashboard/components/nativeFilters/utils';
import { postFormData, putFormData } from 'src/explore/exploreUtils/formData';
import { useTabId } from 'src/hooks/useTabId';
import ExploreChartPanel from '../ExploreChartPanel';
import ConnectedControlPanelsContainer from '../ControlPanelsContainer';
import SaveModal from '../SaveModal';
import DataSourcePanel from '../DatasourcePanel';
import { mountExploreUrl } from '../../exploreUtils';
import { areObjectsEqual } from '../../../reduxUtils';
import { getFormDataFromControls } from '../../controlUtils';
import * as exploreActions from '../../actions/exploreActions';
import * as saveModalActions from '../../actions/saveModalActions';
import * as logActions from '../../../logger/actions';
import {
  LOG_ACTIONS_MOUNT_EXPLORER,
  LOG_ACTIONS_CHANGE_EXPLORE_CONTROLS,
} from '../../../logger/LogUtils';
import ConnectedExploreChartHeader from '../ExploreChartHeader';

const propTypes = {
  ...ExploreChartPanel.propTypes,
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
  standalone: PropTypes.number.isRequired,
  force: PropTypes.bool,
  timeout: PropTypes.number,
  impressionId: PropTypes.string,
  vizType: PropTypes.string,
};

const ExploreContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const ExploreHeaderContainer = styled.div`
  ${({ theme }) => css`
    background-color: ${theme.colors.grayscale.light5};
    height: ${theme.gridUnit * 16}px;
    padding: 0 ${theme.gridUnit * 4}px;

    .editable-title {
      overflow: hidden;

      & > input[type='button'],
      & > span {
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        white-space: nowrap;
      }
    }
  `}
`;

const ExplorePanelContainer = styled.div`
  ${({ theme }) => css`
    background: ${theme.colors.grayscale.light5};
    text-align: left;
    position: relative;
    width: 100%;
    max-height: 100%;
    min-height: 0;
    display: flex;
    flex: 1;
    flex-wrap: nowrap;
    border-top: 1px solid ${theme.colors.grayscale.light2};
    .explore-column {
      display: flex;
      flex-direction: column;
      padding: ${theme.gridUnit * 2}px 0;
      max-height: 100%;
    }
    .data-source-selection {
      background-color: ${theme.colors.grayscale.light5};
      padding: ${theme.gridUnit * 2}px 0;
      border-right: 1px solid ${theme.colors.grayscale.light2};
    }
    .main-explore-content {
      flex: 1;
      min-width: ${theme.gridUnit * 128}px;
      border-left: 1px solid ${theme.colors.grayscale.light2};
      padding: 0 ${theme.gridUnit * 4}px;
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
      padding: 0 ${theme.gridUnit * 4}px;
      justify-content: space-between;
      .horizontal-text {
        font-size: ${theme.typography.sizes.s}px;
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
      background-color: ${theme.colors.grayscale.light4};
      padding: ${theme.gridUnit * 2}px;
      width: ${theme.gridUnit * 8}px;
    }
    .callpase-icon > svg {
      color: ${theme.colors.primary.base};
    }
  `};
`;

const updateHistory = debounce(
  async (formData, datasetId, isReplace, standalone, force, title, tabId) => {
    const payload = { ...formData };
    const chartId = formData.slice_id;
    const additionalParam = {};
    if (chartId) {
      additionalParam[URL_PARAMS.sliceId.name] = chartId;
    } else {
      additionalParam[URL_PARAMS.datasetId.name] = datasetId;
    }

    const urlParams = payload?.url_params || {};
    Object.entries(urlParams).forEach(([key, value]) => {
      if (!RESERVED_CHART_URL_PARAMS.includes(key)) {
        additionalParam[key] = value;
      }
    });

    try {
      let key;
      let stateModifier;
      if (isReplace) {
        key = await postFormData(datasetId, formData, chartId, tabId);
        stateModifier = 'replaceState';
      } else {
        key = getUrlParam(URL_PARAMS.formDataKey);
        await putFormData(datasetId, key, formData, chartId, tabId);
        stateModifier = 'pushState';
      }
      const url = mountExploreUrl(
        standalone ? URL_PARAMS.standalone.name : null,
        {
          [URL_PARAMS.formDataKey.name]: key,
          ...additionalParam,
        },
        force,
      );
      window.history[stateModifier](payload, title, url);
    } catch (e) {
      logging.warn('Failed at altering browser history', e);
    }
  },
  1000,
);

function ExploreViewContainer(props) {
  const dynamicPluginContext = usePluginContext();
  const dynamicPlugin = dynamicPluginContext.dynamicPlugins[props.vizType];
  const isDynamicPluginLoading = dynamicPlugin && dynamicPlugin.mounting;
  const wasDynamicPluginLoading = usePrevious(isDynamicPluginLoading);

  /** the state of controls in the previous render */
  const previousControls = usePrevious(props.controls);
  /** the state of controls last time a query was triggered */
  const [lastQueriedControls, setLastQueriedControls] = useState(
    props.controls,
  );

  const [showingModal, setShowingModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [shouldForceUpdate, setShouldForceUpdate] = useState(-1);
  const tabId = useTabId();

  const theme = useTheme();

  const defaultSidebarsWidth = {
    controls_width: 320,
    datasource_width: 300,
  };

  const addHistory = useCallback(
    async ({ isReplace = false, title } = {}) => {
      const formData = props.dashboardId
        ? {
            ...props.form_data,
            dashboardId: props.dashboardId,
          }
        : props.form_data;
      const datasetId = props.datasource.id;

      updateHistory(
        formData,
        datasetId,
        isReplace,
        props.standalone,
        props.force,
        title,
        tabId,
      );
    },
    [
      props.dashboardId,
      props.form_data,
      props.datasource.id,
      props.standalone,
      props.force,
      tabId,
    ],
  );

  const handlePopstate = useCallback(() => {
    const formData = window.history.state;
    if (formData && Object.keys(formData).length) {
      props.actions.setExploreControls(formData);
      props.actions.postChartFormData(
        formData,
        props.force,
        props.timeout,
        props.chart.id,
      );
    }
  }, [props.actions, props.chart.id, props.timeout]);

  const onQuery = useCallback(() => {
    props.actions.setForceQuery(false);
    props.actions.triggerQuery(true, props.chart.id);
    addHistory();
    setLastQueriedControls(props.controls);
  }, [props.controls, addHistory, props.actions, props.chart.id]);

  const handleKeydown = useCallback(
    event => {
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
    },
    [onQuery, props.actions, props.form_data, props.slice],
  );

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

  useComponentDidMount(() => {
    props.actions.logEvent(LOG_ACTIONS_MOUNT_EXPLORER);
  });

  useChangeEffect(tabId, (previous, current) => {
    if (current) {
      addHistory({ isReplace: true });
    }
  });

  const previousHandlePopstate = usePrevious(handlePopstate);
  useEffect(() => {
    if (previousHandlePopstate) {
      window.removeEventListener('popstate', previousHandlePopstate);
    }
    window.addEventListener('popstate', handlePopstate);
    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [handlePopstate, previousHandlePopstate]);

  const previousHandleKeyDown = usePrevious(handleKeydown);
  useEffect(() => {
    if (previousHandleKeyDown) {
      window.removeEventListener('keydown', previousHandleKeyDown);
    }
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [handleKeydown, previousHandleKeyDown]);

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

  const reRenderChart = useCallback(
    controlsChanged => {
      const newQueryFormData = controlsChanged
        ? {
            ...props.chart.latestQueryFormData,
            ...getFormDataFromControls(pick(props.controls, controlsChanged)),
          }
        : getFormDataFromControls(props.controls);
      props.actions.updateQueryFormData(newQueryFormData, props.chart.id);
      props.actions.renderTriggered(new Date().getTime(), props.chart.id);
      addHistory();
    },
    [
      addHistory,
      props.actions,
      props.chart.id,
      props.chart.latestQueryFormData,
      props.controls,
    ],
  );

  // effect to run when controls change
  useEffect(() => {
    if (
      previousControls &&
      props.chart.latestQueryFormData.viz_type === props.controls.viz_type.value
    ) {
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
      const displayControlsChanged = changedControlKeys.filter(
        key => props.controls[key].renderTrigger,
      );
      if (displayControlsChanged.length > 0) {
        reRenderChart(displayControlsChanged);
      }
    }
  }, [props.controls, props.ownState]);

  const chartIsStale = useMemo(() => {
    if (lastQueriedControls) {
      const changedControlKeys = Object.keys(props.controls).filter(
        key =>
          typeof lastQueriedControls[key] !== 'undefined' &&
          !areObjectsEqual(
            props.controls[key].value,
            lastQueriedControls[key].value,
          ),
      );

      return changedControlKeys.some(
        key =>
          !props.controls[key].renderTrigger &&
          !props.controls[key].dontRefreshOnChange,
      );
    }
    return false;
  }, [lastQueriedControls, props.controls]);

  useEffect(() => {
    if (props.ownState !== undefined) {
      onQuery();
      reRenderChart();
    }
  }, [props.ownState]);

  if (chartIsStale) {
    props.actions.logEvent(LOG_ACTIONS_CHANGE_EXPLORE_CONTROLS);
  }

  const errorMessage = useMemo(() => {
    const controlsWithErrors = Object.values(props.controls).filter(
      control =>
        control.validationErrors && control.validationErrors.length > 0,
    );
    if (controlsWithErrors.length === 0) {
      return null;
    }

    const errorMessages = controlsWithErrors.map(
      control => control.validationErrors,
    );
    const uniqueErrorMessages = [...new Set(errorMessages.flat())];

    const errors = uniqueErrorMessages
      .map(message => {
        const matchingLabels = controlsWithErrors
          .filter(control => control.validationErrors?.includes(message))
          .map(control => control.label);
        return [matchingLabels, message];
      })
      .map(([labels, message]) => (
        <div key={message}>
          {labels.length > 1 ? t('Controls labeled ') : t('Control labeled ')}
          <strong>{` ${labels.join(', ')}`}</strong>
          <span>: {message}</span>
        </div>
      ));

    let errorMessage;
    if (errors.length > 0) {
      errorMessage = <div style={{ textAlign: 'left' }}>{errors}</div>;
    }
    return errorMessage;
  }, [props.controls]);

  function renderChartContainer() {
    return (
      <ExploreChartPanel
        {...props}
        errorMessage={errorMessage}
        chartIsStale={chartIsStale}
        onQuery={onQuery}
      />
    );
  }

  function getSidebarWidths(key) {
    return getItem(key, defaultSidebarsWidth[key]);
  }

  function setSidebarWidths(key, dimension) {
    const newDimension = Number(getSidebarWidths(key)) + dimension.width;
    setItem(key, newDimension);
  }

  if (props.standalone) {
    return renderChartContainer();
  }

  return (
    <ExploreContainer>
      <ExploreHeaderContainer>
        <ConnectedExploreChartHeader
          actions={props.actions}
          canOverwrite={props.can_overwrite}
          canDownload={props.can_download}
          dashboardId={props.dashboardId}
          isStarred={props.isStarred}
          slice={props.slice}
          sliceName={props.sliceName}
          table_name={props.table_name}
          formData={props.form_data}
          chart={props.chart}
          user={props.user}
          reports={props.reports}
          onSaveChart={toggleModal}
          saveDisabled={errorMessage || props.chart.chartStatus === 'loading'}
        />
      </ExploreHeaderContainer>
      <ExplorePanelContainer id="explore-container">
        <Global
          styles={css`
            .navbar {
              margin-bottom: 0;
            }
            body {
              height: 100vh;
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
              height: 100%;
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
          onResizeStop={(evt, direction, ref, d) => {
            setShouldForceUpdate(d?.width);
            setSidebarWidths(LocalStorageKeys.datasource_width, d);
          }}
          defaultSize={{
            width: getSidebarWidths(LocalStorageKeys.datasource_width),
            height: '100%',
          }}
          minWidth={defaultSidebarsWidth[LocalStorageKeys.datasource_width]}
          maxWidth="33%"
          enable={{ right: true }}
          className={
            isCollapsed ? 'no-show' : 'explore-column data-source-selection'
          }
        >
          <div className="title-container">
            <span className="horizontal-text">{t('Dataset')}</span>
            <span
              role="button"
              tabIndex={0}
              className="action-button"
              onClick={toggleCollapse}
            >
              <Icons.Expand
                className="collapse-icon"
                iconColor={theme.colors.primary.base}
                iconSize="l"
              />
            </span>
          </div>
          <DataSourcePanel
            datasource={props.datasource}
            controls={props.controls}
            actions={props.actions}
            shouldForceUpdate={shouldForceUpdate}
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
                <Icons.Collapse
                  className="collapse-icon"
                  iconColor={theme.colors.primary.base}
                  iconSize="l"
                />
              </Tooltip>
            </span>
            <Icons.DatasetPhysical
              css={{ marginTop: theme.gridUnit * 2 }}
              iconSize="l"
              iconColor={theme.colors.grayscale.base}
            />
          </div>
        ) : null}
        <Resizable
          onResizeStop={(evt, direction, ref, d) =>
            setSidebarWidths(LocalStorageKeys.controls_width, d)
          }
          defaultSize={{
            width: getSidebarWidths(LocalStorageKeys.controls_width),
            height: '100%',
          }}
          minWidth={defaultSidebarsWidth[LocalStorageKeys.controls_width]}
          maxWidth="33%"
          enable={{ right: true }}
          className="col-sm-3 explore-column controls-column"
        >
          <ConnectedControlPanelsContainer
            exploreState={props.exploreState}
            actions={props.actions}
            form_data={props.form_data}
            controls={props.controls}
            chart={props.chart}
            datasource_type={props.datasource_type}
            isDatasourceMetaLoading={props.isDatasourceMetaLoading}
            onQuery={onQuery}
            onStop={onStop}
            canStopQuery={props.can_add || props.can_overwrite}
            errorMessage={errorMessage}
            chartIsStale={chartIsStale}
          />
        </Resizable>
        <div
          className={cx(
            'main-explore-content',
            isCollapsed ? 'col-sm-9' : 'col-sm-7',
          )}
        >
          {renderChartContainer()}
        </div>
      </ExplorePanelContainer>
    </ExploreContainer>
  );
}

ExploreViewContainer.propTypes = propTypes;

function mapStateToProps(state) {
  const { explore, charts, impressionId, dataMask, reports } = state;
  const form_data = getFormDataFromControls(explore.controls);
  form_data.extra_form_data = mergeExtraFormData(
    { ...form_data.extra_form_data },
    {
      ...dataMask[form_data.slice_id ?? 0]?.ownState, // 0 - unsaved chart
    },
  );
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
    force: explore.force,
    forcedHeight: explore.forced_height,
    chart,
    timeout: explore.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
    ownState: dataMask[form_data.slice_id ?? 0]?.ownState, // 0 - unsaved chart
    impressionId,
    user: explore.user,
    exploreState: explore,
    reports,
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
