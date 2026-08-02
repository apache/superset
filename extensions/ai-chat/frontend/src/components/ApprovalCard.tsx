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
import React from 'react';
import { Alert, Button, Space, Tag, Typography } from 'antd';
import { theme, translation } from '@apache-superset/core';
import type { PendingApproval } from '../types';
import PreBlock from './PreBlock';

const { t } = translation;
const { useTheme } = theme;

interface ApprovalCardProps {
  pending: PendingApproval;
  disabled: boolean;
  onDecision: (decision: 'approve' | 'reject') => void;
}

/**
 * Confirmation card for a proposed mutating or destructive tool call. The
 * decision is enforced server-side: approving sends the single-use approval
 * id, and nothing executes without it.
 */
export default function ApprovalCard({
  pending,
  disabled,
  onDecision,
}: ApprovalCardProps) {
  const theme = useTheme();
  const destructive =
    pending.classification === 'destructive' ||
    pending.classification === 'unknown';
  const label = pending.toolTitle || pending.tool.replace(/_/g, ' ');
  const line = { marginBottom: theme.marginXXS };
  return (
    <Alert
      type={destructive ? 'error' : 'warning'}
      showIcon
      closable={false}
      role="alertdialog"
      aria-label={t('Approval required')}
      data-test="approval-card"
      description={
        <div>
          <Typography.Paragraph style={line}>
            <strong>{t('Approval required')}</strong>{' '}
            <Tag color={destructive ? 'red' : 'orange'}>
              {t(pending.classification.replace('_', '-'))}
            </Tag>
          </Typography.Paragraph>
          <Typography.Paragraph style={line}>
            {t('The assistant wants to run %s.', label)}
          </Typography.Paragraph>
          <div style={{ margin: `${theme.marginXXS}px 0` }}>
            <PreBlock
              value={pending.arguments}
              maxHeight={160}
              testId="approval-arguments"
            />
          </div>
          <Typography.Paragraph type="secondary" style={line}>
            {pending.reversible
              ? t('This action can generally be reversed with a later edit.')
              : t('This action may not be reversible.')}
          </Typography.Paragraph>
          {pending.warnings.map(warning => (
            <Typography.Paragraph key={warning} type="warning" style={line}>
              {warning}
            </Typography.Paragraph>
          ))}
          <Space>
            <Button
              danger={destructive}
              type="primary"
              size="small"
              disabled={disabled}
              onClick={() => onDecision('approve')}
              data-test="approval-approve"
            >
              {t('Approve')}
            </Button>
            <Button
              size="small"
              disabled={disabled}
              onClick={() => onDecision('reject')}
              data-test="approval-reject"
            >
              {t('Reject')}
            </Button>
          </Space>
        </div>
      }
    />
  );
}
