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
 * COMPONENT: RUN FLOW
 * WIDGET FRONTEND URL EXAMPLE: http://localhost:3000/widget/pipeline/run?mode=preview&v=1&run_flow_times=1661354875318&pipeline_id=2Dj9IKLHAsi3W3euDQo2Vx6Gupt&submit_button_label=r1&pipeline_log_type=full-log&edit_variables=no
 * PARAMETERS:
 * mode=preview
 * v=1
 * run_flow_times=1661354875318
 * pipeline_id=2Dj9IKLHAsi3W3euDQo2Vx6Gupt
 * submit_button_label=r1
 * pipeline_log_type=full-log
 * edit_variables=no
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

class IkiRunPipeline extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
      markdownSource: props.component.meta.code,
      // markdownSource: `<iframe
      //                  id="ikirunpipeline-widget-IKI_RUN_PIPELINE-IxVl4QJtbN"
      //                  name="run-flow-component"
      //                  src="http://localhost:3000/widget/pipeline/run?mode=edit"
      //                  title="IkiRunPipeline Component"
      //                  className="ikirunpipeline-widget"
      //                  style="min-height: 100%;"
      //  />`,
      editor: null,
      editorMode: 'edit',
      undoLength: props.undoLength,
      redoLength: props.redoLength,
      dashboardId: null,
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
    this.setState({
      dashboardId: parseInt(
        window.location.pathname.split('/dashboard/')[1].split('/')[0],
        10,
      ),
    });
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
    if (this.props.editMode && this.props.editMode !== prevProps.editMode) {
      setTimeout(() => {
        this.handleChangeEditorMode('edit');
      }, 500);
    } else if (
      !this.props.editMode &&
      this.props.editMode !== prevProps.editMode
    ) {
      this.handleChangeEditorMode('preview');
      // setTimeout(() => {
      //   const iframe = document.getElementById(
      //     `ikirunpipeline-widget-${this.props.component.id}`,
      //   );
      //   if (iframe && iframe !== undefined) {
      //     iframe.contentWindow.postMessage(
      //       JSON.stringify({
      //         data: 'superset-to-widget/confirm-pipeline-selection',
      //       }),
      //       this.props.ikigaiOrigin,
      //     );
      //   }
      // }, 500);
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
      // console.log('event.origin', event.origin, this.props.ikigaiOrigin);
      if (event.origin === this.props.ikigaiOrigin) {
        // if (event.origin === 'http://localhost:3000') {
        const messageObject = JSON.parse(event.data);
        if (messageObject.info && messageObject.dataType) {
          const { dataType } = messageObject;
          const chartsList = [];

          let messageData;
          let widgetUrl;
          let widgetUrlQuery;
          // let widgetUrlQueryMode;

          const allChartElements = document.querySelectorAll(
            '[data-test-chart-id]',
          );
          allChartElements.forEach(chartElement => {
            const tempChartID = chartElement.getAttribute('data-test-chart-id');
            const tempChartName = chartElement.getAttribute(
              'data-test-chart-name',
            );
            chartsList.push({ id: tempChartID, name: tempChartName });
          });

          if (dataType === 'object') {
            messageData = JSON.parse(messageObject.data);
          } else {
            messageData = messageObject.data;
          }

          if (
            document.getElementById(
              `ikirunpipeline-widget-${this.props.component.id}`,
            )
          ) {
            widgetUrl = new URL(
              document.getElementById(
                `ikirunpipeline-widget-${this.props.component.id}`,
              ).src,
            );
            // widgetUrlQueryMode = widgetUrl.searchParams.get('mode');
          } else {
            widgetUrl = `${this.props.ikigaiOrigin}/widget/pipeline/run?mode=edit&v=1&run_flow_times=${timestamp}`;
          }

          if (
            messageObject.info === 'widget-to-superset/sending-pipeline-data'
          ) {
            if (
              // widgetUrlQueryMode === 'edit' &&
              JSON.parse(messageObject.data).scId === this.props.component.id
            ) {
              widgetUrlQuery = new URLSearchParams(widgetUrl.search);
              widgetUrlQuery.set('mode', 'preview');
              widgetUrlQuery.set('pipeline_id', messageData.pipeline.id);
              widgetUrlQuery.set('alias_id', messageData.aliasPipelineId);
              widgetUrlQuery.set(
                'submit_button_label',
                messageData.buttonLabel,
              );
              widgetUrlQuery.set('pipeline_log_type', messageData.logLevel);
              widgetUrlQuery.set('edit_variables', messageData.variable);
              const jsonString = JSON.stringify(messageData.selectedCharts);
              const base64String = Buffer.from(jsonString).toString('base64');
              widgetUrlQuery.set('selected_charts', base64String);
              widgetUrlQuery.set('scid', this.props.component.id);
              widgetUrl.search = widgetUrlQuery.toString();
              const tempIframe = `<iframe
                          id="ikirunpipeline-widget-${this.props.component.id}"
                          name="run-flow-component"
                          src="${widgetUrl}"
                          title="IkiRunPipeline Component"
                          className="ikirunpipeline-widget"
                          style="min-height: 100%;"
                        />`;
              this.handleIkiRunPipelineChange(tempIframe);
            }
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

  refreshCharts(selectedCharts) {
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
    return nextFocus;
    // const nextFocused = !!nextFocus;
    // const nextEditMode = nextFocused ? 'edit' : 'preview';
    // this.setState(() => ({ isFocused: nextFocused }));
    // this.handleChangeEditorMode(nextEditMode);
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

    let widgetUrl;

    const chartsList = [];
    const allChartElements = document.querySelectorAll('[data-test-chart-id]');
    allChartElements.forEach(chartElement => {
      const tempChartID = chartElement.getAttribute('data-test-chart-id');
      const tempChartName = chartElement.getAttribute('data-test-chart-name');
      chartsList.push({ id: tempChartID, name: tempChartName });
    });
    if (
      document.getElementById(
        `ikirunpipeline-widget-${this.props.component.id}`,
      )
    ) {
      widgetUrl = new URL(
        document.getElementById(
          `ikirunpipeline-widget-${this.props.component.id}`,
        ).src,
      );
    } else {
      widgetUrl = `${this.props.ikigaiOrigin}/widget/pipeline/run?mode=edit&v=1&run_flow_times=${timestamp}`;
    }

    const widgetUrlQuery = new URLSearchParams(widgetUrl.search);
    widgetUrlQuery.set('mode', mode);
    const jsonString2 = JSON.stringify(chartsList);
    const base64String2 = Buffer.from(jsonString2).toString('base64');
    widgetUrlQuery.set('charts_list', base64String2);
    widgetUrl.search = widgetUrlQuery.toString();
    const tempIframe = `<iframe
                      id="ikirunpipeline-widget-${this.props.component.id}"
                      name="run-flow-component"
                      src="${widgetUrl}"
                      title="IkiRunPipeline Component"
                      className="ikirunpipeline-widget"
                      style="min-height: 100%;"
                    />`;
    this.handleIkiRunPipelineChange(tempIframe);
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
      },
    );
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
    // const ikigaiOrigin = 'http://localhost:3000';
    let iframe = '';
    let iframeSrc = '';
    if (ikigaiOrigin) {
      console.log('markdownSource Run Pipeline', markdownSource);
      if (markdownSource) {
        // iframe = markdownSource;
        const iframeWrapper = document.createElement('div');
        iframeWrapper.innerHTML = markdownSource;
        const iframeHtml = iframeWrapper.firstChild;
        const iframeSrcUrl = new URL(iframeHtml.src);
        const paramMode = iframeSrcUrl.searchParams.get('mode')
          ? iframeSrcUrl.searchParams.get('mode')
          : '';
        const paramTimestamp = iframeSrcUrl.searchParams.get('run_flow_times')
          ? iframeSrcUrl.searchParams.get('run_flow_times')
          : timestamp;
        const paramPipelineId = iframeSrcUrl.searchParams.get('pipeline_id')
          ? iframeSrcUrl.searchParams.get('pipeline_id')
          : '';
        const paramAliasId = iframeSrcUrl.searchParams.get('alias_id')
          ? iframeSrcUrl.searchParams.get('alias_id')
          : '';
        const paramSubmitButtonLabel = iframeSrcUrl.searchParams.get(
          'submit_button_label',
        )
          ? iframeSrcUrl.searchParams.get('submit_button_label')
          : '';
        const paramPipelineLogType = iframeSrcUrl.searchParams.get(
          'pipeline_log_type',
        )
          ? iframeSrcUrl.searchParams.get('pipeline_log_type')
          : '';
        const paramEditVariables = iframeSrcUrl.searchParams.get(
          'edit_variables',
        )
          ? iframeSrcUrl.searchParams.get('edit_variables')
          : '';
        const paramSelectedCharts = iframeSrcUrl.searchParams.get(
          'selected_charts',
        )
          ? iframeSrcUrl.searchParams.get('selected_charts')
          : '';

        const newIframeSrc = `${ikigaiOrigin}/widget/pipeline/run?mode=${paramMode}&v=1&run_flow_times=${paramTimestamp}&pipeline_id=${paramPipelineId}&alias_id=${paramAliasId}&submit_button_label=${paramSubmitButtonLabel}&pipeline_log_type=${paramPipelineLogType}&edit_variables=${paramEditVariables}&selected_charts=${paramSelectedCharts}`;
        // console.log('iframe', newIframeSrcUrl, iframeHtml);
        iframeSrc = newIframeSrc;
      } else {
        iframeSrc = `${ikigaiOrigin}/widget/pipeline/run?mode=edit&v=1&run_flow_times=${timestamp}`;
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
      iframeSrc = `${iframeSrc}&charts_list=${base64String3}&scid=${this.props.component.id}`;

      iframe = `<iframe
                    id="ikirunpipeline-widget-${this.props.component.id}"
                    name="run-flow-component-${timestamp}"
                    src="${iframeSrc}"
                    title="IkiRunPipeline Component"
                    className="ikirunpipeline-widget"
                    style="height: 100%;"
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

  refreshChart(chartId, dashboardId, isCached) {
    this.props.logEvent(LOG_ACTIONS_FORCE_REFRESH_CHART, {
      slice_id: chartId,
      is_cached: isCached,
    });
    return this.props.refreshChart(chartId, true, dashboardId);
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
                isEditing && 'dashboard-component-ikirunpipeline--editing',
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
                onResizeStart={this.handleResizeStart}
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
                {dropIndicatorProps && <div {...dropIndicatorProps} />}
              </ResizableContainer>
            </div>
          </WithPopoverMenu>
        )}
      </DragDroppable>
    );
  }
}

IkiRunPipeline.propTypes = propTypes;
IkiRunPipeline.defaultProps = defaultProps;

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

export default connect(mapStateToProps, mapDispatchToProps)(IkiRunPipeline);
