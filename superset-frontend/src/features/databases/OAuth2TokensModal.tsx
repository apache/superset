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
import { useEffect, useState, type Key } from 'react';
import rison from 'rison';
import { t, tn } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { SupersetClient } from '@superset-ui/core';
import {
  ActionButton,
  Button,
  DeleteModal,
  Flex,
  Input,
  InfoTooltip,
  Modal,
  Space,
  Table,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { DatabaseObject } from './types';

type TokenMetadata = {
  id: number;
  user: {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  access_token_expiration: string | null;
};

type TokenPage = {
  count: number;
  result: TokenMetadata[];
};

type Deletion = { token_ids: number[] } | { all: true };

type Props = {
  database: DatabaseObject;
  onHide: () => void;
  addSuccessToast: (message: string) => void;
  addDangerToast: (message: string) => void;
};

const PAGE_SIZE = 25;

/** Manage stored OAuth2 credentials without exposing access or refresh tokens. */
export default function OAuth2TokensModal({
  database,
  onHide,
  addSuccessToast,
  addDangerToast,
}: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<TokenPage>({
    count: 0,
    result: [],
  });
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [totalError, setTotalError] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const endpoint = `/api/v1/database/${database.id}/oauth2_tokens/`;

  useEffect(() => {
    let active = true;
    setTotalCount(null);
    setTotalError(false);
    const query = rison.encode_uri({ page: 0, page_size: 1 });
    SupersetClient.get({ endpoint: `${endpoint}?q=${query}` })
      .then(({ json }) => {
        if (active) setTotalCount(json.count);
      })
      .catch(() => {
        if (active) setTotalError(true);
      });
    return () => {
      active = false;
    };
  }, [endpoint, reload]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const timer = window.setTimeout(
      () => {
        const query = rison.encode_uri({
          page,
          page_size: PAGE_SIZE,
          filters: search
            ? [{ col: 'id', opr: 'oauth2_tokens_user', value: search }]
            : [],
        });
        SupersetClient.get({ endpoint: `${endpoint}?q=${query}` })
          .then(({ json: response }) => {
            const json = response as TokenPage;
            if (!active) return;
            const lastPage = Math.max(0, Math.ceil(json.count / PAGE_SIZE) - 1);
            if (page > lastPage) {
              setPage(lastPage);
              return;
            }
            setData(json);
            setLoading(false);
          })
          .catch(() => {
            if (!active) return;
            setError(true);
            setLoading(false);
          });
      },
      search ? 300 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [endpoint, page, search, reload]);

  const confirmDelete = async () => {
    if (!deletion || deleting) return;
    setDeleting(true);
    try {
      await SupersetClient.post(
        'all' in deletion
          ? { endpoint: `${endpoint}all/` }
          : { endpoint: `${endpoint}delete/`, jsonPayload: deletion },
      );
      addSuccessToast(
        t(
          'OAuth2 tokens deleted. Affected users must authorize this connection again.',
        ),
      );
      setSelectedKeys([]);
      setDeletion(null);
      setLoading(true);
      setReload(value => value + 1);
    } catch {
      addDangerToast(t('Failed to delete OAuth2 tokens. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  const controlsDisabled = loading || deleting || deletion !== null || error;
  const deletionCount =
    deletion && 'all' in deletion
      ? (totalCount ?? 0)
      : (deletion?.token_ids.length ?? 0);

  return (
    <>
      <Modal
        show
        onHide={() => {
          if (!deleting) onHide();
        }}
        name="oauth2-tokens"
        title={t('Manage OAuth2 tokens: %s', database.database_name)}
        width={800}
        footer={
          <Button onClick={onHide} disabled={deleting}>
            {t('Close')}
          </Button>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={t(
              'Deleting credentials removes both access and refresh tokens from Superset. Affected users must authorize this connection again. Tokens are not revoked at the OAuth2 provider.',
            )}
          />
          <Input.Search
            aria-label={t('Search OAuth2 tokens')}
            placeholder={t('Search by username, name, or email')}
            value={search}
            maxLength={250}
            disabled={deleting || deletion !== null}
            allowClear
            onChange={event => {
              setSearch(event.target.value);
              setPage(0);
              setSelectedKeys([]);
              setLoading(true);
            }}
          />
          <Flex justify="space-between" align="center" gap="small" wrap>
            <Space wrap>
              <span>
                {selectedKeys.length === 0
                  ? t('%s Select', 0)
                  : t('%s Selected', selectedKeys.length)}
              </span>
              <Button
                buttonStyle="danger"
                disabled={controlsDisabled || selectedKeys.length === 0}
                onClick={() =>
                  setDeletion({ token_ids: selectedKeys.map(Number) })
                }
              >
                {t('Delete selected')}
              </Button>
            </Space>
            <Button
              buttonStyle="danger"
              disabled={
                controlsDisabled || totalCount === null || totalCount === 0
              }
              onClick={() => setDeletion({ all: true })}
            >
              {t('Delete all tokens')}
            </Button>
          </Flex>
          {(error || totalError) && (
            <Alert
              type="error"
              message={t('Failed to load OAuth2 tokens.')}
              action={
                <Button onClick={() => setReload(value => value + 1)}>
                  {t('Retry')}
                </Button>
              }
            />
          )}
          <Table<TokenMetadata>
            rowKey="id"
            data={error ? [] : data.result}
            loading={loading}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: setSelectedKeys,
              getCheckboxProps: () => ({ disabled: controlsDisabled }),
            }}
            pagination={{
              current: page + 1,
              pageSize: PAGE_SIZE,
              total: data.count,
              showSizeChanger: false,
              disabled: deleting || deletion !== null,
              onChange: nextPage => {
                setPage(nextPage - 1);
                setSelectedKeys([]);
                setLoading(true);
              },
            }}
            columns={[
              { title: t('Username'), dataIndex: ['user', 'username'] },
              {
                title: t('Name'),
                key: 'name',
                render: (_value: unknown, row: TokenMetadata) =>
                  [row.user.first_name, row.user.last_name]
                    .filter(Boolean)
                    .join(' '),
              },
              { title: t('Email'), dataIndex: ['user', 'email'] },
              {
                title: (
                  <Space size="small">
                    {t('Expires on')}
                    <InfoTooltip
                      tooltip={t('Timestamps are shown in server time.')}
                    />
                  </Space>
                ),
                dataIndex: 'access_token_expiration',
                render: (value: string | null) =>
                  value ? value.replace('T', ' ') : t('Unknown'),
              },
              {
                title: t('Actions'),
                key: 'actions',
                render: (_value: unknown, row: TokenMetadata) => (
                  <ActionButton
                    label={t('Delete OAuth2 tokens for %s', row.user.username)}
                    tooltip={t(
                      'Delete OAuth2 tokens for %s',
                      row.user.username,
                    )}
                    icon={<Icons.DeleteOutlined />}
                    disabled={controlsDisabled}
                    onClick={() => setDeletion({ token_ids: [row.id] })}
                  />
                ),
              },
            ]}
          />
        </Space>
      </Modal>
      {deletion && (
        <DeleteModal
          open
          onHide={() => {
            if (!deleting) setDeletion(null);
          }}
          onConfirm={confirmDelete}
          loading={deleting}
          title={t('Delete OAuth2 tokens?')}
          name="delete-oauth2-tokens"
          description={
            'all' in deletion
              ? tn(
                  'Delete all %s stored credential pair for "%s", including users outside this page and search? Affected users must authorize this connection again.',
                  'Delete all %s stored credential pairs for "%s", including users outside this page and search? Affected users must authorize this connection again.',
                  deletionCount,
                  deletionCount,
                  database.database_name,
                )
              : tn(
                  'Delete %s stored credential pair for "%s"? Affected users must authorize this connection again.',
                  'Delete %s stored credential pairs for "%s"? Affected users must authorize this connection again.',
                  deletionCount,
                  deletionCount,
                  database.database_name,
                )
          }
        />
      )}
    </>
  );
}
