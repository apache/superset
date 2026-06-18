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

// Throwaway debug UI for sc-107283 activity-view endpoints. Verify the
// JSON responses look right by eye. Delete this directory + the route
// entry in views/routes.tsx when the activity-view feature ships.

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import {
  Card,
  Empty,
  Input,
  Loading,
  Radio,
  Space,
  Tag,
  Typography,
} from '@superset-ui/core/components';

type ResourceKind = 'dashboard' | 'chart' | 'dataset';
type IncludeMode = 'self' | 'related' | 'all';
type EntityKind = 'dashboard' | 'chart' | 'dataset';

interface ChangedBy {
  id: number;
  first_name: string;
  last_name: string;
}

interface ActivityRecord {
  version_uuid: string;
  entity_kind: EntityKind;
  entity_uuid: string | null;
  entity_name: string;
  entity_deleted: boolean;
  entity_deletion_state: string | null;
  source: 'self' | 'related';
  transaction_id: number;
  // Transaction-level avenue: restore / import / clone / null
  // (= ordinary save). Shared by every record in the same tx.
  action_kind: string | null;
  issued_at: string;
  changed_by: ChangedBy | null;
  kind: string;
  // Per-record verb: add / remove / move / edit.
  operation: string;
  path: string[];
  from_value: unknown;
  to_value: unknown;
  summary: string;
  impact: { charts?: number; datasets?: number } | null;
}

interface ActivityResponse {
  result: ActivityRecord[];
  count: number;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];

const KIND_COLOR: Record<string, string> = {
  filter: 'blue',
  metric: 'green',
  dimension: 'cyan',
  column: 'geekblue',
  chart: 'purple',
  time_range: 'gold',
  color_palette: 'magenta',
  restore: 'orange',
  field: 'default',
};

const ENTITY_KIND_COLOR: Record<EntityKind, string> = {
  dashboard: 'blue',
  chart: 'purple',
  dataset: 'green',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  return JSON.stringify(value);
}

function ChangedByDisplay({ changedBy }: { changedBy: ChangedBy | null }) {
  if (changedBy === null) {
    return (
      <Typography.Text type="secondary" italic>
        {t('system / unknown')}
      </Typography.Text>
    );
  }
  return (
    <Typography.Text>
      {changedBy.first_name} {changedBy.last_name} (id={changedBy.id})
    </Typography.Text>
  );
}

function RecordCard({ record }: { record: ActivityRecord }) {
  const headerExtra = (
    <Space size="small">
      <Tag color={ENTITY_KIND_COLOR[record.entity_kind] || 'default'}>
        {record.entity_kind}
      </Tag>
      <Tag color={record.source === 'self' ? 'default' : 'volcano'}>
        {record.source}
      </Tag>
      <Tag color={KIND_COLOR[record.kind] || 'default'}>{record.kind}</Tag>
      <Tag color="default">{record.operation}</Tag>
      {record.action_kind && <Tag color="gold">{record.action_kind}</Tag>}
      {record.entity_deleted && <Tag color="red">deleted</Tag>}
      {record.entity_deletion_state === 'soft_deleted' && (
        <Tag color="orange">soft-deleted</Tag>
      )}
    </Space>
  );

  const headline = record.summary
    ? record.summary
    : `${record.entity_kind}: ${record.entity_name || '(unnamed)'}`;

  return (
    <Card
      size="small"
      title={
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{headline}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.issued_at} · tx={record.transaction_id} ·{' '}
            <ChangedByDisplay changedBy={record.changed_by} />
          </Typography.Text>
        </Space>
      }
      extra={headerExtra}
      style={{ marginBottom: 8 }}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <div>
          <Typography.Text type="secondary">
            {t('entity_name:')}
          </Typography.Text>{' '}
          <Typography.Text
            delete={record.entity_deleted}
            italic={!record.entity_name}
          >
            {record.entity_name || t('(no name)')}
          </Typography.Text>
        </div>
        <div>
          <Typography.Text type="secondary">
            {t('entity_uuid:')}
          </Typography.Text>{' '}
          <Typography.Text code>
            {record.entity_uuid || t('null (tombstoned)')}
          </Typography.Text>
        </div>
        <div>
          <Typography.Text type="secondary">
            {t('version_uuid:')}
          </Typography.Text>{' '}
          <Typography.Text code>
            {record.version_uuid || t('null')}
          </Typography.Text>
        </div>
        <div>
          <Typography.Text type="secondary">{t('path:')}</Typography.Text>{' '}
          <Typography.Text code>{JSON.stringify(record.path)}</Typography.Text>
        </div>
        <div>
          <Typography.Text type="secondary">{t('from →')}</Typography.Text>{' '}
          <Typography.Text code>
            {formatValue(record.from_value)}
          </Typography.Text>{' '}
          <Typography.Text type="secondary">{t('→ to')}</Typography.Text>{' '}
          <Typography.Text code>{formatValue(record.to_value)}</Typography.Text>
        </div>
        {record.impact !== null && (
          <div>
            <Typography.Text type="secondary">{t('impact:')}</Typography.Text>{' '}
            <Typography.Text code>
              {JSON.stringify(record.impact)}
            </Typography.Text>
          </div>
        )}
      </Space>
    </Card>
  );
}

function ActivityDebug() {
  const { resource: resourceParam, uuid } = useParams<{
    resource: string;
    uuid: string;
  }>();

  const resource = useMemo<ResourceKind | null>(() => {
    if (
      resourceParam === 'dashboard' ||
      resourceParam === 'chart' ||
      resourceParam === 'dataset'
    ) {
      return resourceParam;
    }
    return null;
  }, [resourceParam]);

  const [include, setInclude] = useState<IncludeMode>('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (!resource || !uuid) return;
    const params = new URLSearchParams();
    params.set('include', include);
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (since) params.set('since', since);
    if (until) params.set('until', until);
    setLoading(true);
    setError(null);
    SupersetClient.get({
      endpoint: `/api/v1/${resource}/${uuid}/activity/?${params.toString()}`,
    })
      .then(({ json }) => {
        setData(json as ActivityResponse);
      })
      .catch(err => {
        const msg = err?.message || String(err);
        setError(msg);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [resource, uuid, include, page, pageSize, since, until, reloadCounter]);

  if (!resource) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Title level={3}>
          {t('Activity Debug — invalid URL')}
        </Typography.Title>
        <Typography.Paragraph>
          {t(
            'Use /activity-debug/{dashboard|chart|dataset}/{uuid} — e.g. /activity-debug/dashboard/4a8f3c2e-...',
          )}
        </Typography.Paragraph>
      </div>
    );
  }

  const records = data?.result ?? [];
  const totalCount = data?.count ?? 0;
  const lastPage = Math.max(0, Math.ceil(totalCount / pageSize) - 1);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <Typography.Title level={3} style={{ marginBottom: 4 }}>
        {t('Activity Debug')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {t('Throwaway tool for verifying sc-107283 activity-view responses.')}
      </Typography.Paragraph>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Typography.Text strong>{t('endpoint')}</Typography.Text>
            <Typography.Text code>
              {`GET /api/v1/${resource}/${uuid}/activity/`}
            </Typography.Text>
          </Space>

          <Space wrap size="middle">
            <Space>
              <Typography.Text>include</Typography.Text>
              <Radio.Group
                value={include}
                onChange={e => {
                  setInclude(e.target.value as IncludeMode);
                  setPage(0);
                }}
                size="small"
              >
                <Radio.Button value="all">all</Radio.Button>
                <Radio.Button value="self">self</Radio.Button>
                <Radio.Button value="related">related</Radio.Button>
              </Radio.Group>
            </Space>

            <Space>
              <Typography.Text>page_size</Typography.Text>
              <select
                aria-label={t('page_size')}
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
              >
                {PAGE_SIZE_OPTIONS.map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Space>

            <Space>
              <Typography.Text>since</Typography.Text>
              <Input
                placeholder={t('ISO 8601')}
                size="small"
                value={since}
                onChange={e => {
                  setSince(e.target.value);
                  setPage(0);
                }}
                style={{ width: 220 }}
              />
            </Space>

            <Space>
              <Typography.Text>until</Typography.Text>
              <Input
                placeholder={t('ISO 8601')}
                size="small"
                value={until}
                onChange={e => {
                  setUntil(e.target.value);
                  setPage(0);
                }}
                style={{ width: 220 }}
              />
            </Space>

            <button
              type="button"
              onClick={() => setReloadCounter(c => c + 1)}
              style={{ padding: '4px 12px' }}
            >
              {t('reload')}
            </button>
          </Space>
        </Space>
      </Card>

      <Space style={{ marginBottom: 12 }} wrap>
        <Typography.Text>
          {t('count')}: <Typography.Text strong>{totalCount}</Typography.Text>
        </Typography.Text>
        <Typography.Text>
          {t('page')}: {page} / {lastPage}
        </Typography.Text>
        <button
          type="button"
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          {t('← prev')}
        </button>
        <button
          type="button"
          onClick={() => setPage(p => p + 1)}
          disabled={page >= lastPage}
        >
          {t('next →')}
        </button>
      </Space>

      {loading && <Loading />}

      {error && (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Typography.Text type="danger" strong>
            {t('error')}:
          </Typography.Text>{' '}
          <Typography.Text type="danger">{error}</Typography.Text>
        </Card>
      )}

      {!loading && !error && records.length === 0 && (
        <Empty description={t('No activity records for this page.')} />
      )}

      {records.map(record => (
        <RecordCard
          key={`${record.transaction_id}-${record.entity_kind}-${record.entity_uuid}-${record.kind}-${record.path.join('.')}`}
          record={record}
        />
      ))}
    </div>
  );
}

export default ActivityDebug;
