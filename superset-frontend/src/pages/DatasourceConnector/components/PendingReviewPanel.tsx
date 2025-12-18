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
import { t, SupersetClient } from '@superset-ui/core';
import { useState, useCallback } from 'react';
import { styled, css } from '@apache-superset/core/ui';
import {
  Button,
  Flex,
  Space,
  Typography,
} from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';

interface PendingReviewPanelProps {
  dashboardId: number;
  datasetId: number | null;
  failedMappings: Array<{
    type: string;
    id: string;
    name: string;
    error: string;
    alternatives?: string[];
  }>;
  reviewReasons: string[];
  onBack: () => void;
}

const Container = styled(Flex)`
  ${({ theme }) => css`
    width: 100%;
    max-width: 800px;
    gap: ${theme.marginLG}px;
    padding: ${theme.paddingLG}px;
  `}
`;

const Card = styled.div`
  ${({ theme }) => css`
    background: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.paddingXL}px ${theme.paddingXL}px ${theme.paddingLG}px
      ${theme.paddingXL}px;
    width: 100%;
  `}
`;

const IssueCard = styled.div`
  ${({ theme }) => css`
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadiusSM}px;
    padding: ${theme.paddingSM}px;
    background: ${theme.colorBgLayout};
  `}
`;

const WarningBox = styled.div`
  ${({ theme }) => css`
    border: 1px solid ${theme.colorWarning};
    background: ${theme.colorWarning}20;
    color: ${theme.colorWarning};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.paddingSM}px ${theme.paddingMD}px;
  `}
`;

export default function PendingReviewPanel({
  dashboardId,
  datasetId,
  failedMappings,
  reviewReasons,
  onBack,
}: PendingReviewPanelProps) {
  const [issues, setIssues] = useState(failedMappings);
  const { addSuccessToast, addDangerToast } = useToasts();

  const removeIssue = useCallback((id: string) => {
    setIssues(prev => prev.filter(item => item.id !== id));
  }, []);

  const deleteChart = useCallback(
    async (chartId: string) => {
      try {
        await SupersetClient.delete({
          endpoint: `/api/v1/chart/${chartId}`,
        });
        addSuccessToast(t('Chart %s deleted', chartId));
        removeIssue(chartId);
      } catch (err) {
        addDangerToast(t('Failed to delete chart %s', chartId));
      }
    },
    [addSuccessToast, addDangerToast, removeIssue],
  );

  const deleteFilter = useCallback(
    async (filterId: string) => {
      try {
        const resp = await SupersetClient.get({
          endpoint: `/api/v1/dashboard/${dashboardId}`,
        });
        const dashboard = resp.json?.result;
        const metadata =
          typeof dashboard?.json_metadata === 'string'
            ? JSON.parse(dashboard.json_metadata)
            : dashboard?.json_metadata || {};
        const filters = metadata.native_filter_configuration || [];
        const nextFilters = filters.filter((f: any) => f?.id !== filterId);
        metadata.native_filter_configuration = nextFilters;

        await SupersetClient.put({
          endpoint: `/api/v1/dashboard/${dashboardId}`,
          jsonPayload: {
            json_metadata: JSON.stringify(metadata),
          },
        });
        addSuccessToast(t('Filter %s removed', filterId));
        removeIssue(filterId);
      } catch (err) {
        addDangerToast(t('Failed to remove filter %s', filterId));
      }
    },
    [addSuccessToast, addDangerToast, dashboardId, removeIssue],
  );

  return (
    <Container vertical align="center">
      <Typography.Title level={4}>
        {t('Dashboard needs your review')}
      </Typography.Title>
      <Typography.Text type="secondary" css={{ textAlign: 'center' }}>
        {t(
          'Some mappings could not be auto-fixed. Use the links below to open the generated dashboard and dataset to correct them.',
        )}
      </Typography.Text>

      <Card>
        {reviewReasons.length > 0 && (
          <WarningBox>
            <Typography.Text strong>
              {t('Why review is needed')}
            </Typography.Text>
            <div>{reviewReasons.join('; ')}</div>
          </WarningBox>
        )}

        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Flex justify="space-between" align="center" style={{ marginTop: 8 }}>
            <Typography.Text strong>
              {t('Open generated assets')}
            </Typography.Text>
            <Space>
              <Button
                href={`/superset/dashboard/${dashboardId}/`}
                buttonStyle="primary"
              >
                {t('Open dashboard')}
              </Button>
              {datasetId ? (
                <Button href={`/dataset/${datasetId}`}>
                  {t('Open dataset')}
                </Button>
              ) : null}
            </Space>
          </Flex>

          <Typography.Text strong>{t('Issues to fix')}</Typography.Text>
          <Flex vertical gap="small">
            {issues.map(item => (
              <IssueCard key={`${item.type}-${item.id}`}>
                <Typography.Text strong>
                  {item.type}: {item.name}
                </Typography.Text>
                <div>{item.error}</div>
                {item.alternatives && item.alternatives.length > 0 && (
                  <div>
                    {t('Alternatives')}: {item.alternatives.join(', ')}
                  </div>
                )}
                <Space style={{ marginTop: 8 }}>
                  <Button
                    size="small"
                    onClick={() =>
                      item.type === 'chart'
                        ? deleteChart(item.id)
                        : deleteFilter(item.id)
                    }
                  >
                    {item.type === 'chart'
                      ? t('Delete chart now')
                      : t('Delete filter now')}
                  </Button>
                  <Button
                    size="small"
                    buttonStyle="tertiary"
                    onClick={() => addSuccessToast(t('Keep and fix later'))}
                  >
                    {t('Fix later')}
                  </Button>
                </Space>
              </IssueCard>
            ))}
          </Flex>
        </Space>
      </Card>

      <Button onClick={onBack}>{t('Back')}</Button>
    </Container>
  );
}
