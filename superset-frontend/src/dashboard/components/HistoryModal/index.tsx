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
import { Button, Modal, Table } from '@superset-ui/core/components';
import { SupersetClient, t } from '@superset-ui/core';

export type DashboardVersionItem = {
  id: number;
  version_number: number;
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

  const fetchVersions = useCallback(async () => {
    if (!dashboardId) return;
    setLoading(true);
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/dashboard/${dashboardId}/versions`,
      });
      setVersions(json?.result ?? []);
    } catch (err) {
      addDangerToast(t('Failed to load version history'));
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
        onOk: async () => {
          setRestoringId(versionId);
          try {
            await SupersetClient.post({
              endpoint: `/api/v1/dashboard/${dashboardId}/restore/${versionId}`,
            });
            addSuccessToast(t('Dashboard restored'));
            onHide();
            onRestore?.();
            window.location.reload();
          } catch (err) {
            addDangerToast(t('Failed to restore version'));
          } finally {
            setRestoringId(null);
          }
        },
      });
    },
    [dashboardId, onHide, onRestore, addSuccessToast, addDangerToast],
  );

  const columns = [
    {
      title: t('Version'),
      dataIndex: 'version_number',
      key: 'version_number',
      width: 100,
    },
    {
      title: t('Author'),
      dataIndex: 'created_by',
      key: 'created_by',
      render: (text: string | null) => text ?? '—',
    },
    {
      title: t('Date'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string | null) =>
        text ? new Date(text).toLocaleString() : '—',
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_: unknown, record: DashboardVersionItem) => (
        <Button
          buttonSize="small"
          buttonStyle="primary"
          onClick={() => handleRestore(record.id)}
          loading={restoringId === record.id}
          disabled={restoringId !== null}
        >
          {t('Restore')}
        </Button>
      ),
    },
  ];

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Dashboard version history')}
      footer={null}
      width={600}
    >
      <Table
        columns={columns}
        dataSource={versions}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 10 }}
      />
    </Modal>
  );
};

export default HistoryModal;
