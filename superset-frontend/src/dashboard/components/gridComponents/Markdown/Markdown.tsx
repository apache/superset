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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import cx from 'classnames';
import type { JsonObject } from '@superset-ui/core';
import type { ResizeStartCallback, ResizeCallback } from 're-resizable';
import { ErrorBoundary } from 'src/components';

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

function Markdown({
  id,
  parentId,
  component,
  parentComponent,
  index,
  depth,
  editMode,
  availableColumnCount,
  columnWidth,
  onResizeStart,
  onResize,
  onResizeStop,
  deleteComponent,
  handleComponentDrop,
  updateComponents,
  logEvent,
  addDangerToast,
  undoLength,
  redoLength,
  htmlSanitization,
  htmlSchemaOverrides,
}: MarkdownProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [markdownSource, setMarkdownSource] = useState<string>(
    component.meta.code as string,
  );
  const [editor, setEditorState] = useState<EditorInstance | null>(null);
  const [editorMode, setEditorMode] = useState<'preview' | 'edit'>('preview');
  const [hasError, setHasError] = useState(false);

  const renderStartTimeRef = useRef(Logger.getTimestamp());
  const prevUndoLengthRef = useRef(undoLength);
  const prevRedoLengthRef = useRef(redoLength);
  const prevComponentWidthRef = useRef(component.meta.width);
  const prevColumnWidthRef = useRef(columnWidth);

  // getDerivedStateFromProps equivalent: handle undo/redo and external code changes
  useEffect(() => {
    // user click undo or redo?
    if (
      undoLength !== prevUndoLengthRef.current ||
      redoLength !== prevRedoLengthRef.current
    ) {
      setMarkdownSource(component.meta.code as string);
      setHasError(false);
      prevUndoLengthRef.current = undoLength;
      prevRedoLengthRef.current = redoLength;
    } else if (
      !hasError &&
      editorMode === 'preview' &&
      component.meta.code !== markdownSource
    ) {
      setMarkdownSource(component.meta.code as string);
    }
  }, [
    undoLength,
    redoLength,
    component.meta.code,
    hasError,
    editorMode,
    markdownSource,
  ]);

  // componentDidMount equivalent: log render event
  useEffect(() => {
    logEvent(LOG_ACTIONS_RENDER_CHART, {
      viz_type: 'markdown',
      start_offset: renderStartTimeRef.current,
      ts: new Date().getTime(),
      duration: Logger.getTimestamp() - renderStartTimeRef.current,
    });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // componentDidUpdate equivalent: resize editor when width changes
  useEffect(() => {
    if (
      editor &&
      (prevComponentWidthRef.current !== component.meta.width ||
        prevColumnWidthRef.current !== columnWidth)
    ) {
      // Handle both Ace editor (resize method) and EditorHandle (no resize needed)
      if (typeof editor.resize === 'function') {
        editor.resize(true);
      }
    }
    prevComponentWidthRef.current = component.meta.width;
    prevColumnWidthRef.current = columnWidth;
  }, [editor, component.meta.width, columnWidth]);

  const updateMarkdownContent = useCallback((): void => {
    if (component.meta.code !== markdownSource) {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            code: markdownSource,
          },
        },
      });
    }
  }, [component, markdownSource, updateComponents]);

  const setEditor = useCallback((editorInstance: EditorInstance): void => {
    // EditorHandle or Ace editor instance
    // For Ace: editor.getSession().setUseWrapMode(true)
    // For EditorHandle: wrapEnabled is handled via options
    if (editorInstance?.getSession) {
      editorInstance.getSession!().setUseWrapMode(true);
    }
    setEditorState(editorInstance);
  }, []);

  const handleChangeEditorMode = useCallback(
    (mode: 'edit' | 'preview'): void => {
      if (mode === 'preview') {
        updateMarkdownContent();
        setHasError(false);
      }
      setEditorMode(mode);
    },
    [updateMarkdownContent],
  );

  const handleChangeFocus = useCallback(
    (nextFocus: boolean | number): void => {
      const nextFocused = !!nextFocus;
      const nextEditMode: 'edit' | 'preview' = nextFocused ? 'edit' : 'preview';
      setIsFocused(nextFocused);
      handleChangeEditorMode(nextEditMode);
    },
    [handleChangeEditorMode],
  );

  const handleMarkdownChange = useCallback((nextValue: string): void => {
    setMarkdownSource(nextValue);
  }, []);

  const handleDeleteComponent = useCallback((): void => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const handleResizeStart = useCallback(
    (...args: Parameters<ResizeStartCallback>): void => {
      const isEditing = editorMode === 'edit';
      onResizeStart(...args);
      if (editMode && isEditing) {
        updateMarkdownContent();
      }
    },
    [editorMode, editMode, onResizeStart, updateMarkdownContent],
  );

  const shouldFocusMarkdown = useCallback(
    (
      event: MouseEvent,
      container: HTMLElement | null,
      menuRef: HTMLElement | null,
    ): boolean => {
      if (container?.contains(event.target as Node)) return true;
      if (menuRef?.contains(event.target as Node)) return true;
      return false;
    },
    [],
  );

  const handleRenderError = useCallback(
    (error: Error, info: { componentStack: string } | null): void => {
      setHasError(true);
      if (editorMode === 'preview') {
        addDangerToast(
          t(
            'This markdown component has an error. Please revert your recent changes.',
          ),
        );
      }
    },
    [addDangerToast, editorMode],
  );

  const renderEditMode = useMemo(
    () => (
      <EditorHost
        id={`markdown-editor-${id}`}
        onChange={handleMarkdownChange}
        width="100%"
        height="100%"
        value={
          // this allows "select all => delete" to give an empty editor
          typeof markdownSource === 'string'
            ? markdownSource
            : MARKDOWN_PLACE_HOLDER
        }
        language="markdown"
        readOnly={false}
        lineNumbers={false}
        wordWrap
        onReady={(handle: EditorInstance) => {
          // The handle provides access to the underlying editor for resize
          if (handle && typeof handle.focus === 'function') {
            setEditor(handle);
          }
        }}
        data-test="editor"
      />
    ),
    [id, markdownSource, handleMarkdownChange, setEditor],
  );

  const renderPreviewMode = useMemo(
    () => (
      <ErrorBoundary
        key={hasError ? 'markdown-error' : 'markdown-ok'}
        onError={handleRenderError}
        showMessage={false}
      >
        <SafeMarkdown
          source={
            hasError
              ? MARKDOWN_ERROR_MESSAGE
              : markdownSource || MARKDOWN_PLACE_HOLDER
          }
          htmlSanitization={htmlSanitization}
          htmlSchemaOverrides={htmlSchemaOverrides}
        />
      </ErrorBoundary>
    ),
    [
      hasError,
      markdownSource,
      htmlSanitization,
      htmlSchemaOverrides,
      handleRenderError,
    ],
  );

  // inherit the size of parent columns
  const widthMultiple =
    parentComponent.type === COLUMN_TYPE
      ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
      : component.meta.width || GRID_MIN_COLUMN_COUNT;

  const isEditing = editorMode === 'edit';

  const menuItems = useMemo(
    () => [
      <MarkdownModeDropdown
        key={`${component.id}-mode`}
        id={`${component.id}-mode`}
        value={editorMode}
        onChange={handleChangeEditorMode}
      />,
    ],
    [component.id, editorMode, handleChangeEditorMode],
  );

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
          onChangeFocus={handleChangeFocus}
          shouldFocus={shouldFocusMarkdown}
          menuItems={menuItems}
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
              onResizeStart={handleResizeStart}
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
                    <DeleteComponentButton onDelete={handleDeleteComponent} />
                  </HoverMenu>
                )}
                {editMode && isEditing ? renderEditMode : renderPreviewMode}
              </div>
            </ResizableContainer>
          </MarkdownStyles>
        </WithPopoverMenu>
      )}
    </Draggable>
  );
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
