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
import { t } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/ui';
import {
  Alert,
  Button,
  Flex,
  Space,
  Typography,
} from '@superset-ui/core/components';

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
    padding: ${theme.paddingMD}px;
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

export default function PendingReviewPanel({
  dashboardId,
  datasetId,
  failedMappings,
  reviewReasons,
  onBack,
}: PendingReviewPanelProps) {
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
          <Alert
            type="warning"
            message={t('Why review is needed')}
            description={reviewReasons.join('; ')}
            showIcon
            css={{ marginBottom: 16 }}
          />
        )}

        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Flex justify="space-between" align="center">
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
                <Button href={`/tablemodelview/edit/${datasetId}`}>
                  {t('Open dataset')}
                </Button>
              ) : null}
            </Space>
          </Flex>

          <Typography.Text strong>{t('Issues to fix')}</Typography.Text>
          <Flex vertical gap="small">
            {failedMappings.map(item => (
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
              </IssueCard>
            ))}
          </Flex>
        </Space>
      </Card>

      <Button onClick={onBack}>{t('Back')}</Button>
    </Container>
  );
}
