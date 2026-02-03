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
  List,
  Loading,
  Modal,
  Typography,
} from '@superset-ui/core/components';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
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
  padding: 12px 0;
  border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
  &:last-child {
    border-bottom: none;
  }
`;

const versionMetaStyle = css`
  margin-bottom: 8px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
`;

const versionCommentBlock = css`
  margin: 8px 0 12px;
  padding: 10px 12px;
  background: var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.02));
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65));
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
                <div css={versionCommentBlock}>
                  {item.comment?.trim() || t('No version note')}
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
