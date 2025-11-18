/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to You under the Apache License, Version 2.0 (the
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
import { useCallback, useMemo, useState } from 'react';
import { SupersetClient, t, JsonObject } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/ui';
import { Button as SupersetButton } from '@superset-ui/core/components/Button';
import { EditableTitle } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { OnClickHandler } from '@superset-ui/core/components/Button/types';
import type { Method, RequestConfig } from '@superset-ui/core/connection/types';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import { ROW_TYPE, COLUMN_TYPE } from 'src/dashboard/util/componentTypes';
import {
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
  GRID_BASE_UNIT,
} from 'src/dashboard/util/constants';
import type {
  LayoutItem,
  LayoutItemMeta,
} from 'src/dashboard/types';
import type {
  ResizeCallback,
  ResizeStartCallback,
} from 're-resizable';
import ButtonConfigMenuItem, {
  type ButtonConfig,
} from './ButtonConfigMenuItem';
import type { DashboardButtonMeta, ButtonActionType } from './types';

const ButtonStyles = styled.div`
  ${({ theme }) => css`
    &.dashboard-button {
      display: flex;
      align-items: stretch;
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
      min-height: ${GRID_BASE_UNIT * 5}px;

      .dashboard--editing & {
        cursor: move;
      }

      .superset-button {
        width: 100%;
        min-width: 120px;
        justify-content: center;
      }
    }
  `}
`;

const ButtonContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
  width: 100%;
`;

const normalizeActionType = (actionType?: string | null): ButtonActionType =>
  actionType === 'api' ? 'api' : 'link';

const normalizeButtonSize = (size?: string | null) =>
  size === 'middle' || !size ? 'default' : size;

const normalizeButtonStyle = (style?: string | null) =>
  style ?? 'primary';

const isValidUrl = (url: string): boolean => {
  if (!url || url.trim().length === 0) {
    return false;
  }
  const trimmedUrl = url.trim().toLowerCase();
  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  if (dangerousProtocols.some(protocol => trimmedUrl.startsWith(protocol))) {
    return false;
  }
  // Allow http, https, mailto, tel, and relative URLs
  try {
    // Try to create URL object for absolute URLs
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      new URL(url.trim());
      return true;
    }
    // Allow relative URLs and other safe protocols
    if (
      trimmedUrl.startsWith('/') ||
      trimmedUrl.startsWith('mailto:') ||
      trimmedUrl.startsWith('tel:') ||
      trimmedUrl.startsWith('#')
    ) {
      return true;
    }
    // Allow relative paths without leading slash (will be treated as relative)
    return true;
  } catch {
    // If URL parsing fails, it might still be a valid relative URL
    return !trimmedUrl.includes('://') || trimmedUrl.startsWith('mailto:') || trimmedUrl.startsWith('tel:');
  }
};

const normalizeMeta = (meta: LayoutItemMeta): DashboardButtonMeta => {
  const buttonMeta = meta as DashboardButtonMeta;
  return {
    ...buttonMeta,
    buttonSize: normalizeButtonSize(buttonMeta.buttonSize),
    buttonStyle: normalizeButtonStyle(buttonMeta.buttonStyle),
    disabled: buttonMeta.disabled ?? false,
    tooltip: buttonMeta.tooltip ?? '',
    actionType: normalizeActionType(buttonMeta.actionType),
    url: buttonMeta.url ?? '',
    target: buttonMeta.target ?? '_self',
    apiEndpoint: buttonMeta.apiEndpoint ?? '',
    apiMethod: (buttonMeta.apiMethod ?? 'POST').toUpperCase(),
    apiHeaders: buttonMeta.apiHeaders ?? '',
    apiPayload: buttonMeta.apiPayload ?? '',
    successMessage:
      buttonMeta.successMessage ?? t('Action executed successfully.'),
    errorMessage:
      buttonMeta.errorMessage ?? t('Unable to execute action.'),
    confirmBeforeExecute: buttonMeta.confirmBeforeExecute ?? false,
    confirmMessage:
      buttonMeta.confirmMessage ??
      t('Are you sure you want to run this action?'),
  };
};

interface DashboardButtonProps {
  id: string;
  parentId: string;
  component: LayoutItem;
  parentComponent: LayoutItem;
  index: number;
  depth: number;
  editMode: boolean;
  deleteComponent: (id: string, parentId: string) => void;
  handleComponentDrop: (dropResult: unknown) => void;
  updateComponents: (components: Record<string, LayoutItem>) => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;
}

const parseHeaders = (rawHeaders?: string): Record<string, string> | undefined => {
  if (!rawHeaders) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(rawHeaders);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      throw new Error();
    }
    return Object.entries(parsed).reduce<Record<string, string>>(
      (accumulator, [key, value]) => {
        accumulator[key] = String(value);
        return accumulator;
      },
      {},
    );
  } catch (error) {
    throw new Error(
      t('Headers must be a valid JSON object with string values.'),
    );
  }
};

const parsePayload = (rawPayload?: string) => {
  if (!rawPayload) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(rawPayload);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as JsonObject;
  } catch (error) {
    throw new Error(t('Payload must be a valid JSON object.'));
  }
};

const DashboardButton = ({
  id,
  parentId,
  component,
  parentComponent,
  index,
  depth,
  editMode,
  deleteComponent,
  handleComponentDrop,
  updateComponents,
  addDangerToast,
  addSuccessToast,
  availableColumnCount,
  columnWidth,
  onResizeStart,
  onResize,
  onResizeStop,
}: DashboardButtonProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const meta = useMemo(
    () => normalizeMeta(component.meta),
    [component.meta],
  );

  const updateMeta = useCallback(
    (updates: Partial<DashboardButtonMeta>) => {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            ...updates,
          },
        },
      });
    },
    [component, updateComponents],
  );

  const handleChangeText = useCallback(
    (nextValue: string) => {
      if (meta.text !== nextValue) {
        updateMeta({ text: nextValue });
      }
    },
    [meta.text, updateMeta],
  );

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const sanitizedUrl = meta.url?.trim() ?? '';
  const sanitizedEndpoint = meta.apiEndpoint?.trim() ?? '';
  const actionType = meta.actionType ?? 'link';

  const isUrlValid = sanitizedUrl.length > 0 && isValidUrl(sanitizedUrl);
  const missingConfiguration =
    actionType === 'api'
      ? sanitizedEndpoint.length === 0
      : !isUrlValid;

  const buttonDisabled = meta.disabled || isPending || missingConfiguration;

  const tooltip =
    meta.tooltip ||
    (missingConfiguration
      ? actionType === 'link'
        ? sanitizedUrl.length > 0 && !isUrlValid
          ? t('Invalid URL format. Please use http://, https://, or a relative path.')
          : t('Configure this button to enable it.')
        : t('Configure this button to enable it.')
      : undefined);

  const href =
    !editMode && actionType === 'link' && isUrlValid
      ? sanitizedUrl
      : undefined;

  const target = meta.target ?? '_self';
  const rel = target === '_blank' ? 'noopener noreferrer' : undefined;

  const handleConfigSave = useCallback(
    (updates: ButtonConfig) => {
      updateMeta({
        ...updates,
        apiEndpoint: updates.apiEndpoint?.trim(),
        apiHeaders: updates.apiHeaders?.trim(),
        apiPayload: updates.apiPayload?.trim(),
        url: updates.url?.trim(),
      });
    },
    [updateMeta],
  );

  const executeApiAction = useCallback(async () => {
    const endpoint = sanitizedEndpoint;
    if (!endpoint) {
      addDangerToast(t('Configure an API endpoint before using this button.'));
      return;
    }
    if (meta.confirmBeforeExecute) {
      const confirmed = window.confirm(meta.confirmMessage ?? '');
      if (!confirmed) {
        return;
      }
    }
    let headers: Record<string, string> | undefined;
    let payload: JsonObject | undefined;
    try {
      headers = parseHeaders(meta.apiHeaders);
      if (meta.apiPayload) {
        payload = parsePayload(meta.apiPayload);
      }
    } catch (error) {
      addDangerToast((error as Error).message);
      return;
    }
    const method = (meta.apiMethod ?? 'POST').toUpperCase() as Method;

    if (payload && method === 'GET') {
      addDangerToast(t('GET requests cannot include a request body.'));
      return;
    }

    setIsPending(true);
    try {
      const isAbsoluteUrl = /^https?:\/\//i.test(endpoint);
      const normalizedEndpoint =
        !isAbsoluteUrl && endpoint && !endpoint.startsWith('/')
          ? `/${endpoint}`
          : endpoint;

      // For external URLs, use the proxy endpoint to bypass CSP
      if (isAbsoluteUrl) {
        // Use the proxy endpoint to avoid CSP restrictions
        const proxyPayload: JsonObject = {
          url: normalizedEndpoint,
          method,
        };
        if (headers) {
          proxyPayload.headers = headers;
        }
        if (payload && method !== 'GET') {
          proxyPayload.payload = payload;
        }

        const response = await SupersetClient.request({
          endpoint: '/api/v1/proxy/',
          method: 'POST',
          jsonPayload: proxyPayload,
        });

        // Check if the proxy returned an error
        if (response.json && typeof response.json === 'object') {
          const proxyResponse = response.json as { 
            status?: number; 
            error?: string; 
            data?: any; 
            ok?: boolean;
          };
          
          if (proxyResponse.error) {
            throw new Error(proxyResponse.error);
          }
          
          // Check if the external API call was successful
          if (proxyResponse.ok === false || (proxyResponse.status && proxyResponse.status >= 400)) {
            const errorMsg = proxyResponse.data 
              ? (typeof proxyResponse.data === 'string' 
                  ? proxyResponse.data 
                  : JSON.stringify(proxyResponse.data))
              : `Request failed with status ${proxyResponse.status}`;
            throw new Error(errorMsg);
          }
        }

        addSuccessToast(meta.successMessage ?? t('Action executed successfully.'));
      } else {
        // For internal endpoints, use the normal request flow
        const requestConfig: RequestConfig = {
          endpoint: normalizedEndpoint,
          method,
        };

        if (headers) {
          requestConfig.headers = headers;
        }
        if (payload && method !== 'GET') {
          requestConfig.jsonPayload = payload;
        }
        await SupersetClient.request(requestConfig);
        addSuccessToast(meta.successMessage ?? t('Action executed successfully.'));
      }
    } catch (error) {
      const errorRecord = error as Record<string, any>;
      const responseStatus = errorRecord?.response?.statusText;
      const responseStatusNumber = errorRecord?.response?.status;
      const errorMessage = errorRecord?.message;
      
      // Build a more informative error message
      let errorMsg = meta.errorMessage ?? t('Unable to execute action.');
      if (responseStatusNumber) {
        errorMsg = `${errorMsg} (${responseStatusNumber}${responseStatus ? ` ${responseStatus}` : ''})`;
      } else if (responseStatus) {
        errorMsg = `${errorMsg} (${responseStatus})`;
      } else if (errorMessage && typeof errorMessage === 'string') {
        errorMsg = `${errorMsg}: ${errorMessage}`;
      }
      
      addDangerToast(errorMsg);
    } finally {
      setIsPending(false);
    }
  }, [
    addDangerToast,
    addSuccessToast,
    meta.apiHeaders,
    meta.apiMethod,
    meta.apiPayload,
    meta.confirmBeforeExecute,
    meta.confirmMessage,
    meta.errorMessage,
    meta.successMessage,
    sanitizedEndpoint,
  ]);

  const handleButtonClick: OnClickHandler = useCallback(
    event => {
      if (editMode) {
        event.preventDefault();
        return;
      }
      if (actionType === 'api') {
        event.preventDefault();
        event.stopPropagation();
        void executeApiAction();
      } else if (actionType === 'link') {
        // For link type, validate URL before navigation
        if (!href) {
          event.preventDefault();
          const urlValid = sanitizedUrl.length > 0 && isValidUrl(sanitizedUrl);
          if (sanitizedUrl.length > 0 && !urlValid) {
            addDangerToast(
              t('Invalid URL format. Please use http://, https://, or a relative path.'),
            );
          } else {
            addDangerToast(
              t('Configure a destination URL before using this button.'),
            );
          }
        }
        // If href is valid, let the browser handle navigation naturally
      }
    },
    [actionType, addDangerToast, editMode, executeApiAction, href, sanitizedUrl],
  );

  const updateFocus = useCallback(
    (nextFocus: boolean) => {
      if (!nextFocus && isConfigModalOpen) {
        return;
      }
      setIsFocused(nextFocus);
    },
    [isConfigModalOpen],
  );

  const handleConfigVisibilityChange = useCallback((open: boolean) => {
    setIsConfigModalOpen(open);
    if (open) {
      setIsFocused(true);
    }
  }, []);

  const widthMultiple =
    parentComponent.type === COLUMN_TYPE
      ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
      : component.meta.width || GRID_MIN_COLUMN_COUNT;

  const heightMultiple =
    component.meta.height && component.meta.height > 0
      ? component.meta.height
      : GRID_MIN_ROW_UNITS;

  const buttonLabel =
    meta.text && meta.text.length > 0 ? meta.text : t('Button');

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
      {({ dragSourceRef }) => (
        <WithPopoverMenu
          isFocused={isFocused}
          onChangeFocus={updateFocus}
          editMode={editMode}
          menuItems={[]}
        >
          <ButtonStyles
            data-test="dashboard-button"
            className="dashboard-button"
            id={component.id}
          >
            <ResizableContainer
              id={component.id}
              adjustableWidth={parentComponent.type === ROW_TYPE}
              adjustableHeight
              widthStep={columnWidth}
              widthMultiple={widthMultiple}
              heightStep={GRID_BASE_UNIT}
              heightMultiple={heightMultiple}
              minWidthMultiple={GRID_MIN_COLUMN_COUNT}
              minHeightMultiple={GRID_MIN_ROW_UNITS}
              maxWidthMultiple={availableColumnCount + widthMultiple}
              onResizeStart={onResizeStart}
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
                    <ButtonConfigMenuItem
                      meta={meta}
                      onSave={handleConfigSave}
                      onVisibilityChange={handleConfigVisibilityChange}
                    />
                    <DeleteComponentButton onDelete={handleDeleteComponent} />
                  </HoverMenu>
                )}
                <SupersetButton
                  buttonStyle={meta.buttonStyle}
                  buttonSize={meta.buttonSize as 'default' | 'small' | 'xsmall'}
                  tooltip={tooltip}
                  disabled={buttonDisabled}
                  loading={isPending}
                  href={href}
                  target={href ? target : undefined}
                  rel={href ? rel : undefined}
                  onClick={handleButtonClick}
                  showMarginRight={false}
                >
                  <ButtonContent>
                    {isPending && <Icons.LoadingOutlined spin />}
                    {editMode ? (
                      <EditableTitle
                        title={buttonLabel}
                        canEdit
                        onSaveTitle={handleChangeText}
                        showTooltip={false}
                      />
                    ) : (
                      buttonLabel
                    )}
                  </ButtonContent>
                </SupersetButton>
              </div>
            </ResizableContainer>
          </ButtonStyles>
        </WithPopoverMenu>
      )}
    </Draggable>
  );
};

export default DashboardButton;

