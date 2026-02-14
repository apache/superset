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
import { t, SupersetClient } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { Button, Table, Modal, Tooltip } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { ApiKeyCreateModal } from './ApiKeyCreateModal';

export interface ApiKey {
  uuid: string;
  name: string;
  key_prefix: string;
  active: boolean;
  created_on: string;
  expires_on: string | null;
  revoked_on: string | null;
  last_used_on: string | null;
  scopes: string | null;
}

export function ApiKeyList() {
  const theme = useTheme();
  const { addDangerToast, addSuccessToast } = useToasts();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await SupersetClient.get({
        endpoint: '/api/v1/security/api_keys/',
      });
      setApiKeys(response.json.result || []);
    } catch (error) {
      addDangerToast(t('Failed to fetch API keys'));
    } finally {
      setLoading(false);
    }
  }, [addDangerToast]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleRevokeKey = useCallback(
    async (keyUuid: string) => {
      Modal.confirm({
        title: t('Revoke API Key'),
        content: t(
          'Are you sure you want to revoke this API key? This action cannot be undone.',
        ),
        okText: t('Revoke'),
        okType: 'danger',
        cancelText: t('Cancel'),
        onOk: async () => {
          try {
            await SupersetClient.delete({
              endpoint: `/api/v1/security/api_keys/${keyUuid}`,
            });
            addSuccessToast(t('API key revoked successfully'));
            fetchApiKeys();
          } catch (error) {
            addDangerToast(t('Failed to revoke API key'));
          }
        },
      });
    },
    [addDangerToast, addSuccessToast, fetchApiKeys],
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (key: ApiKey) => {
    if (key.revoked_on) {
      return (
        <span
          css={css`
            color: ${theme.colorError};
          `}
        >
          {t('Revoked')}
        </span>
      );
    }
    if (key.expires_on && new Date(key.expires_on) < new Date()) {
      return (
        <span
          css={css`
            color: ${theme.colorWarning};
          `}
        >
          {t('Expired')}
        </span>
      );
    }
    return (
      <span
        css={css`
          color: ${theme.colorSuccess};
        `}
      >
        {t('Active')}
      </span>
    );
  };

  const columns = [
    {
      title: t('Name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('Key Prefix'),
      dataIndex: 'key_prefix',
      key: 'key_prefix',
      render: (prefix: string) => (
        <code
          css={css`
            background: ${theme.colorFillSecondary};
            padding: 2px 6px;
            border-radius: 3px;
          `}
        >
          {prefix}...
        </code>
      ),
    },
    {
      title: t('Created'),
      dataIndex: 'created_on',
      key: 'created_on',
      render: formatDate,
    },
    {
      title: t('Last Used'),
      dataIndex: 'last_used_on',
      key: 'last_used_on',
      render: formatDate,
    },
    {
      title: t('Status'),
      key: 'status',
      render: (_: unknown, record: ApiKey) => getStatusBadge(record),
    },
    {
      title: t('Actions'),
      key: 'actions',
      render: (_: unknown, record: ApiKey) => (
        <>
          {!record.revoked_on && (
            <Tooltip title={t('Revoke this API key')}>
              <Button
                type="link"
                danger
                onClick={() => handleRevokeKey(record.uuid)}
              >
                {t('Revoke')}
              </Button>
            </Tooltip>
          )}
        </>
      ),
    },
  ];

  return (
    <div>
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${theme.sizeUnit * 4}px;
        `}
      >
        <div>
          <p
            css={css`
              margin-bottom: ${theme.sizeUnit * 2}px;
            `}
          >
            {t(
              'API keys allow programmatic access to Superset without requiring OAuth/JWT authentication.',
            )}
          </p>
          <p
            css={css`
              margin-bottom: 0;
            `}
          >
            {t('Keys are shown only once at creation. Store them securely.')}
          </p>
        </div>
        <Button type="primary" onClick={() => setShowCreateModal(true)}>
          {t('Create API Key')}
        </Button>
      </div>
      <Table
        columns={columns}
        data={apiKeys}
        loading={loading}
        rowKey="uuid"
        pagination={{ pageSize: 10 }}
      />
      {showCreateModal && (
        <ApiKeyCreateModal
          show={showCreateModal}
          onHide={() => {
            setShowCreateModal(false);
            fetchApiKeys();
          }}
          onSuccess={() => {
            fetchApiKeys();
          }}
        />
      )}
    </div>
  );
}
