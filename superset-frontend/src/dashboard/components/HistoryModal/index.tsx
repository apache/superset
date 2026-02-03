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
import {
  Button,
  Input,
  List,
  Loading,
  Modal,
  Typography,
} from '@superset-ui/core/components';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components';
import { css, t } from '@apache-superset/core/ui';

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

const versionCardStyle = css`
  padding: 16px 0;
  border-bottom: 1px solid var(--ant-color-border-secondary);
  &:last-child {
    border-bottom: none;
  }
`;

const versionMetaStyle = css`
  margin-bottom: 12px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
`;

const descriptionLabelStyle = css`
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--ant-color-text-tertiary);
`;

const descriptionBlockStyle = css`
  margin-bottom: 12px;
  padding: 10px 12px;
  background: var(--ant-color-fill-quaternary);
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--ant-color-text-secondary);
`;

const descriptionRowStyle = css`
  display: flex;
  align-items: flex-start;
  gap: 8px;
`;

const descriptionTextStyle = css`
  flex: 1;
  min-width: 0;
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
  const [editingVersionId, setEditingVersionId] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState('');
  const [savingVersionId, setSavingVersionId] = useState<number | null>(null);

  const fetchVersions = useCallback(async (): Promise<void> => {
    if (!dashboardId) return;
    setLoading(true);
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/dashboard/${dashboardId}/versions`,
      });
      setVersions(json?.result ?? []);
    } catch (err) {
      const clientError = await getClientErrorObject(err);
      const message =
        clientError.error ||
        clientError.message ||
        t('Failed to load version history');
      addDangerToast(String(message));
    } finally {
      setLoading(false);
    }
  }, [dashboardId, addDangerToast]);

  useEffect(() => {
    if (show && dashboardId) {
      fetchVersions();
    }
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
              onRestore?.();
              window.location.reload();
            } catch (err) {
              const clientError = await getClientErrorObject(err);
              const errorMessage =
                clientError.error ||
                clientError.message ||
                t('Failed to restore version');
              addDangerToast(String(errorMessage));
              throw new Error(String(errorMessage));
            } finally {
              setRestoringId(null);
            }
          })();
        },
      });
    },
    [dashboardId, onHide, onRestore, addSuccessToast, addDangerToast],
  );

  const formatDate = (created_at: string | null) =>
    created_at ? new Date(created_at).toLocaleString() : '—';

  const handleStartEdit = useCallback((item: DashboardVersionItem) => {
    setEditingVersionId(item.id);
    setEditingComment(item.comment?.trim() ?? '');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingVersionId(null);
    setEditingComment('');
  }, []);

  const handleSaveDescription = useCallback(
    async (versionId: number) => {
      setSavingVersionId(versionId);
      try {
        await SupersetClient.put({
          endpoint: `/api/v1/dashboard/${dashboardId}/versions/${versionId}`,
          jsonPayload: { comment: editingComment.trim() || null },
        });
        addSuccessToast(t('Description updated'));
        handleCancelEdit();
        await fetchVersions();
      } catch (err) {
        const clientError = await getClientErrorObject(err);
        const message =
          clientError.error ||
          clientError.message ||
          t('Failed to update description');
        addDangerToast(String(message));
      } finally {
        setSavingVersionId(null);
      }
    },
    [
      dashboardId,
      editingComment,
      fetchVersions,
      addSuccessToast,
      addDangerToast,
      handleCancelEdit,
    ],
  );

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Dashboard version history')}
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
        <Typography.Text type="secondary">
          {t(
            'No version history yet. Versions are created when you save the dashboard.',
          )}
        </Typography.Text>
      )}
      {!loading && versions.length > 0 && (
        <List
          dataSource={versions}
          renderItem={(item: DashboardVersionItem) => (
            <List.Item key={item.id}>
              <div css={versionCardStyle}>
                <div css={versionMetaStyle}>
                  <Typography.Text strong>
                    {t('Version')} {item.version_number}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {formatDate(item.created_at)}
                    {item.created_by ? ` · ${item.created_by}` : ''}
                  </Typography.Text>
                </div>
                <div css={descriptionLabelStyle}>{t('Description')}</div>
                <div css={descriptionBlockStyle}>
                  {editingVersionId === item.id ? (
                    <>
                      <Input.TextArea
                        value={editingComment}
                        onChange={e => setEditingComment(e.target.value)}
                        placeholder={t('Add a description for this version')}
                        rows={3}
                        maxLength={500}
                        autoSize={{ minRows: 2, maxRows: 6 }}
                        disabled={savingVersionId === item.id}
                        style={{ marginBottom: 8, resize: 'vertical' }}
                      />
                      <div css={descriptionRowStyle}>
                        <Button
                          buttonSize="small"
                          buttonStyle="primary"
                          onClick={() => handleSaveDescription(item.id)}
                          loading={savingVersionId === item.id}
                          disabled={savingVersionId !== null}
                        >
                          {t('Save')}
                        </Button>
                        <Button
                          buttonSize="small"
                          buttonStyle="secondary"
                          onClick={handleCancelEdit}
                          disabled={savingVersionId !== null}
                        >
                          {t('Cancel')}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div css={descriptionRowStyle}>
                      <span css={descriptionTextStyle}>
                        {item.comment?.trim() || t('No description')}
                      </span>
                      <Icons.EditOutlined
                        role="button"
                        aria-label={t('Edit description')}
                        onClick={() => handleStartEdit(item)}
                        style={{ cursor: 'pointer', flexShrink: 0 }}
                      />
                    </div>
                  )}
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
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
};

export default HistoryModal;
