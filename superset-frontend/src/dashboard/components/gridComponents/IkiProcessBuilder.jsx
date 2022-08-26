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
import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import cx from 'classnames';
// import JSONCrush from 'jsoncrush';
// eslint-disable-next-line import/no-extraneous-dependencies
import LZString from 'lz-string';

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
const parentURL =
  window.location !== window.parent.location
    ? document.referrer
    : document.location.href;
const dashURL = parentURL.substring(0, parentURL.indexOf('/', 8));
const timestamp = new Date().getTime().toString();
const iframeEmptyURL = `${dashURL}/widget/diagram/builder?v=1&mode=edit&run_flow_times=${timestamp}`;

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

const MARKDOWN_ERROR_MESSAGE = t('This markdown component has an error.');

class IkiProcessBuilder extends React.PureComponent {
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
    } else {
      const widgetUrl = new URL(
        document.getElementById(
          `ikiprocessdiagram-widget-${this.props.component.id}`,
        ).src,
      );
      const definitionData = document.getElementById(
        `ikiprocessdiagram-widget-${this.props.component.id}`,
      ).dataset.definition;
      widgetUrl.searchParams.set('mode', 'preview');
      widgetUrl.searchParams.set('data', definitionData);
      widgetUrl.searchParams.set('scid', this.props.component.id);
      const tempIframe = `<iframe
                        id="ikiprocessdiagram-widget-${this.props.component.id}"
                        name="process-diagram-${timestamp}"
                        src="${widgetUrl}"
                        title="IkiProcessDiagram Component"
                        className="ikiprocessdiagram-widget"
                        data-definition="${definitionData}"
                      ></iframe>`;
      document.getElementById(
        `ikiprocessdiagram-widget-${this.props.component.id}`,
      ).src = widgetUrl;
      this.handleIkiProcessBuilderChange(tempIframe);
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

    // console.log('componentDidUpdate', prevProps.editMode, this.props.editMode);
    if (prevProps.editMode && !this.props.editMode) {
      // console.log('from edit to preview');
      if (
        document.getElementById(
          `ikiprocessdiagram-widget-${this.props.component.id}`,
        )
      ) {
        const widgetUrl = new URL(
          document.getElementById(
            `ikiprocessdiagram-widget-${this.props.component.id}`,
          ).src,
        );
        const definitionData = document.getElementById(
          `ikiprocessdiagram-widget-${this.props.component.id}`,
        ).dataset.definition;
        widgetUrl.searchParams.set('mode', 'preview');
        widgetUrl.searchParams.set('data', definitionData);
        document.getElementById(
          `ikiprocessdiagram-widget-${this.props.component.id}`,
        ).src = widgetUrl;
        const tempIframe = `<iframe
                            id="ikiprocessdiagram-widget-${this.props.component.id}"
                            name="process-diagram-${timestamp}"
                            src="${widgetUrl}"
                            title="IkiProcessDiagram Component"
                            className="ikiprocessdiagram-widget"
                            data-definition="${definitionData}"
                          ></iframe>`;
        this.handleSaveAndResetComponent(tempIframe);
      }
    } else if (!prevProps.editMode && this.props.editMode) {
      // console.log('from preview to edit');
      if (
        document.getElementById(
          `ikiprocessdiagram-widget-${this.props.component.id}`,
        )
      ) {
        const widgetUrl = new URL(
          document.getElementById(
            `ikiprocessdiagram-widget-${this.props.component.id}`,
          ).src,
        );
        const definitionData = document.getElementById(
          `ikiprocessdiagram-widget-${this.props.component.id}`,
        ).dataset.definition;
        widgetUrl.searchParams.set('mode', 'edit');
        widgetUrl.searchParams.set('data', definitionData);
        document.getElementById(
          `ikiprocessdiagram-widget-${this.props.component.id}`,
        ).src = widgetUrl;
        const tempIframe = `<iframe
                            id="ikiprocessdiagram-widget-${this.props.component.id}"
                            name="process-diagram-${timestamp}"
                            src="${widgetUrl}"
                            title="IkiProcessDiagram Component"
                            className="ikiprocessdiagram-widget"
                            data-definition="${definitionData}"
                          ></iframe>`;
        this.handleSaveAndResetComponent(tempIframe);
      }
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
        // console.log('process diagram received 1: ', event.data);
        const messageObject = JSON.parse(event.data);
        if (messageObject.info && messageObject.dataType) {
          const { dataType, scId } = messageObject;
          let messageData;
          if (dataType === 'object') {
            messageData = JSON.parse(messageObject.data);
          } else {
            messageData = messageObject.data;
          }
          if (messageObject.info === 'widget-to-superset/edit') {
            if (
              document.getElementById(
                `ikiprocessdiagram-widget-${this.props.component.id}`,
              )
            ) {
              const widgetUrl = new URL(
                document.getElementById(
                  `ikiprocessdiagram-widget-${this.props.component.id}`,
                ).src,
              );
              const widgetUrlMode = widgetUrl.searchParams.get('mode');
              const widgetSCId = widgetUrl.searchParams.get('scid');
              // widgetUrl.searchParams.set('mode', 'edit');
              if (widgetUrlMode === 'edit' && scId === widgetSCId) {
                const infoString = JSON.stringify(messageData);
                const infoStringCompresed =
                  LZString.compressToEncodedURIComponent(infoString);
                // widgetUrl.searchParams.set('data', infoStringCompresed);
                const tempIframe = `<iframe
                          id="ikiprocessdiagram-widget-${this.props.component.id}"
                          name="process-diagram-${timestamp}"
                          src="${widgetUrl}"
                          title="IkiProcessDiagram Component"
                          className="ikiprocessdiagram-widget"
                          data-definition="${infoStringCompresed}"
                        ></iframe>`;
                this.handleIkiProcessBuilderChange(tempIframe);
                document.getElementById(
                  `ikiprocessdiagram-widget-${this.props.component.id}`,
                ).dataset.definition = infoStringCompresed;
              }
            }
          }
        }
      }
    });
  }

  handleSaveAndResetComponent(nextValue) {
    // console.log('handleSaveAndResetComponent', nextValue);
    this.setState({
      markdownSource: nextValue,
    });
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
    // console.log('handleChangeEditorMode', mode);
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
    /* console.log(
      'updateMarkdownContent',
      component.meta.code,
      this.state.markdownSource,
    ); */
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
    // console.log('handleMarkdownChange', nextValue);
    this.setState({
      markdownSource: nextValue,
    });
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

  handleIkiProcessBuilderChange(nextValue) {
    // console.log('handleIkiTableChange', nextValue);
    this.setState({
      markdownSource: nextValue,
    });
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

  renderIframe(mode) {
    const { markdownSource, hasError } = this.state;
    let iframe = '';
    let iframeSrc = '';
    let iframeData = '';
    if (markdownSource) {
      // iframe = markdownSource;
      const iframeWrapper = document.createElement('div');
      iframeWrapper.innerHTML = markdownSource;
      const iframeHtml = iframeWrapper.firstChild;
      const iframeSrcUrl = new URL(iframeHtml.src);
      if (mode === 'preview') {
        iframeSrcUrl.searchParams.set('mode', 'preview');
      } else {
        iframeSrcUrl.searchParams.set('mode', 'edit');
      }
      iframeData = iframeSrcUrl.searchParams.get('data');
      const hostname = iframeSrcUrl.href.toString().split('ikigailabs.io')[0];
      if (hostname.includes('localhost') || hostname.includes('dev')) {
        // iframeHtml.src = iframeSrcUrl.href.toString();
        iframeSrc = iframeSrcUrl.href.toString();
      } else {
        const srcUrl = `${dashURL}${
          iframeSrcUrl.href.toString().split('.ikigailabs.io')[1]
        }`;
        // iframeHtml.src = srcUrl;
        iframeSrc = srcUrl;
      }

      // console.log('iframe', iframeSrcUrl, iframeHtml);
    } else {
      const iframeSrcUrl = new URL(iframeEmptyURL);
      iframeSrcUrl.searchParams.set('scid', this.props.component.id);
      iframeSrc = iframeSrcUrl.href.toString();
    }
    iframe = `<iframe
                  id="ikiprocessdiagram-widget-${this.props.component.id}"
                  name="ikiprocessdiagram-widget-${timestamp}"
                  src="${iframeSrc}"
                  data-definition="${iframeData}"
                  title="IkiProcessDiagram Component"
                  className="ikiprocessdiagram-widget"
                  style="height: 100%;"
                />`;
    return <SafeMarkdown source={hasError ? MARKDOWN_ERROR_MESSAGE : iframe} />;
  }

  renderEditMode() {
    return this.renderIframe('edit');
  }

  renderPreviewMode() {
    return this.renderIframe('preview');
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

    // console.log('editMode', editMode, isEditing);

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
                'dashboard-component-ikiprocessbuilder',
                isEditing && 'dashboard-component-ikiprocessbuilder--editing',
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
                  className="dashboard-component-ikiprocessbuilder dashboard-component-inner"
                  data-test="dashboard-component-chart-holder"
                >
                  {
                    // editMode && isEditing
                    editMode ? this.renderEditMode() : this.renderPreviewMode()
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

IkiProcessBuilder.propTypes = propTypes;
IkiProcessBuilder.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    undoLength: state.dashboardLayout.past.length,
    redoLength: state.dashboardLayout.future.length,
  };
}
export default connect(mapStateToProps)(IkiProcessBuilder);
