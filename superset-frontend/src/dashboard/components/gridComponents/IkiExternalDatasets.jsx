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
 * COMPONENT: Demand Sensing Component
 * WIDGET FRONTEND URL EXAMPLE: http://localhost:3000/widget/demand-sensing?mode=preview&pipeline_id=2Xu7cwsoaYAcWBUPpT53NI6BmPs&master_dataset_id=2XcuQ4ZjfaZSv3FjSRJeYtsGcWH&metric_dataset_id=2XcueVqNYAMY5zFlAPflDYYpIS5&forecast_dataset_id=2XcuhD08LAAdvL9h0MeA2e4AWeC
 * PARAMETERS:
 * pipeline_id: string
 * master_dataset_id: string
 * metric_dataset_id: string
 * forecast_dataset_id: string
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

class IkiDemandSensing extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
      markdownSource: props.component.meta.code,
      // markdownSource: `<iframe
      //                 id="ikidemandsensing-widget-${this.props.component.id}"
      //                 name="demand-sensing-component"
      //                 src="http://localhost:3000/widget/demand-sensing?mode=edit"
      //                 title="IkiDemandSensing Component"
      //                 className="ikidemandsensing-widget"
      //                 style="min-height: 100%;"
      //               />`,
      editor: null,
      editorMode: 'edit',
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

          if (dataType === 'object') {
            messageData = JSON.parse(messageObject.data);
          } else {
            messageData = messageObject.data;
          }

          if (
            document.getElementById(
              `ikidemandsensing-widget-${this.props.component.id}`,
            )
          ) {
            widgetUrl = new URL(
              document.getElementById(
                `ikidemandsensing-widget-${this.props.component.id}`,
              ).src,
            );
          } else {
            widgetUrl = `${this.props.ikigaiOrigin}/widget/demand-sensing`;
          }

          if (
            messageObject.info ===
            'demandsensing-to-superset/sending-setup-data'
          ) {
            widgetUrlQuery = new URLSearchParams(widgetUrl.search);
            widgetUrlQuery.set('mode', 'preview');
            widgetUrlQuery.set('pipeline_id', messageData.pipeline_id);
            widgetUrlQuery.set(
              'master_dataset_id',
              messageData.master_dataset_id,
            );
            widgetUrlQuery.set(
              'metric_dataset_id',
              messageData.metric_dataset_id,
            );
            widgetUrlQuery.set(
              'forecast_dataset_id',
              messageData.forecast_dataset_id,
            );
            widgetUrl.search = widgetUrlQuery.toString();
            const tempIframe = `<iframe
                      id="ikidemandsensing-widget-${this.props.component.id}"
                      name="demand-sensing-component"
                      src="${widgetUrl}"
                      title="IkiDemandSensing Component"
                      className="ikidemandsensing-widget"
                      style="min-height: 100%;"
                    />`;
            this.handleIkiDemandSensingChange(tempIframe);
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

    let widgetUrl;

    if (
      document.getElementById(
        `ikidemandsensing-widget-${this.props.component.id}`,
      )
    ) {
      widgetUrl = new URL(
        document.getElementById(
          `ikidemandsensing-widget-${this.props.component.id}`,
        ).src,
      );
    } else {
      widgetUrl = `${this.props.ikigaiOrigin}/widget/eitl/row`;
    }
    const widgetUrlQuery = new URLSearchParams(widgetUrl.search);
    widgetUrlQuery.set('mode', mode);
    widgetUrl.search = widgetUrlQuery.toString();
    const tempIframe = `<iframe
                      id="ikidemandsensing-widget-${this.props.component.id}"
                      name="demand-sensing-component"
                      src="${widgetUrl}"
                      title="IkiDemandSensing Component"
                      className="ikidemandsensing-widget"
                      style="min-height: 100%;"
                    />`;
    this.handleIkiDemandSensingChange(tempIframe);
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

  handleIkiDemandSensingChange(nextValue) {
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
    // const ikigaiOrigin = 'http://localhost:3000';
    let iframe = '';
    let iframeSrc = '';
    if (ikigaiOrigin) {
      if (markdownSource) {
        iframe = markdownSource;
        const iframeWrapper = document.createElement('div');
        iframeWrapper.innerHTML = markdownSource;
        const iframeHtml = iframeWrapper.firstChild;
        const iframeSrcUrl = new URL(iframeHtml.src);
        const paramMode = iframeSrcUrl.searchParams.get('mode')
          ? iframeSrcUrl.searchParams.get('mode')
          : '';
        const paramPipelineId = iframeSrcUrl.searchParams.get('pipeline_id')
          ? iframeSrcUrl.searchParams.get('pipeline_id')
          : '';
        const paramMasterDatasetId = iframeSrcUrl.searchParams.get(
          'master_dataset_id',
        )
          ? iframeSrcUrl.searchParams.get('master_dataset_id')
          : '';
        const paramMetricDatasetId = iframeSrcUrl.searchParams.get(
          'metric_dataset_id',
        )
          ? iframeSrcUrl.searchParams.get('metric_dataset_id')
          : '';
        const paramForecastDatasetId = iframeSrcUrl.searchParams.get(
          'forecast_dataset_id',
        )
          ? iframeSrcUrl.searchParams.get('forecast_dataset_id')
          : '';

        const newIframeSrc = `${ikigaiOrigin}/widget/demand-sensing?mode=${paramMode}&pipeline_id=${paramPipelineId}&master_dataset_id=${paramMasterDatasetId}&metric_dataset_id=${paramMetricDatasetId}&forecast_dataset_id=${paramForecastDatasetId}`;
        iframeSrc = newIframeSrc;
      } else {
        iframeSrc = `${ikigaiOrigin}/widget/demand-sensing?mode=edit`;
      }

      iframe = `<iframe
                    id="ikidemandsensing-widget-${this.props.component.id}"
                    name="demand-sensing-component-${timestamp}"
                    src="${iframeSrc}"
                    title="IkiDemandSensing Component"
                    className="ikidemandsensing-widget"
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
      <div className="demand-app-wrap">
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
                className={cx('demand-app-comp', isEditing && 'dashboard-markdown--editing')}
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
      </div>
    );
  }
}

IkiDemandSensing.propTypes = propTypes;
IkiDemandSensing.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    undoLength: state.dashboardLayout.past.length,
    redoLength: state.dashboardLayout.future.length,
  };
}

export default connect(mapStateToProps)(IkiDemandSensing);
