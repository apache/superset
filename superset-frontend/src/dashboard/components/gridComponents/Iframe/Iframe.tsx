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
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { ResizeStartCallback, ResizeCallback } from 're-resizable';

import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { Alert } from '@apache-superset/core/components';
import { Button, Input } from '@superset-ui/core/components';

import { useToasts } from 'src/components/MessageToasts/withToasts';
import { findPermission } from 'src/utils/findPermission';

import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import type { RootState } from 'src/dashboard/types';
import type { LayoutItem } from 'src/dashboard/types';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import { ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
  GRID_BASE_UNIT,
} from 'src/dashboard/util/constants';
import {
  addCspAllowlistEntry,
  CSP_ALLOWLIST_PERMISSION,
  CSP_ALLOWLIST_VIEW,
  fetchCspAllowlist,
  getOrigin,
  isEmbeddableUrl,
} from 'src/dashboard/util/cspAllowlist';

export interface IframeProps {
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

const IframeStyles = styled.div`
  ${({ theme }) => `
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px;

    .dashboard-iframe-frame {
      flex: 1;
      width: 100%;
      border: 0;
      min-height: ${theme.sizeUnit * 25}px;
    }

    .dashboard-iframe-empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${theme.colorTextTertiary};
      border: 1px dashed ${theme.colorBorder};
    }
  `}
`;

export default function Iframe(props: IframeProps) {
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

  const { addSuccessToast, addDangerToast } = useToasts();
  const roles = useSelector((state: RootState) => state.user?.roles);
  const cspFeatureEnabled = isFeatureEnabled(FeatureFlag.CspRuntimeAllowlist);
  const canManageCsp =
    cspFeatureEnabled &&
    findPermission(CSP_ALLOWLIST_PERMISSION, CSP_ALLOWLIST_VIEW, roles);

  const url = (component.meta.url as string) ?? '';
  const [draftUrl, setDraftUrl] = useState(url);
  const [allowlist, setAllowlist] = useState<Set<string> | null>(null);
  const [enabling, setEnabling] = useState(false);

  const origin = getOrigin(url);

  const refreshAllowlist = useCallback(() => {
    if (!cspFeatureEnabled) {
      return;
    }
    fetchCspAllowlist()
      .then(setAllowlist)
      .catch(() => setAllowlist(new Set()));
  }, [cspFeatureEnabled]);

  useEffect(() => {
    refreshAllowlist();
  }, [refreshAllowlist]);

  useEffect(() => {
    setDraftUrl(url);
  }, [url]);

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(component.id, parentComponent.id);
  }, [component.id, deleteComponent, parentComponent.id]);

  const handleSaveUrl = useCallback(() => {
    const trimmed = draftUrl.trim();
    if (trimmed === url) {
      return;
    }
    updateComponents({
      [component.id]: {
        ...component,
        meta: { ...component.meta, url: trimmed },
      },
    });
  }, [component, draftUrl, updateComponents, url]);

  const handleEnableDomain = useCallback(() => {
    if (!origin) {
      return;
    }
    setEnabling(true);
    addCspAllowlistEntry(origin)
      .then(() => {
        addSuccessToast(
          t('%(origin)s is now allowed to be embedded.', { origin }),
        );
        refreshAllowlist();
      })
      .catch(() =>
        addDangerToast(t('Failed to allow %(origin)s in the CSP.', { origin })),
      )
      .finally(() => setEnabling(false));
  }, [addDangerToast, addSuccessToast, origin, refreshAllowlist]);

  // A domain is "flagged" when the runtime allowlist feature is on, the URL
  // resolves to a concrete origin, the allowlist has loaded, and that origin is
  // not yet allowed. When the feature is off we cannot reason about the CSP, so
  // we never flag (the operator's static policy governs).
  const domainFlagged =
    cspFeatureEnabled &&
    !!origin &&
    allowlist !== null &&
    !allowlist.has(origin);

  const widthMultiple = component.meta.width ?? GRID_MIN_COLUMN_COUNT;

  const renderBody = () => (
    <IframeStyles data-test="dashboard-iframe">
      {editMode && (
        <Input
          aria-label={t('Embed URL')}
          data-test="dashboard-iframe-url-input"
          placeholder={t('Paste a URL to embed, e.g. https://example.com')}
          value={draftUrl}
          onChange={e => setDraftUrl(e.target.value)}
          onBlur={handleSaveUrl}
          onPressEnter={handleSaveUrl}
        />
      )}
      {domainFlagged && (
        <Alert
          type="warning"
          showIcon
          closable={false}
          message={t('This domain is not allowed to be embedded')}
          description={
            canManageCsp
              ? t(
                  '%(origin)s is blocked by the Content Security Policy. ' +
                    'Enable it to allow this content to load.',
                  { origin },
                )
              : t(
                  '%(origin)s is blocked by the Content Security Policy. ' +
                    'Ask an administrator to allow this domain.',
                  { origin },
                )
          }
          action={
            canManageCsp ? (
              <Button
                buttonStyle="primary"
                buttonSize="small"
                loading={enabling}
                onClick={handleEnableDomain}
                data-test="dashboard-iframe-enable-csp"
              >
                {t('Enable domain in CSP')}
              </Button>
            ) : undefined
          }
        />
      )}
      {isEmbeddableUrl(url) ? (
        <iframe
          className="dashboard-iframe-frame"
          src={url}
          title={t('Embedded content')}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      ) : (
        <div className="dashboard-iframe-empty">
          {editMode
            ? t('Enter a URL above to embed content')
            : t('No URL configured')}
        </div>
      )}
    </IframeStyles>
  );

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
          adjustableWidth={parentComponent.type === ROW_TYPE}
          adjustableHeight
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
            className="dashboard-component dashboard-component-iframe"
            data-test="dashboard-component-iframe"
            id={component.id}
          >
            {editMode && (
              <HoverMenu position="top">
                <DeleteComponentButton onDelete={handleDeleteComponent} />
              </HoverMenu>
            )}
            {renderBody()}
          </div>
        </ResizableContainer>
      )}
    </Draggable>
  );
}
