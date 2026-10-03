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
 * Host wrapper for Extensions-contributed dashboard components (EXTENSION_TYPE).
 *
 * This component owns the shared dashboard "chrome" — the drag handle, resize
 * container, and delete affordance — and renders the contributed component
 * resolved from the `dashboardComponents` registry, passing it the stable
 * `DashboardComponentProps` contract. Contributed components therefore only
 * render content; they never re-implement layout chrome.
 *
 * If the referenced component is not registered (e.g. its extension is disabled
 * or not yet loaded), a non-destructive placeholder is rendered and the
 * instance's `meta` is preserved on save.
 */
import { useCallback } from 'react';
import type { ResizeStartCallback, ResizeCallback } from 're-resizable';

import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';

import { useDashboardComponents } from 'src/core';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import type { LayoutItem } from 'src/dashboard/types';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import { ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
  GRID_BASE_UNIT,
} from 'src/dashboard/util/constants';

export interface DashboardExtensionComponentProps {
  id: string;
  parentId: string;
  component: LayoutItem;
  parentComponent: LayoutItem;
  index: number;
  depth: number;
  editMode: boolean;

  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;

  deleteComponent: (id: string, parentId: string) => void;
  handleComponentDrop: (dropResult: DropResult) => void;
  updateComponents: (components: Record<string, LayoutItem>) => void;
}

const Placeholder = styled.div`
  ${({ theme }) => `
    width: 100%;
    height: 100%;
    min-height: ${theme.sizeUnit * 25}px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: ${theme.sizeUnit * 4}px;
    color: ${theme.colorTextTertiary};
    border: 1px dashed ${theme.colorBorder};
  `}
`;

export default function DashboardExtensionComponent(
  props: DashboardExtensionComponentProps,
) {
  const {
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
  } = props;

  // Subscribe to the registry so a component that registers after this renders
  // (e.g. a lazily-loaded extension) replaces the placeholder once available.
  const registered = useDashboardComponents();
  const extensionComponentId = component.meta.extensionComponentId as
    | string
    | undefined;
  const entry = registered.find(r => r.definition.id === extensionComponentId);

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(component.id, parentComponent.id);
  }, [component.id, deleteComponent, parentComponent.id]);

  const updateMeta = useCallback(
    (patch: Record<string, unknown>) => {
      updateComponents({
        [component.id]: {
          ...component,
          meta: { ...component.meta, ...patch },
        },
      });
    },
    [component, updateComponents],
  );

  const resizable = entry?.definition.resizable ?? true;
  const widthMultiple = component.meta.width ?? GRID_MIN_COLUMN_COUNT;
  const ContributedComponent = entry?.Component;

  return (
    <Draggable
      component={component}
      parentComponent={parentComponent}
      orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      editMode={editMode}
    >
      {({ dragSourceRef }: { dragSourceRef: React.Ref<HTMLDivElement> }) => (
        <ResizableContainer
          id={component.id}
          adjustableWidth={resizable && parentComponent.type === ROW_TYPE}
          adjustableHeight={resizable}
          widthStep={columnWidth}
          widthMultiple={widthMultiple}
          heightStep={GRID_BASE_UNIT}
          heightMultiple={component.meta.height ?? GRID_MIN_ROW_UNITS}
          minWidthMultiple={GRID_MIN_COLUMN_COUNT}
          minHeightMultiple={GRID_MIN_ROW_UNITS}
          maxWidthMultiple={availableColumnCount + widthMultiple}
          onResizeStart={onResizeStart}
          onResize={onResize}
          onResizeStop={onResizeStop}
          editMode={editMode}
        >
          <div
            ref={dragSourceRef}
            className="dashboard-component dashboard-component-extension"
            data-test="dashboard-component-extension"
            id={component.id}
          >
            {editMode && (
              <HoverMenu position="top">
                <DeleteComponentButton onDelete={handleDeleteComponent} />
              </HoverMenu>
            )}
            {ContributedComponent ? (
              <ContributedComponent
                id={component.id}
                meta={component.meta}
                editMode={editMode}
                updateMeta={updateMeta}
              />
            ) : (
              <Placeholder data-test="dashboard-component-extension-missing">
                {t(
                  'This component requires the "%(id)s" extension, which is not available.',
                  { id: extensionComponentId ?? t('unknown') },
                )}
              </Placeholder>
            )}
          </div>
        </ResizableContainer>
      )}
    </Draggable>
  );
}
