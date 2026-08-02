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
import React, { useEffect, useRef, useState } from 'react';
import { Collapse, Spin, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { theme, translation } from '@apache-superset/core';
import type { DisplayItem, FoldSignal, ToolStatus } from '../types';
import PreBlock from './PreBlock';

const { t } = translation;
const { useTheme } = theme;

type ToolItem = Extract<DisplayItem, { kind: 'tool' }>;

const STATUS_LABEL: Record<ToolStatus, string> = {
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  awaiting_approval: 'Awaiting approval',
  rejected: 'Rejected',
};

function statusTag(status: ToolStatus) {
  switch (status) {
    case 'running':
      return (
        <Tag icon={<Spin size="small" />} color="processing">
          {t(STATUS_LABEL[status])}
        </Tag>
      );
    case 'succeeded':
      return (
        <Tag icon={<CheckCircleOutlined />} color="success">
          {t(STATUS_LABEL[status])}
        </Tag>
      );
    case 'failed':
      return (
        <Tag icon={<CloseCircleOutlined />} color="error">
          {t(STATUS_LABEL[status])}
        </Tag>
      );
    case 'awaiting_approval':
      return (
        <Tag icon={<ExclamationCircleOutlined />} color="warning">
          {t(STATUS_LABEL[status])}
        </Tag>
      );
    case 'rejected':
    default:
      return (
        <Tag icon={<StopOutlined />} color="default">
          {t(STATUS_LABEL[status])}
        </Tag>
      );
  }
}

/**
 * One MCP tool invocation: readable name, live status, and an expandable
 * section holding the server-redacted arguments and a bounded result excerpt.
 */
export default function ToolCallCard({
  item,
  fold,
}: {
  item: ToolItem;
  fold: FoldSignal;
}) {
  const theme = useTheme();
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  // A card appearing after a collapse-all keeps its own default, since only
  // instructions issued while it is on screen apply to it
  const seenFold = useRef(fold.seq);

  useEffect(() => {
    if (fold.seq === seenFold.current) return;
    seenFold.current = fold.seq;
    setActiveKeys(fold.collapsed ? [] : [item.id]);
  }, [fold, item.id]);
  const label = item.title || item.tool.replace(/_/g, ' ');
  const details = (
    <div>
      <Typography.Text type="secondary">{t('Arguments')}</Typography.Text>
      <PreBlock
        value={item.arguments}
        maxHeight={200}
        testId="tool-arguments"
      />
      {item.result !== undefined && (
        <>
          <Typography.Text type="secondary">{t('Result')}</Typography.Text>
          {item.truncated && (
            <Typography.Text
              type="warning"
              style={{ marginLeft: theme.marginXS }}
            >
              {t('(truncated)')}
            </Typography.Text>
          )}
          <PreBlock value={item.result} maxHeight={200} testId="tool-result" />
        </>
      )}
      {item.error && (
        <Typography.Text type="danger" data-test="tool-error">
          {item.error}
        </Typography.Text>
      )}
    </div>
  );
  return (
    <div
      data-test={`tool-call-${item.tool}`}
      style={{ margin: `${theme.marginXXS}px 0` }}
    >
      <Collapse
        size="small"
        activeKey={activeKeys}
        onChange={keys => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
        items={[
          {
            key: item.id,
            label: (
              <span>
                <ToolOutlined
                  aria-hidden
                  style={{ marginRight: theme.marginXXS }}
                />
                <Typography.Text strong>{label}</Typography.Text>{' '}
                {statusTag(item.status)}
              </span>
            ),
            children: details,
          },
        ]}
      />
    </div>
  );
}
