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
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Icons,
  List,
  Loading,
  Modal,
  Tooltip,
  Typography,
} from '@superset-ui/core/components';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { css, t } from '@apache-superset/core/ui';

const NOTE_TRUNCATE_LENGTH = 150;

function formatVersionDate(createdAt: string | null): string {
  return createdAt ? new Date(createdAt).toLocaleString() : '—';
}

async function getErrorMessage(
  err: unknown,
  fallback: string,
): Promise<string> {
  const clientError = await getClientErrorObject(
    err as Parameters<typeof getClientErrorObject>[0],
  );
  return String(clientError?.error ?? clientError?.message ?? fallback);
}

export type DashboardVersionItem = {
  id: number;
  version_number: number;
  comment: string | null;
  created_at: string | null;
  created_by: string | null;
};

type HistoryModalProps = {
  dashboardId: number;
  show: boolean;
  onHide: () => void;
  onRestore?: () => void;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
};

const versionCardStyle = (theme: {
  colorBgElevated: string;
  colorBorderSecondary: string;
}) => css`
  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 16px;
  background: ${theme.colorBgElevated};
  border: 1px solid ${theme.colorBorderSecondary};
  border-radius: 8px;
`;

const versionHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
`;

const versionMetaStyle = css`
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
`;

const descriptionLabelStyle = css`
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--ant-color-text-tertiary);
`;

const descriptionBlockStyle = (theme: { colorFillTertiary: string }) => css`
  display: block;
  width: 100%;
  max-width: 100%;
  min-height: 4.5em;
  margin-bottom: 0;
  padding: 12px 14px;
  background: ${theme.colorFillTertiary};
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--ant-color-text-secondary);
  box-sizing: border-box;
`;

const descriptionTextStyle = css`
  display: block;
  width: 100%;
  min-width: 0;
  color: var(--ant-color-text-secondary);
`;

const descriptionTextClampedStyle = css`
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const showMoreLinkStyle = css`
  font-size: 12px;
  margin-top: 4px;
  cursor: pointer;
  color: var(--ant-color-primary);
`;

const HistoryModal = ({
  dashboardId,
  show,
  onHide,
  onRestore,
  addSuccessToast,
  addDangerToast,
}: HistoryModalProps) => {
  const [versions, setVersions] = useState<DashboardVersionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<number | null>(
    null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchVersions = useCallback(async (): Promise<void> => {
    if (dashboardId == null) return;
    setLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/dashboard/${dashboardId}/versions`,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setVersions(json?.result ?? []);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = await getErrorMessage(
        err,
        t('Failed to load version history'),
      );
      addDangerToast(message);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
      abortControllerRef.current = null;
    }
  }, [dashboardId, addDangerToast]);

  useEffect(() => {
    if (show && dashboardId != null) {
      fetchVersions();
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [show, dashboardId, fetchVersions]);

  const handleRestore = useCallback(
    (versionId: number) => {
      Modal.confirm({
        title: t('Restore this version?'),
        content: t(
          'The current dashboard state will be replaced by this version. You can undo by restoring a newer version.',
        ),
        okText: t('Restore'),
        cancelText: t('Cancel'),
        onOk: () => {
          setRestoringId(versionId);
          return (async () => {
            try {
              await SupersetClient.post({
                endpoint: `/api/v1/dashboard/${dashboardId}/restore/${versionId}`,
              });
              addSuccessToast(t('Dashboard restored'));
              onHide();
              if (onRestore) {
                onRestore();
              } else {
                window.location.reload();
              }
            } catch (err) {
              const errorMessage = await getErrorMessage(
                err,
                t('Failed to restore version'),
              );
              addDangerToast(errorMessage);
              throw new Error(errorMessage);
            } finally {
              setRestoringId(null);
            }
          })();
        },
      });
    },
    [dashboardId, onHide, onRestore, addSuccessToast, addDangerToast],
  );

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={
        <>
          {t('Dashboard history')}{' '}
          <Tooltip
            title={t(
              'View and restore up to 20 older versions of this dashboard.',
            )}
          >
            <span style={{ cursor: 'help' }}>
              <Icons.InfoCircleOutlined iconSize="m" />
            </span>
          </Tooltip>
        </>
      }
      footer={
        <Button buttonStyle="secondary" onClick={onHide}>
          {t('Close')}
        </Button>
      }
      width={560}
    >
      {loading && (
        <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
          <Loading />
        </div>
      )}
      {!loading && versions.length === 0 && (
        <Typography.Text type="secondary" style={{ display: 'block' }}>
          {t(
            'No version history yet. Versions are created when you save the dashboard.',
          )}
        </Typography.Text>
      )}
      {!loading && versions.length > 0 && (
        <List
          css={css`
            margin-top: 8px;
            width: 100%;
            .ant-list-item {
              width: 100%;
              max-width: 100%;
              padding: 0;
              margin-bottom: 12px;
              border: none;
            }
            .ant-list-item:last-child {
              margin-bottom: 0;
            }
            .ant-list-item > * {
              width: 100%;
              max-width: 100%;
            }
          `}
          dataSource={versions}
          renderItem={(item: DashboardVersionItem) => {
            const note = item.comment?.trim() ?? '';
            const isLongNote = note.length > NOTE_TRUNCATE_LENGTH;
            const isExpanded = expandedVersionId === item.id;
            const shouldClamp = isLongNote && !isExpanded;

            return (
              <List.Item key={item.id}>
                <div css={versionCardStyle}>
                  <div css={versionHeaderStyle}>
                    <div css={versionMetaStyle}>
                      <Typography.Text strong>
                        {t('Version')} {item.version_number}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {formatVersionDate(item.created_at)}
                        {item.created_by ? ` · ${item.created_by}` : ''}
                      </Typography.Text>
                    </div>
                    <Button
                      buttonSize="small"
                      buttonStyle="primary"
                      onClick={() => handleRestore(item.id)}
                      loading={restoringId === item.id}
                      disabled={restoringId !== null}
                    >
                      {t('Restore')}
                    </Button>
                  </div>
                  <div css={descriptionLabelStyle}>{t('Description')}</div>
                  <div css={descriptionBlockStyle}>
                    <Typography.Text
                      type="secondary"
                      css={[
                        descriptionTextStyle,
                        shouldClamp && descriptionTextClampedStyle,
                      ]}
                    >
                      {note || t('No description')}
                    </Typography.Text>
                    {isLongNote && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        css={showMoreLinkStyle}
                        onClick={() =>
                          setExpandedVersionId(isExpanded ? null : item.id)
                        }
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedVersionId(isExpanded ? null : item.id);
                          }
                        }}
                      >
                        {isExpanded ? t('Show less') : t('Show more')}
                      </span>
                    )}
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      )}
    </Modal>
  );
};

export default HistoryModal;
