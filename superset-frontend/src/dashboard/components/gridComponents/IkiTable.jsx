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
  window.location != window.parent.location
    ? document.referrer
    : document.location.href;
const dashURL = parentURL.substring(0, parentURL.indexOf('/', 8));
const timestamp = new Date().getTime().toString();
const iframeEmptyURL = `${dashURL}/widget/dataset/table?v=1&editable_dataset_times=${timestamp}&mode=edit`;

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

class IkiTable extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
      markdownSource: props.component.meta.code,
      editor: null,
      editorMode: 'preview',
      undoLength: props.undoLength,
      redoLength: props.redoLength,
      projectId: '',
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
    // console.log('IkiTable componentDidMount', this.props, this.state);
    // console.log('ref',document.referrer,'dash',dashURL,'win loc',window.location);
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
    const { projectId } = this.state;
    window.addEventListener('message', event => {
      if (event.origin === dashURL) {
        // console.log('ikitable received 1: ', event.data);
        const messageObject = JSON.parse(event.data);
        if (messageObject.info && messageObject.dataType) {
          const { dataType } = messageObject;
          let messageData;
          let widgetUrl;
          if (dataType === 'object') {
            messageData = JSON.parse(messageObject.data);
          } else {
            messageData = messageObject.data;
          }
          if (
            messageObject.info === 'top-window-to-superset/sending-project-id'
          ) {
            const tempMarkdownSouce = this.state.markdownSource;
            if ((!projectId || projectId === '') && !tempMarkdownSouce) {
              if (
                document.getElementById(
                  `ikitable-widget-${this.props.component.id}`,
                )
              ) {
                widgetUrl = new URL(
                  document.getElementById(
                    `ikitable-widget-${this.props.component.id}`,
                  ).src,
                );
                const widgetUrlQuery = new URLSearchParams(widgetUrl);
                widgetUrlQuery.set('mode', 'edit');
                widgetUrlQuery.set('project_id', messageData);
                widgetUrl.search = widgetUrlQuery.toString();
              } else {
                widgetUrl = iframeEmptyURL;
              }
              // console.log('widgetUrl123', widgetUrl);
              this.setState(
                {
                  projectId: messageData,
                },
                () => {
                  const tempIframe = `<iframe
                    id="ikitable-widget-${this.props.component.id}"
                    name="editable-dataset-${timestamp}"
                    src="${widgetUrl}"
                    title="IkiTable Component"
                    className="ikitable-widget"
                    style="height:100%;"
                  />`;
                  this.handleIkiTableChange(tempIframe);
                  if (
                    document.getElementById(
                      `ikitable-widget-${this.props.component.id}`,
                    )
                  ) {
                    document.getElementById(
                      `ikitable-widget-${this.props.component.id}`,
                    ).src = widgetUrl;
                  }
                },
              );
            }
          } else if (
            messageObject.info === 'widget-to-superset/sending-datasets-ids'
          ) {
            if (
              document.getElementById(
                `ikitable-widget-${this.props.component.id}`,
              )
            ) {
              const widgetUrl = new URL(
                document.getElementById(
                  `ikitable-widget-${this.props.component.id}`,
                ).src,
              );
              // const widgetUrlQuery = new URLSearchParams(widgetUrl);
              const widgetUrlQueryTblType =
                widgetUrl.searchParams.get('table_type');
              // const widgetUrlQueryTblMode = widgetUrl.searchParams.get('mode');
              const widgetUrlQueryProjectId =
                widgetUrl.searchParams.get('project_id');
              if (!widgetUrlQueryTblType) {
                widgetUrl.searchParams.set('mode', 'preview');
                const tableType = messageData.tableType
                  ? messageData.tableType
                  : '';
                let tempProjectId = '';
                if (messageData.projectId) {
                  tempProjectId = messageData.projectId
                    ? messageData.projectId
                    : '';
                } else {
                  tempProjectId = widgetUrlQueryProjectId;
                }
                if (tempProjectId || tempProjectId !== '') {
                  widgetUrl.searchParams.set('project_id', tempProjectId);
                }
                widgetUrl.searchParams.set('table_type', tableType);
                if (messageData.datasets) {
                  Object.keys(messageData.datasets).forEach(
                    messageDataObject => {
                      widgetUrl.searchParams.set(
                        messageDataObject,
                        messageData.datasets[messageDataObject],
                      );
                    },
                  );
                }
                // widgetUrl.search = widgetUrlQuery.toString();
                const tempIframe = `<iframe
                        id="ikitable-widget-${this.props.component.id}"
                        name="editable-dataset-${timestamp}"
                        src="${widgetUrl}"
                        title="IkiTable Component"
                        className="ikitable-widget"
                        style="height:100%;"
                      />`;
                this.handleIkiTableChange(tempIframe);
                document.getElementById(
                  `ikitable-widget-${this.props.component.id}`,
                ).src = widgetUrl;
              }
            }
          } else if (
            messageObject.info === 'widget-to-superset/sending-lookup-columns'
          ) {
            if (
              document.getElementById(
                `ikitable-widget-${this.props.component.id}`,
              )
            ) {
              const widgetUrl = new URL(
                document.getElementById(
                  `ikitable-widget-${this.props.component.id}`,
                ).src,
              );
              const lookupColumn = messageData.lookup ? messageData.lookup : '';
              const dropdownColumn = messageData.dropdown
                ? messageData.dropdown
                : '';
              if (lookupColumn && dropdownColumn) {
                widgetUrl.searchParams.set('dropdown_column', dropdownColumn);
                widgetUrl.searchParams.set('lookup_column', lookupColumn);
              }

              // widgetUrl.search = widgetUrlQuery.toString();
              // console.log('widgetUrl...', widgetUrl);
              const tempIframe = `<iframe
                        id="ikitable-widget-${this.props.component.id}"
                        name="editable-dataset-${timestamp}"
                        src="${widgetUrl}"
                        title="IkiTable Component"
                        className="ikitable-widget"
                        style="height:100%;"
                      />`;
              this.handleIkiTableChange(tempIframe);
              document.getElementById(
                `ikitable-widget-${this.props.component.id}`,
              ).src = widgetUrl;
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

  handleIkiTableChange(nextValue) {
    // console.log('handleIkiTableChange', nextValue);
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
    /* console.log(
      'updateMarkdownContent',
      component.meta.code,
      this.state.markdownSource,
    ); */
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
      iframeSrc = iframeEmptyURL;
    }

    iframe = `<iframe
                  id="ikitable-widget-${this.props.component.id}"
                  name="editable-dataset-${timestamp}"
                  src="${iframeSrc}"
                  title="IkiTable Component"
                  className="ikitable-widget"
                  style="height:100%;"
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

    // console.log('editMode', editMode, isEditing, markdownSource);

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
                'dashboard-component-ikitable',
                isEditing && 'dashboard-component-ikitable--editing',
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

IkiTable.propTypes = propTypes;
IkiTable.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    undoLength: state.dashboardLayout.past.length,
    redoLength: state.dashboardLayout.future.length,
  };
}
export default connect(mapStateToProps)(IkiTable);
