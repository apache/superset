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
/**
 * COMPONENT: Interactive Forecast Component
 * WIDGET FRONTEND URL EXAMPLE: http://localhost:3000/widget/interactive-forecast-chart?mode=preview&dataset_id=2XuNHHmywYae6Ob0K0lUR0NVXSC&datetime_column=Date&data_series=Demand&dimensions_column=prediction_type&metrics_type=SUM
 * PARAMETERS:
 * mode=preview
 * dataset_id=2XuNHHmywYae6Ob0K0lUR0NVXSC
 * datetime_column=Date
 * data_series=Demand
 * dimensions_column=prediction_type
 * metrics_type=SUM
 */
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import cx from 'classnames';

import { t, SafeMarkdown } from '@superset-ui/core';
import {
  Logger,
  LOG_ACTIONS_RENDER_CHART,
  LOG_ACTIONS_FORCE_REFRESH_CHART,
} from 'src/logger/LogUtils';
import { MarkdownEditor } from 'src/components/AsyncAceEditor';

import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import MarkdownModeDropdown from 'src/dashboard/components/menu/MarkdownModeDropdown';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import { componentShape } from 'src/dashboard/util/propShapes';
import { ROW_TYPE, COLUMN_TYPE } from 'src/dashboard/util/componentTypes';
import {
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
  GRID_BASE_UNIT,
} from 'src/dashboard/util/constants';
import { refreshChart } from 'src/components/Chart/chartAction';

const { Buffer } = require('buffer');

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,
  ikigaiOrigin: PropTypes.string,

  // from redux
  logEvent: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  undoLength: PropTypes.number.isRequired,
  redoLength: PropTypes.number.isRequired,

  // grid related
  availableColumnCount: PropTypes.number.isRequired,
  columnWidth: PropTypes.number.isRequired,
  onResizeStart: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  onResizeStop: PropTypes.func.isRequired,

  // dnd
  deleteComponent: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const timestamp = new Date().getTime().toString();

const defaultProps = {};

const MARKDOWN_ERROR_MESSAGE = t('This component has an error.');

class IkiInteractiveForecast extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
      markdownSource: props.component.meta.code,
      editor: null,
      editorMode: 'preview',
      undoLength: props.undoLength,
      redoLength: props.redoLength,
    };
    this.renderStartTime = Logger.getTimestamp();

    this.handleChangeFocus = this.handleChangeFocus.bind(this);
    this.handleChangeEditorMode = this.handleChangeEditorMode.bind(this);
    this.handleMarkdownChange = this.handleMarkdownChange.bind(this);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleResizeStart = this.handleResizeStart.bind(this);
    this.setEditor = this.setEditor.bind(this);
  }

  componentDidMount() {
    this.props.logEvent(LOG_ACTIONS_RENDER_CHART, {
      viz_type: 'markdown',
      start_offset: this.renderStartTime,
      ts: new Date().getTime(),
      duration: Logger.getTimestamp() - this.renderStartTime,
    });
    this.handleIncomingWindowMsg();
  }

  static getDerivedStateFromProps(nextProps, state) {
    const { hasError, editorMode, markdownSource, undoLength, redoLength } =
      state;
    const {
      component: nextComponent,
      undoLength: nextUndoLength,
      redoLength: nextRedoLength,
    } = nextProps;
    // user click undo or redo ?
    if (nextUndoLength !== undoLength || nextRedoLength !== redoLength) {
      return {
        ...state,
        undoLength: nextUndoLength,
        redoLength: nextRedoLength,
        markdownSource: nextComponent.meta.code,
        hasError: false,
      };
    }
    if (
      !hasError &&
      editorMode === 'preview' &&
      nextComponent.meta.code !== markdownSource
    ) {
      return {
        ...state,
        markdownSource: nextComponent.meta.code,
      };
    }

    return state;
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidUpdate(prevProps) {
    if (
      this.state.editor &&
      (prevProps.component.meta.width !== this.props.component.meta.width ||
        prevProps.columnWidth !== this.props.columnWidth)
    ) {
      this.state.editor.resize(true);
    }
    // pre-load AceEditor when entering edit mode
    if (this.props.editMode) {
      MarkdownEditor.preload();
    }
  }

  componentDidCatch() {
    if (this.state.editor && this.state.editorMode === 'preview') {
      this.props.addDangerToast(
        t(
          'This markdown component has an error. Please revert your recent changes.',
        ),
      );
    }
  }

  // eslint-disable-next-line class-methods-use-this
  handleIncomingWindowMsg() {
    window.addEventListener('message', event => {
      if (event.origin === this.props.ikigaiOrigin) {
        // if (event.origin === 'http://localhost:3000') {
        const messageObject = JSON.parse(event.data);
        if (messageObject.info && messageObject.dataType) {
          const { dataType } = messageObject;
          let messageData;
          let widgetUrl;
          let widgetUrlQuery;
          // let widgetUrlQueryMode;

          if (dataType === 'object') {
            messageData = JSON.parse(messageObject.data);
          } else {
            messageData = messageObject.data;
          }
          if (
            document.getElementById(
              `ikiinteractiveforecast-widget-${this.props.component.id}`,
            )
          ) {
            widgetUrl = new URL(
              document.getElementById(
                `ikiinteractiveforecast-widget-${this.props.component.id}`,
              ).src,
            );
            // widgetUrlQueryMode =
            //   messageData.mode !== widgetUrl.searchParams.get('mode')
            //     ? messageData.mode
            //     : widgetUrl.searchParams.get('mode');
          } else {
            widgetUrl = `${this.props.ikigaiOrigin}/widget/interactive-forecast-chart?mode=edit`;
          }

          if (messageObject.info === 'widget-to-superset/sending-dataset-ids') {
            widgetUrlQuery = new URLSearchParams(widgetUrl);
            widgetUrlQuery.set('mode', 'preview');
            widgetUrlQuery.set('dataset_id', messageData.dataset_id);
            widgetUrlQuery.set('datetime_column', messageData.datetime_column);
            widgetUrlQuery.set('data_series', messageData.data_series);
            widgetUrlQuery.set(
              'dimensions_column',
              messageData.dimensions_column,
            );
            widgetUrlQuery.set('metrics_type', messageData.metrics_type);
            widgetUrlQuery.set('filter_columns', messageData.filter_columns);
            widgetUrlQuery.set('isModule', messageData.isModule);
            widgetUrlQuery.set('aliasPipelineId', messageData.aliasPipelineId);
            widgetUrlQuery.set('pipelineId', messageData.pipelineId);
            const jsonString = JSON.stringify(messageData.selectedCharts);
            const base64String = Buffer.from(jsonString).toString('base64');
            widgetUrlQuery.set('selectedCharts', base64String);
            widgetUrl.search = widgetUrlQuery.toString();
            const tempIframe = `<iframe
                                  id="ikiinteractiveforecast-widget-${this.props.component.id}"
                                  name="ikiinteractiveforecast"
                                  src="${widgetUrl}"
                                  title="Hero Section Component"
                                  className="ikirunpipeline-widget"
                                  style="min-height: 100%;"
                              />`;
            this.handleIkiRunPipelineChange(tempIframe);
          } else if (
            messageObject.info ===
            'widget-to-superset/sending-charts-to-refresh'
          ) {
            const { selectedCharts } = messageData;
            this.refreshCharts(selectedCharts);
          }
        }
      }
    });
  }

  refreshChart(chartId, dashboardId, isCached) {
    this.props.logEvent(LOG_ACTIONS_FORCE_REFRESH_CHART, {
      slice_id: chartId,
      is_cached: isCached,
    });
    return this.props.refreshChart(chartId, true, dashboardId);
  }

  refreshCharts(selectedCharts) {
    console.info('selectedCharts', selectedCharts);
    selectedCharts.forEach(selectedChart => {
      this.refreshChart(selectedChart.id, this.state.dashboardId, false);
    });
  }

  setEditor(editor) {
    editor.getSession().setUseWrapMode(true);
    this.setState({
      editor,
    });
  }

  handleChangeFocus(nextFocus) {
    // const nextFocused = !!nextFocus;
    // const nextEditMode = nextFocused ? 'edit' : 'preview';
    // this.setState(() => ({ isFocused: nextFocused }));
    // this.handleChangeEditorMode(nextEditMode);
    return nextFocus;
  }

  handleChangeEditorMode(mode) {
    const nextState = {
      ...this.state,
      editorMode: mode,
    };
    if (mode === 'preview') {
      this.updateMarkdownContent();
      nextState.hasError = false;
    }

    this.setState(nextState);
  }

  updateMarkdownContent() {
    const { updateComponents, component } = this.props;
    if (component.meta.code !== this.state.markdownSource) {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            code: this.state.markdownSource,
          },
        },
      });
    }
  }

  handleMarkdownChange(nextValue) {
    this.setState({
      markdownSource: nextValue,
    });
  }

  handleIkiRunPipelineChange(nextValue) {
    this.setState(
      {
        markdownSource: nextValue,
      },
      () => {
        // this.handleMarkdownChange();
        // this.updateMarkdownContent();
      },
    );
    const { updateComponents, component } = this.props;
    if (component.meta.code !== nextValue) {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            code: nextValue,
          },
        },
      });
    }
  }

  handleDeleteComponent() {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  handleResizeStart(e) {
    const { editorMode } = this.state;
    const { editMode, onResizeStart } = this.props;
    const isEditing = editorMode === 'edit';
    onResizeStart(e);
    if (editMode && isEditing) {
      this.updateMarkdownContent();
    }
  }

  renderIframe() {
    const { markdownSource, hasError } = this.state;
    const { ikigaiOrigin } = this.props;
    let iframe = '';
    let iframeSrc = '';
    if (ikigaiOrigin) {
      if (markdownSource) {
        const iframeWrapper = document.createElement('div');
        iframeWrapper.innerHTML = markdownSource;
        const iframeHtml = iframeWrapper.firstChild;
        const iframeSrcUrl = new URL(iframeHtml.src);
        const paramMode = iframeSrcUrl.searchParams.get('mode')
          ? iframeSrcUrl.searchParams.get('mode')
          : '';
        const datasetId = iframeSrcUrl.searchParams.get('dataset_id')
          ? iframeSrcUrl.searchParams.get('dataset_id')
          : '';
        const datetimeColumn = iframeSrcUrl.searchParams.get('datetime_column')
          ? iframeSrcUrl.searchParams.get('datetime_column')
          : '';
        const filterColumns = iframeSrcUrl.searchParams.get('filter_columns')
          ? iframeSrcUrl.searchParams.get('filter_columns')
          : '';
        const dataSeries = iframeSrcUrl.searchParams.get('data_series')
          ? iframeSrcUrl.searchParams.get('data_series')
          : '';
        const dimensionsColumn = iframeSrcUrl.searchParams.get(
          'dimensions_column',
        )
          ? iframeSrcUrl.searchParams.get('dimensions_column')
          : '';
        const metricsType = iframeSrcUrl.searchParams.get('metrics_type')
          ? iframeSrcUrl.searchParams.get('metrics_type')
          : '';
        const isModule = iframeSrcUrl.searchParams.get('isModule');
        const paramAliasId = iframeSrcUrl.searchParams.get('aliasPipelineId')
          ? iframeSrcUrl.searchParams.get('aliasPipelineId')
          : '';
        const paramSelectedCharts = iframeSrcUrl.searchParams.get(
          'selectedCharts',
        )
          ? iframeSrcUrl.searchParams.get('selectedCharts')
          : '';
        const paramPipelineId = iframeSrcUrl.searchParams.get('pipelineId')
          ? iframeSrcUrl.searchParams.get('pipelineId')
          : '';
        if (iframeSrcUrl.searchParams.get('explainability')) {
          const explainability =
            iframeSrcUrl.searchParams.get('explainability');
          const forecastAliasId =
            iframeSrcUrl.searchParams.get('forecastAliasId');
          const insightsAliasId =
            iframeSrcUrl.searchParams.get('insightsAliasId');
          const seasonalityAliasId =
            iframeSrcUrl.searchParams.get('seasonalityAliasId');
          const skuCompositionAliasId = iframeSrcUrl.searchParams.get(
            'skuCompositionAliasId',
          );
          const newIframeSrc = `${ikigaiOrigin}/widget/interactive-forecast-chart?mode=${paramMode}&dataset_id=${datasetId}&datetime_column=${datetimeColumn}&data_series=${dataSeries}&dimensions_column=${dimensionsColumn}&metrics_type=${metricsType}&filter_columns=${filterColumns}&&explainability=${explainability}&forecastAliasId=${forecastAliasId}&insightsAliasId=${insightsAliasId}&seasonalityAliasId=${seasonalityAliasId}&skuCompositionAliasId=${skuCompositionAliasId}`;
          iframeSrc = newIframeSrc;
        } else {
          const newIframeSrc = `${ikigaiOrigin}/widget/interactive-forecast-chart?mode=${paramMode}&dataset_id=${datasetId}&datetime_column=${datetimeColumn}&data_series=${dataSeries}&dimensions_column=${dimensionsColumn}&metrics_type=${metricsType}&filter_columns=${filterColumns}&isModule=${isModule}&aliasPipelineId=${paramAliasId}&selectedCharts=${paramSelectedCharts}&pipelineId=${paramPipelineId}`;
          iframeSrc = newIframeSrc;
        }
      } else {
        iframeSrc = `${ikigaiOrigin}/widget/interactive-forecast-chart?mode=edit&isModule=true`;
      }

      const allChartElements = document.querySelectorAll(
        '[data-test-chart-id]',
      );
      const chartsList = [];
      allChartElements.forEach(chartElement => {
        const tempChartID = chartElement.getAttribute('data-test-chart-id');
        const tempChartName = chartElement.getAttribute('data-test-chart-name');
        chartsList.push({ id: tempChartID, name: tempChartName });
      });
      const jsonString3 = JSON.stringify(chartsList);
      const base64String3 = Buffer.from(jsonString3).toString('base64');

      iframeSrc = `${iframeSrc}&charts_list=${base64String3}`;

      iframe = `<iframe
                    id="ikiinteractiveforecast-widget-${this.props.component.id}"
                    name="ikiinteractiveforecast-${timestamp}"
                    src="${iframeSrc}"
                    title="Interactive Forecast Component"
                    className="ikirunpipeline-widget"
                    style="min-height: 100%;"
                  />`;
    } else {
      iframe = '';
    }
    return <SafeMarkdown source={hasError ? MARKDOWN_ERROR_MESSAGE : iframe} />;
  }

  renderEditMode() {
    return this.renderIframe();
  }

  renderPreviewMode() {
    return this.renderIframe();
  }

  render() {
    const { isFocused, editorMode } = this.state;
    // const { isFocused } = this.state;

    const {
      component,
      parentComponent,
      index,
      depth,
      availableColumnCount,
      columnWidth,
      onResize,
      onResizeStop,
      handleComponentDrop,
      editMode,
    } = this.props;

    // inherit the size of parent columns
    const widthMultiple =
      parentComponent.type === COLUMN_TYPE
        ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
        : component.meta.width || GRID_MIN_COLUMN_COUNT;

    const isEditing = editorMode === 'edit';
    // const isEditing = false;

    return (
      <DragDroppable
        component={component}
        parentComponent={parentComponent}
        orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        disableDragDrop={isFocused}
        editMode={editMode}
      >
        {({ dropIndicatorProps, dragSourceRef }) => (
          <WithPopoverMenu
            onChangeFocus={this.handleChangeFocus}
            menuItems={[
              <MarkdownModeDropdown
                id={`${component.id}-mode`}
                value={this.state.editorMode}
                onChange={this.handleChangeEditorMode}
              />,
              <DeleteComponentButton onDelete={this.handleDeleteComponent} />,
            ]}
            editMode={editMode}
          >
            <div
              data-test="dashboard-markdown-editor"
              className={cx(
                'dashboard-component-ikirunpipeline',
                isEditing && 'dashboard-markdown--editing',
              )}
              id={component.id}
            >
              <ResizableContainer
                id={component.id}
                adjustableWidth={parentComponent.type === ROW_TYPE}
                adjustableHeight
                widthStep={columnWidth}
                widthMultiple={widthMultiple}
                heightStep={GRID_BASE_UNIT}
                heightMultiple={component.meta.height}
                minWidthMultiple={GRID_MIN_COLUMN_COUNT}
                minHeightMultiple={GRID_MIN_ROW_UNITS}
                maxWidthMultiple={availableColumnCount + widthMultiple}
                // onResizeStart={this.handleResizeStart}
                onResize={onResize}
                onResizeStop={onResizeStop}
                editMode={isFocused ? false : editMode}
              >
                <div
                  ref={dragSourceRef}
                  className="dashboard-component-inner"
                  data-test="dashboard-component-chart-holder"
                >
                  {
                    // editMode && isEditing
                    editMode && isEditing
                      ? this.renderEditMode()
                      : this.renderPreviewMode()
                  }
                </div>
              </ResizableContainer>
            </div>
            {dropIndicatorProps && <div {...dropIndicatorProps} />}
          </WithPopoverMenu>
        )}
      </DragDroppable>
    );
  }
}

IkiInteractiveForecast.propTypes = propTypes;
IkiInteractiveForecast.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    undoLength: state.dashboardLayout.past.length,
    redoLength: state.dashboardLayout.future.length,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      refreshChart,
    },
    dispatch,
  );
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(IkiInteractiveForecast);
