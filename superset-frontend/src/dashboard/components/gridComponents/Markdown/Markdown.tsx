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
import { connect } from 'react-redux';
import cx from 'classnames';
import type { JsonObject } from '@superset-ui/core';
import type { ResizeStartCallback, ResizeCallback } from 're-resizable';

import { t, css, styled } from '@apache-superset/core/ui';
import { SafeMarkdown } from '@superset-ui/core/components';
import { EditorHost } from 'src/core/editors';
import { Logger, LOG_ACTIONS_RENDER_CHART } from 'src/logger/LogUtils';

import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import MarkdownModeDropdown from 'src/dashboard/components/menu/MarkdownModeDropdown';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import type { LayoutItem } from 'src/dashboard/types';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import { ROW_TYPE, COLUMN_TYPE } from 'src/dashboard/util/componentTypes';
import {
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
  GRID_BASE_UNIT,
} from 'src/dashboard/util/constants';

interface EditorInstance {
  resize?: (force: boolean) => void;
  getSession?: () => { setUseWrapMode: (wrap: boolean) => void };
  focus?: () => void;
}

interface MarkdownOwnProps {
  id: string;
  parentId: string;
  component: LayoutItem;
  parentComponent: LayoutItem;
  index: number;
  depth: number;
  editMode: boolean;

  // grid related
  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;

  // dnd
  deleteComponent: (id: string, parentId: string) => void;
  handleComponentDrop: (dropResult: DropResult) => void;
  updateComponents: (components: Record<string, LayoutItem>) => void;
}

interface MarkdownStateProps {
  logEvent: (eventName: string, eventData: JsonObject) => void;
  addDangerToast: (msg: string) => void;
  undoLength: number;
  redoLength: number;
  htmlSanitization?: boolean;
  htmlSchemaOverrides?: JsonObject;
}

type MarkdownProps = MarkdownOwnProps & MarkdownStateProps;

interface MarkdownState {
  isFocused: boolean;
  markdownSource: string;
  editor: EditorInstance | null;
  editorMode: 'preview' | 'edit';
  undoLength: number;
  redoLength: number;
  hasError?: boolean;
}

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

      strong {
        font-weight: 600;
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

interface DragChildProps {
  dragSourceRef: React.RefCallback<HTMLElement>;
}

class Markdown extends PureComponent<MarkdownProps, MarkdownState> {
  renderStartTime: number;

  constructor(props: MarkdownProps) {
    super(props);
    this.state = {
      isFocused: false,
      markdownSource: props.component.meta.code as string,
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
    this.shouldFocusMarkdown = this.shouldFocusMarkdown.bind(this);
  }

  componentDidMount(): void {
    this.props.logEvent(LOG_ACTIONS_RENDER_CHART, {
      viz_type: 'markdown',
      start_offset: this.renderStartTime,
      ts: new Date().getTime(),
      duration: Logger.getTimestamp() - this.renderStartTime,
    });
  }

  static getDerivedStateFromProps(
    nextProps: MarkdownProps,
    state: MarkdownState,
  ): MarkdownState | null {
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
        markdownSource: nextComponent.meta.code as string,
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
        markdownSource: nextComponent.meta.code as string,
      };
    }

    return state;
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return {
      hasError: true,
    };
  }

  componentDidUpdate(prevProps: MarkdownProps): void {
    if (
      this.state.editor &&
      (prevProps.component.meta.width !== this.props.component.meta.width ||
        prevProps.columnWidth !== this.props.columnWidth)
    ) {
      // Handle both Ace editor (resize method) and EditorHandle (no resize needed)
      if (typeof this.state.editor.resize === 'function') {
        this.state.editor.resize(true);
      }
    }
  }

  componentDidCatch(): void {
    if (this.state.editor && this.state.editorMode === 'preview') {
      this.props.addDangerToast(
        t(
          'This markdown component has an error. Please revert your recent changes.',
        ),
      );
    }
  }

  setEditor(editor: EditorInstance): void {
    // EditorHandle or Ace editor instance
    // For Ace: editor.getSession().setUseWrapMode(true)
    // For EditorHandle: wrapEnabled is handled via options
    if (editor?.getSession) {
      editor.getSession!().setUseWrapMode(true);
    }
    this.setState({
      editor,
    });
  }

  handleChangeFocus(nextFocus: boolean | number): void {
    const nextFocused = !!nextFocus;
    const nextEditMode: 'edit' | 'preview' = nextFocused ? 'edit' : 'preview';
    this.setState(() => ({ isFocused: nextFocused }));
    this.handleChangeEditorMode(nextEditMode);
  }

  handleChangeEditorMode(mode: 'edit' | 'preview'): void {
    const nextState: MarkdownState = {
      ...this.state,
      editorMode: mode,
    };
    if (mode === 'preview') {
      this.updateMarkdownContent();
      nextState.hasError = false;
    }

    this.setState(nextState);
  }

  updateMarkdownContent(): void {
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

  handleMarkdownChange(nextValue: string): void {
    this.setState({
      markdownSource: nextValue,
    });
  }

  handleDeleteComponent(): void {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  handleResizeStart(...args: Parameters<ResizeStartCallback>): void {
    const { editorMode } = this.state;
    const { editMode, onResizeStart } = this.props;
    const isEditing = editorMode === 'edit';
    onResizeStart(...args);
    if (editMode && isEditing) {
      this.updateMarkdownContent();
    }
  }

  shouldFocusMarkdown(
    event: MouseEvent,
    container: HTMLElement | null,
    menuRef: HTMLElement | null,
  ): boolean {
    if (container?.contains(event.target as Node)) return true;
    if (menuRef?.contains(event.target as Node)) return true;

    return false;
  }

  renderEditMode(): JSX.Element {
    return (
      <EditorHost
        id={`markdown-editor-${this.props.id}`}
        onChange={this.handleMarkdownChange}
        width="100%"
        height="100%"
        value={
          // this allows "select all => delete" to give an empty editor
          typeof this.state.markdownSource === 'string'
            ? this.state.markdownSource
            : MARKDOWN_PLACE_HOLDER
        }
        language="markdown"
        readOnly={false}
        lineNumbers={false}
        wordWrap
        onReady={(handle: EditorInstance) => {
          // The handle provides access to the underlying editor for resize
          if (handle && typeof handle.focus === 'function') {
            this.setEditor(handle);
          }
        }}
        data-test="editor"
      />
    );
  }

  renderPreviewMode(): JSX.Element {
    const { hasError } = this.state;

    return (
      <SafeMarkdown
        source={
          hasError
            ? MARKDOWN_ERROR_MESSAGE
            : this.state.markdownSource || MARKDOWN_PLACE_HOLDER
        }
        htmlSanitization={this.props.htmlSanitization}
        htmlSchemaOverrides={this.props.htmlSchemaOverrides}
      />
    );
  }

  render() {
    const { isFocused, editorMode } = this.state;

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

    return (
      <Draggable
        component={component}
        parentComponent={parentComponent}
        orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        disableDragDrop={isFocused}
        editMode={editMode}
      >
        {({ dragSourceRef }: DragChildProps) => (
          <WithPopoverMenu
            onChangeFocus={this.handleChangeFocus}
            shouldFocus={this.shouldFocusMarkdown}
            menuItems={[
              <MarkdownModeDropdown
                key={`${component.id}-mode`}
                id={`${component.id}-mode`}
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
                heightMultiple={component.meta.height ?? GRID_MIN_ROW_UNITS}
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

interface ReduxState {
  dashboardLayout: {
    past: unknown[];
    future: unknown[];
  };
  common: {
    conf: {
      HTML_SANITIZATION?: boolean;
      HTML_SANITIZATION_SCHEMA_EXTENSIONS?: JsonObject;
    };
  };
}

function mapStateToProps(
  state: ReduxState,
): Omit<MarkdownStateProps, 'logEvent' | 'addDangerToast'> {
  return {
    undoLength: state.dashboardLayout.past.length,
    redoLength: state.dashboardLayout.future.length,
    htmlSanitization: state.common.conf.HTML_SANITIZATION,
    htmlSchemaOverrides: state.common.conf.HTML_SANITIZATION_SCHEMA_EXTENSIONS,
  };
}
export default connect(mapStateToProps)(Markdown);
