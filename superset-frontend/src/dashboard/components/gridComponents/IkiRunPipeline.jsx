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
import { connect } from 'react-redux';
import cx from 'classnames';

import { t, SafeMarkdown } from '@superset-ui/core';
import { Logger, LOG_ACTIONS_RENDER_CHART } from 'src/logger/LogUtils';
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

// const dashURL = 'https://dev-ui.ikigailabs.io';
// const dashURL = 'https://first-app.ikigailabs.io/widget/pipeline/run';
// const dashURL = 'http://localhost:3000';
const dashURL = document.referrer.substring(0, document.referrer.length - 1);
const timestamp = new Date().getTime().toString();
const iframeEmptyURL = `${dashURL}/widget/pipeline/run?mode=edit&v=1&run_flow_times=${timestamp}`;

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,

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

const defaultProps = {};

const MARKDOWN_ERROR_MESSAGE = t('This component has an error.');

class IkiRunPipeline extends React.PureComponent {
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
    if (!this.props.component.meta.code) {
      this.handleIncomingWindowMsg();
      window.parent.postMessage('superset-to-parent/get-project-id', dashURL);
    } else {
      this.handleIncomingWindowMsg();
    }
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
      if (event.origin === dashURL) {
        const messageObject = JSON.parse(event.data);
        if (messageObject.info && messageObject.dataType) {
          const { dataType } = messageObject;
          let messageData;
          let widgetUrl;
          let widgetUrlQuery;
          let widgetUrlQueryMode;
          if (dataType === 'object') {
            messageData = JSON.parse(messageObject.data);
          } else {
            messageData = messageObject.data;
          }
          if (
            messageObject.info === 'widget-to-superset/sending-pipeline-data'
          ) {
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
              widgetUrlQueryMode = widgetUrl.searchParams.get('mode');
            } else {
              widgetUrl = iframeEmptyURL;
            }
            if (widgetUrlQueryMode === 'edit') {
              widgetUrlQuery = new URLSearchParams(widgetUrl);
              widgetUrlQuery.set('mode', 'preview');
              widgetUrlQuery.set('pipeline_id', messageData.pipeline.id);
              widgetUrlQuery.set(
                'submit_button_label',
                messageData.buttonLabel,
              );
              widgetUrlQuery.set('pipeline_log_type', messageData.logLevel);
              widgetUrlQuery.set('edit_variables', messageData.variable);
              widgetUrl.search = widgetUrlQuery.toString();
              const tempIframe = `<iframe
                      id="ikirunpipeline-widget-${this.props.component.id}"
                      name="run-flow-${timestamp}"
                      src="${widgetUrl}"
                      title="IkiRunPipeline Component"
                      className="ikirunpipeline-widget"
                      style="min-height: 100%;"
                    />`;
              this.handleIkiRunPipelineChange(tempIframe);
              if (
                document.getElementById(
                  `ikirunpipeline-widget-${this.props.component.id}`,
                )
              ) {
                document.getElementById(
                  `ikirunpipeline-widget-${this.props.component.id}`,
                ).src = widgetUrl;
              }
            }
          }
        }
      }
    });
  }

  setEditor(editor) {
    editor.getSession().setUseWrapMode(true);
    this.setState({
      editor,
    });
  }

  handleChangeFocus(nextFocus) {
    const nextFocused = !!nextFocus;
    const nextEditMode = nextFocused ? 'edit' : 'preview';
    this.setState(() => ({ isFocused: nextFocused }));
    this.handleChangeEditorMode(nextEditMode);
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
    let iframe = '';
    let iframeSrc = '';
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
      const paramEditVariables = iframeSrcUrl.searchParams.get('edit_variables')
        ? iframeSrcUrl.searchParams.get('edit_variables')
        : '';
      const newIframeSrc = `${iframeSrcUrl.origin}${iframeSrcUrl.pathname}?mode=${paramMode}&v=1&run_flow_times=${paramTimestamp}&pipeline_id=${paramPipelineId}&submit_button_label=${paramSubmitButtonLabel}&pipeline_log_type=${paramPipelineLogType}&edit_variables=${paramEditVariables}`;
      const newIframeSrcUrl = new URL(newIframeSrc);
      const hostname = newIframeSrcUrl.href
        .toString()
        .split('ikigailabs.io')[0];
      if (hostname.includes('localhost') || hostname.includes('dev')) {
        // iframeHtml.src = newIframeSrcUrl.href.toString();
        iframeSrc = newIframeSrcUrl.href.toString();
      } else {
        const srcUrl = `${dashURL}${
          newIframeSrcUrl.href.toString().split('.ikigailabs.io')[1]
        }`;
        // iframeHtml.src = srcUrl;
        iframeSrc = srcUrl;
      }
      // console.log('iframe', newIframeSrcUrl, iframeHtml);
    } else {
      iframeSrc = iframeEmptyURL;
    }
    iframe = `<iframe
                  id="ikirunpipeline-widget-${this.props.component.id}"
                  name="run-flow-${timestamp}"
                  src="${iframeSrc}"
                  title="IkiRunPipeline Component"
                  className="ikirunpipeline-widget"
                  style="height: 100%;"
                />`;
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
              </ResizableContainer>
            </div>
            {dropIndicatorProps && <div {...dropIndicatorProps} />}
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

export default connect(mapStateToProps)(IkiRunPipeline);
