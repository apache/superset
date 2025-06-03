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
import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import cx from 'classnames';

import { css, styled, t } from '@superset-ui/core';
import { SafeMarkdown, MarkdownEditor } from '@superset-ui/core/components';
import { Logger, LOG_ACTIONS_RENDER_CHART } from 'src/logger/LogUtils';

import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
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

  // HTML sanitization
  htmlSanitization: PropTypes.bool,
  htmlSchemaOverrides: PropTypes.object,
};

const defaultProps = {};

// TODO: localize
const MARKDOWN_PLACE_HOLDER = `# ✨Header 1
## ✨Header 2
### ✨Header 3

<br />

Click here to learn more about [markdown formatting](https://bit.ly/1dQOfRK)`;

const MARKDOWN_ERROR_MESSAGE = t('This markdown component has an error.');

const MarkdownStyles = styled.div`
  ${({ theme }) => css`
    &.dashboard-markdown {
      overflow: hidden;
      color: ${theme.colorText};

      h4,
      h5,
      h6 {
        font-weight: ${theme.fontWeightNormal};
      }

      h6 {
        font-size: ${theme.fontSizeSM}px;
      }

      .dashboard-component-chart-holder {
        overflow-y: auto;
        overflow-x: hidden;
        border-radius: ${theme.borderRadius}px;
      }

      .dashboard--editing & {
        cursor: move;
      }
    }
  `}
`;

class Markdown extends PureComponent {
  renderStartTime: $TSFixMe;

  constructor(props: $TSFixMe) {
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
    // @ts-expect-error TS(2339): Property 'logEvent' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.logEvent(LOG_ACTIONS_RENDER_CHART, {
      viz_type: 'markdown',
      start_offset: this.renderStartTime,
      ts: new Date().getTime(),
      duration: Logger.getTimestamp() - this.renderStartTime,
    });
  }

  static getDerivedStateFromProps(nextProps: $TSFixMe, state: $TSFixMe) {
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

  componentDidUpdate(prevProps: $TSFixMe) {
    if (
      // @ts-expect-error TS(2339): Property 'editor' does not exist on type 'Readonly... Remove this comment to see the full error message
      this.state.editor &&
      // @ts-expect-error TS(2339): Property 'component' does not exist on type 'Reado... Remove this comment to see the full error message
      (prevProps.component.meta.width !== this.props.component.meta.width ||
        // @ts-expect-error TS(2339): Property 'columnWidth' does not exist on type 'Rea... Remove this comment to see the full error message
        prevProps.columnWidth !== this.props.columnWidth)
    ) {
      // @ts-expect-error TS(2339): Property 'editor' does not exist on type 'Readonly... Remove this comment to see the full error message
      this.state.editor.resize(true);
    }
    // pre-load AceEditor when entering edit mode
    // @ts-expect-error TS(2339): Property 'editMode' does not exist on type 'Readon... Remove this comment to see the full error message
    if (this.props.editMode) {
      MarkdownEditor.preload();
    }
  }

  componentDidCatch() {
    // @ts-expect-error TS(2339): Property 'editor' does not exist on type 'Readonly... Remove this comment to see the full error message
    if (this.state.editor && this.state.editorMode === 'preview') {
      // @ts-expect-error TS(2339): Property 'addDangerToast' does not exist on type '... Remove this comment to see the full error message
      this.props.addDangerToast(
        t(
          'This markdown component has an error. Please revert your recent changes.',
        ),
      );
    }
  }

  setEditor(editor: $TSFixMe) {
    editor.getSession().setUseWrapMode(true);
    this.setState({
      editor,
    });
  }

  handleChangeFocus(nextFocus: $TSFixMe) {
    const nextFocused = !!nextFocus;
    const nextEditMode = nextFocused ? 'edit' : 'preview';
    this.setState(() => ({ isFocused: nextFocused }));
    this.handleChangeEditorMode(nextEditMode);
  }

  handleChangeEditorMode(mode: $TSFixMe) {
    const nextState = {
      ...this.state,
      editorMode: mode,
    };
    if (mode === 'preview') {
      this.updateMarkdownContent();
      // @ts-expect-error TS(2339): Property 'hasError' does not exist on type '{ edit... Remove this comment to see the full error message
      nextState.hasError = false;
    }

    this.setState(nextState);
  }

  updateMarkdownContent() {
    // @ts-expect-error TS(2339): Property 'updateComponents' does not exist on type... Remove this comment to see the full error message
    const { updateComponents, component } = this.props;
    // @ts-expect-error TS(2339): Property 'markdownSource' does not exist on type '... Remove this comment to see the full error message
    if (component.meta.code !== this.state.markdownSource) {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            // @ts-expect-error TS(2339): Property 'markdownSource' does not exist on type '... Remove this comment to see the full error message
            code: this.state.markdownSource,
          },
        },
      });
    }
  }

  handleMarkdownChange(nextValue: $TSFixMe) {
    this.setState({
      markdownSource: nextValue,
    });
  }

  handleDeleteComponent() {
    // @ts-expect-error TS(2339): Property 'deleteComponent' does not exist on type ... Remove this comment to see the full error message
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  handleResizeStart(e: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'editorMode' does not exist on type 'Read... Remove this comment to see the full error message
    const { editorMode } = this.state;
    // @ts-expect-error TS(2339): Property 'editMode' does not exist on type 'Readon... Remove this comment to see the full error message
    const { editMode, onResizeStart } = this.props;
    const isEditing = editorMode === 'edit';
    onResizeStart(e);
    if (editMode && isEditing) {
      this.updateMarkdownContent();
    }
  }

  renderEditMode() {
    return (
      <MarkdownEditor
        onChange={this.handleMarkdownChange}
        width="100%"
        height="100%"
        showGutter={false}
        editorProps={{ $blockScrolling: true }}
        value={
          // this allows "select all => delete" to give an empty editor
          // @ts-expect-error TS(2339): Property 'markdownSource' does not exist on type '... Remove this comment to see the full error message
          typeof this.state.markdownSource === 'string'
            ? // @ts-expect-error TS(2339): Property 'markdownSource' does not exist on type '... Remove this comment to see the full error message
              this.state.markdownSource
            : MARKDOWN_PLACE_HOLDER
        }
        readOnly={false}
        onLoad={this.setEditor}
        data-test="editor"
      />
    );
  }

  renderPreviewMode() {
    // @ts-expect-error TS(2339): Property 'hasError' does not exist on type 'Readon... Remove this comment to see the full error message
    const { hasError } = this.state;

    return (
      <SafeMarkdown
        source={
          hasError
            ? MARKDOWN_ERROR_MESSAGE
            : // @ts-expect-error TS(2339): Property 'markdownSource' does not exist on type '... Remove this comment to see the full error message
              this.state.markdownSource || MARKDOWN_PLACE_HOLDER
        }
        // @ts-expect-error TS(2339): Property 'htmlSanitization' does not exist on type... Remove this comment to see the full error message
        htmlSanitization={this.props.htmlSanitization}
        // @ts-expect-error TS(2339): Property 'htmlSchemaOverrides' does not exist on t... Remove this comment to see the full error message
        htmlSchemaOverrides={this.props.htmlSchemaOverrides}
      />
    );
  }

  render() {
    // @ts-expect-error TS(2339): Property 'isFocused' does not exist on type 'Reado... Remove this comment to see the full error message
    const { isFocused, editorMode } = this.state;

    const {
      // @ts-expect-error TS(2339): Property 'component' does not exist on type 'Reado... Remove this comment to see the full error message
      component,
      // @ts-expect-error TS(2339): Property 'parentComponent' does not exist on type ... Remove this comment to see the full error message
      parentComponent,
      // @ts-expect-error TS(2339): Property 'index' does not exist on type 'Readonly<... Remove this comment to see the full error message
      index,
      // @ts-expect-error TS(2339): Property 'depth' does not exist on type 'Readonly<... Remove this comment to see the full error message
      depth,
      // @ts-expect-error TS(2339): Property 'availableColumnCount' does not exist on ... Remove this comment to see the full error message
      availableColumnCount,
      // @ts-expect-error TS(2339): Property 'columnWidth' does not exist on type 'Rea... Remove this comment to see the full error message
      columnWidth,
      // @ts-expect-error TS(2339): Property 'onResize' does not exist on type 'Readon... Remove this comment to see the full error message
      onResize,
      // @ts-expect-error TS(2339): Property 'onResizeStop' does not exist on type 'Re... Remove this comment to see the full error message
      onResizeStop,
      // @ts-expect-error TS(2339): Property 'handleComponentDrop' does not exist on t... Remove this comment to see the full error message
      handleComponentDrop,
      // @ts-expect-error TS(2339): Property 'editMode' does not exist on type 'Readon... Remove this comment to see the full error message
      editMode,
    } = this.props;

    // inherit the size of parent columns
    const widthMultiple =
      parentComponent.type === COLUMN_TYPE
        ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
        : component.meta.width || GRID_MIN_COLUMN_COUNT;

    const isEditing = editorMode === 'edit';

    return (
      <Draggable
        // @ts-expect-error TS(2322): Type '{ children: ({ dragSourceRef }: any) => Elem... Remove this comment to see the full error message
        component={component}
        parentComponent={parentComponent}
        orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        disableDragDrop={isFocused}
        editMode={editMode}
      >
        {({ dragSourceRef }: $TSFixMe) => (
          <WithPopoverMenu
            onChangeFocus={this.handleChangeFocus}
            menuItems={[
              <MarkdownModeDropdown
                id={`${component.id}-mode`}
                // @ts-expect-error TS(2339): Property 'editorMode' does not exist on type 'Read... Remove this comment to see the full error message
                value={this.state.editorMode}
                onChange={this.handleChangeEditorMode}
              />,
            ]}
            editMode={editMode}
          >
            <MarkdownStyles
              data-test="dashboard-markdown-editor"
              className={cx(
                'dashboard-markdown',
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
                onResizeStart={this.handleResizeStart}
                onResize={onResize}
                onResizeStop={onResizeStop}
                editMode={isFocused ? false : editMode}
              >
                <div
                  ref={dragSourceRef}
                  className="dashboard-component dashboard-component-chart-holder"
                  data-test="dashboard-component-chart-holder"
                >
                  {editMode && (
                    <HoverMenu position="top">
                      <DeleteComponentButton
                        onDelete={this.handleDeleteComponent}
                      />
                    </HoverMenu>
                  )}
                  {editMode && isEditing
                    ? this.renderEditMode()
                    : this.renderPreviewMode()}
                </div>
              </ResizableContainer>
            </MarkdownStyles>
          </WithPopoverMenu>
        )}
      </Draggable>
    );
  }
}

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
Markdown.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
Markdown.defaultProps = defaultProps;

function mapStateToProps(state: $TSFixMe) {
  return {
    undoLength: state.dashboardLayout.past.length,
    redoLength: state.dashboardLayout.future.length,
    htmlSanitization: state.common.conf.HTML_SANITIZATION,
    htmlSchemaOverrides: state.common.conf.HTML_SANITIZATION_SCHEMA_EXTENSIONS,
  };
}
export default connect(mapStateToProps)(Markdown);
