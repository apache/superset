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
import { useState, useCallback, useMemo } from 'react';
import { t } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/ui';
import {
  Button,
  Flex,
  Typography,
  Tag,
  Select,
  Collapse,
  InfoTooltip,
} from '@superset-ui/core/components';
import { AIInfoBanner } from '@superset-ui/core/components';

const PanelContainer = styled(Flex)`
  ${({ theme }) => css`
    width: 100%;
    max-width: 800px;
    gap: ${theme.marginLG}px;
    padding: ${theme.paddingLG}px;
  `}
`;

const MappingCard = styled.div`
  ${({ theme }) => css`
    background: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.paddingMD}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.marginSM}px;
  `}
`;

const MappingRow = styled(Flex)`
  ${({ theme }) => css`
    gap: ${theme.marginMD}px;
    align-items: center;
  `}
`;

const ColumnName = styled(Typography.Text)`
  ${({ theme }) => css`
    font-family: monospace;
    font-size: ${theme.fontSize}px;
    background: ${theme.colorBgLayout};
    padding: 2px 8px;
    border-radius: ${theme.borderRadiusSM}px;
  `}
`;

const ArrowIcon = styled.span`
  ${({ theme }) => css`
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeLG}px;
  `}
`;

const SelectContainer = styled.div`
  min-width: 220px;
`;

const ButtonRow = styled(Flex)`
  ${({ theme }) => css`
    gap: ${theme.marginMD}px;
    margin-top: ${theme.marginMD}px;
  `}
`;

const ConfidenceTag = styled(Tag)<{ $level: string }>`
  ${({ theme, $level }) => {
    let color = theme.colorError;
    if ($level === 'high') color = theme.colorSuccess;
    else if ($level === 'medium') color = theme.colorWarning;
    return css`
      background: ${color}20;
      border-color: ${color};
      color: ${color};
    `;
  }}
`;

const ReasonText = styled(Typography.Text)`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
  `}
`;

interface ColumnMapping {
  template_column: string;
  user_column: string | null;
  user_table: string | null;
  confidence: number;
  confidence_level: 'high' | 'medium' | 'low' | 'failed';
  match_reasons: string[];
  alternatives: Array<{
    column: string;
    table: string;
    confidence: number;
  }>;
}

interface MetricMapping {
  template_metric: string;
  user_expression: string | null;
  confidence: number;
  confidence_level: 'high' | 'medium' | 'low' | 'failed';
  match_reasons: string[];
  alternatives: string[];
}

interface MappingProposal {
  proposal_id: string;
  column_mappings: ColumnMapping[];
  metric_mappings: MetricMapping[];
  unmapped_columns: string[];
  unmapped_metrics: string[];
  review_reasons: string[];
  overall_confidence: number;
}

interface AdjustedMappings {
  columns: Record<string, { column: string; table: string }>;
  metrics: Record<string, string>;
}

interface MappingReviewPanelProps {
  proposal: MappingProposal;
  onApprove: (adjustments: AdjustedMappings) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function MappingReviewPanel({
  proposal,
  onApprove,
  onCancel,
  isSubmitting = false,
}: MappingReviewPanelProps) {
  const [adjustments, setAdjustments] = useState<AdjustedMappings>({
    columns: {},
    metrics: {},
  });

  // Only show problematic mappings (LOW confidence or unmapped)
  const problematicColumns = useMemo(
    () =>
      proposal.column_mappings.filter(
        m => m.confidence_level === 'low' || m.confidence_level === 'failed',
      ),
    [proposal.column_mappings],
  );

  const problematicMetrics = useMemo(
    () =>
      proposal.metric_mappings.filter(
        m => m.confidence_level === 'low' || m.confidence_level === 'failed',
      ),
    [proposal.metric_mappings],
  );

  const handleColumnChange = useCallback(
    (templateColumn: string, value: string) => {
      // value format: "table.column"
      const [table, column] = value.split('.');
      setAdjustments(prev => ({
        ...prev,
        columns: {
          ...prev.columns,
          [templateColumn]: { column, table },
        },
      }));
    },
    [],
  );

  const handleMetricChange = useCallback(
    (templateMetric: string, expression: string) => {
      setAdjustments(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          [templateMetric]: expression,
        },
      }));
    },
    [],
  );

  const handleApprove = useCallback(() => {
    onApprove(adjustments);
  }, [onApprove, adjustments]);

  const getConfidenceLabel = (level: string): string => {
    switch (level) {
      case 'high':
        return t('High');
      case 'medium':
        return t('Medium');
      case 'low':
        return t('Low');
      case 'failed':
        return t('Not Found');
      default:
        return level;
    }
  };

  const formatPercentage = (value: number): string =>
    `${Math.round(value * 100)}%`;

  return (
    <PanelContainer vertical align="center">
      <AIInfoBanner
        text={t(
          'Some column mappings need your attention. Please review and fix the highlighted items below to ensure your dashboard works correctly.',
        )}
        dismissible={false}
      />

      <Typography.Title level={4} css={{ margin: 0, textAlign: 'center' }}>
        {t('Review Required Mappings')}
      </Typography.Title>

      <Typography.Text type="secondary" css={{ textAlign: 'center' }}>
        {t(
          '%s columns and %s metrics need review. The remaining mappings have high confidence and will be applied automatically.',
          problematicColumns.length,
          problematicMetrics.length,
        )}
      </Typography.Text>

      {problematicColumns.length > 0 && (
        <Collapse
          defaultActiveKey={['columns']}
          css={{ width: '100%' }}
          items={[
            {
              key: 'columns',
              label: t('Column Mappings (%s issues)', problematicColumns.length),
              children: (
                <Flex vertical gap="small">
                  {problematicColumns.map(mapping => (
                    <MappingCard key={mapping.template_column}>
                      <MappingRow>
                        <ColumnName>{mapping.template_column}</ColumnName>
                        <ArrowIcon>→</ArrowIcon>
                        <SelectContainer>
                          <Select
                            value={
                              adjustments.columns[mapping.template_column]
                                ? `${adjustments.columns[mapping.template_column].table}.${adjustments.columns[mapping.template_column].column}`
                                : mapping.user_column
                                  ? `${mapping.user_table}.${mapping.user_column}`
                                  : undefined
                            }
                            onChange={value =>
                              handleColumnChange(
                                mapping.template_column,
                                value as string,
                              )
                            }
                            placeholder={t('Select column')}
                            css={{ width: '100%' }}
                            options={[
                              ...(mapping.user_column
                                ? [
                                    {
                                      label: `${mapping.user_table}.${mapping.user_column}`,
                                      value: `${mapping.user_table}.${mapping.user_column}`,
                                    },
                                  ]
                                : []),
                              ...mapping.alternatives.map(alt => ({
                                label: `${alt.table}.${alt.column}`,
                                value: `${alt.table}.${alt.column}`,
                              })),
                            ]}
                          />
                        </SelectContainer>
                        <ConfidenceTag $level={mapping.confidence_level}>
                          {getConfidenceLabel(mapping.confidence_level)} (
                          {formatPercentage(mapping.confidence)})
                        </ConfidenceTag>
                        {mapping.match_reasons.length > 0 && (
                          <InfoTooltip
                            tooltip={mapping.match_reasons.join(', ')}
                          />
                        )}
                      </MappingRow>
                      {mapping.match_reasons.length > 0 && (
                        <ReasonText>
                          {t('Reason')}: {mapping.match_reasons.join(', ')}
                        </ReasonText>
                      )}
                    </MappingCard>
                  ))}
                </Flex>
              ),
            },
          ]}
        />
      )}

      {problematicMetrics.length > 0 && (
        <Collapse
          defaultActiveKey={['metrics']}
          css={{ width: '100%' }}
          items={[
            {
              key: 'metrics',
              label: t('Metric Mappings (%s issues)', problematicMetrics.length),
              children: (
                <Flex vertical gap="small">
                  {problematicMetrics.map(mapping => (
                    <MappingCard key={mapping.template_metric}>
                      <MappingRow>
                        <ColumnName>{mapping.template_metric}</ColumnName>
                        <ArrowIcon>→</ArrowIcon>
                        <SelectContainer>
                          <Select
                            value={
                              adjustments.metrics[mapping.template_metric] ||
                              mapping.user_expression ||
                              undefined
                            }
                            onChange={value =>
                              handleMetricChange(
                                mapping.template_metric,
                                value as string,
                              )
                            }
                            placeholder={t('Select expression')}
                            css={{ width: '100%' }}
                            options={[
                              ...(mapping.user_expression
                                ? [
                                    {
                                      label: mapping.user_expression,
                                      value: mapping.user_expression,
                                    },
                                  ]
                                : []),
                              ...mapping.alternatives.map(alt => ({
                                label: alt,
                                value: alt,
                              })),
                            ]}
                          />
                        </SelectContainer>
                        <ConfidenceTag $level={mapping.confidence_level}>
                          {getConfidenceLabel(mapping.confidence_level)} (
                          {formatPercentage(mapping.confidence)})
                        </ConfidenceTag>
                      </MappingRow>
                      {mapping.match_reasons.length > 0 && (
                        <ReasonText>
                          {t('Reason')}: {mapping.match_reasons.join(', ')}
                        </ReasonText>
                      )}
                    </MappingCard>
                  ))}
                </Flex>
              ),
            },
          ]}
        />
      )}

      <ButtonRow justify="center">
        <Button onClick={onCancel} disabled={isSubmitting}>
          {t('Cancel')}
        </Button>
        <Button
          buttonStyle="primary"
          onClick={handleApprove}
          loading={isSubmitting}
        >
          {t('Approve & Generate')}
        </Button>
      </ButtonRow>
    </PanelContainer>
  );
}
