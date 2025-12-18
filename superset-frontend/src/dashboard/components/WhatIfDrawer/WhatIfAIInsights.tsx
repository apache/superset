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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@superset-ui/core';
import { styled, Alert } from '@apache-superset/core/ui';
import { Icons, IconType } from '@superset-ui/core/components/Icons';
import { Collapse, Skeleton } from '@superset-ui/core/components/';
import { RootState, WhatIfModification } from 'src/dashboard/types';
import { whatIfHighlightStyles } from 'src/dashboard/util/useWhatIfHighlightStyles';
import { fetchWhatIfInterpretation } from './whatIfApi';
import { useChartComparison, useAllChartsLoaded } from './useChartComparison';
import {
  GroupedWhatIfInsights,
  WhatIfAIStatus,
  WhatIfInsightType,
  WhatIfInterpretResponse,
} from './types';

// Static Skeleton paragraph configs to avoid recreation on each render
const SKELETON_PARAGRAPH_3 = { rows: 3 };
const SKELETON_PARAGRAPH_2 = { rows: 2 };

// Configuration for each insight type
const INSIGHT_TYPE_CONFIG: Record<
  WhatIfInsightType,
  { label: string; icon: React.ComponentType<IconType> }
> = {
  observation: { label: t('Observations'), icon: Icons.EyeOutlined },
  implication: { label: t('Implications'), icon: Icons.WarningOutlined },
  recommendation: {
    label: t('Recommendations'),
    icon: Icons.CheckCircleOutlined,
  },
};

// Order in which insight types should appear
const INSIGHT_TYPE_ORDER: WhatIfInsightType[] = [
  'observation',
  'implication',
  'recommendation',
];

/**
 * Create a stable key from modifications for comparison.
 * This allows us to detect when modifications have meaningfully changed.
 */
function getModificationsKey(modifications: WhatIfModification[]): string {
  return modifications
    .map(m => `${m.column}:${m.multiplier}`)
    .sort()
    .join('|');
}

const InsightsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 3}px;
  margin-top: ${({ theme }) => theme.sizeUnit * 4}px;
  padding-top: ${({ theme }) => theme.sizeUnit * 4}px;
  border-top: 1px solid ${({ theme }) => theme.colorBorderSecondary};
`;

const InsightsHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  color: ${({ theme }) => theme.colorText};
`;

const InsightCard = styled.div<{ insightType: string }>`
  padding: ${({ theme }) => theme.sizeUnit * 3}px;
  background-color: ${({ theme, insightType }) => {
    switch (insightType) {
      case 'observation':
        return theme.colorInfoBg;
      case 'implication':
        return theme.colorWarningBg;
      case 'recommendation':
        return theme.colorSuccessBg;
      default:
        return theme.colorBgElevated;
    }
  }};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border-left: 3px solid
    ${({ theme, insightType }) => {
      switch (insightType) {
        case 'observation':
          return theme.colorInfo;
        case 'implication':
          return theme.colorWarning;
        case 'recommendation':
          return theme.colorSuccess;
        default:
          return theme.colorBorder;
      }
    }};
`;

const InsightTitle = styled.div`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
`;

const InsightDescription = styled.div`
  color: ${({ theme }) => theme.colorTextSecondary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  line-height: 1.5;
`;

const Summary = styled.div`
  font-size: ${({ theme }) => theme.fontSize}px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colorText};
  padding: ${({ theme }) => theme.sizeUnit * 3}px;
  background-color: ${({ theme }) => theme.colorBgElevated};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  ${whatIfHighlightStyles}
`;

const StyledCollapse = styled(Collapse)`
  background: transparent;
  border: none;

  .ant-collapse-item {
    border: none;
    margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
    background: ${({ theme }) => theme.colorBgElevated};
    border-radius: ${({ theme }) => theme.borderRadius}px !important;
    overflow: hidden;

    .ant-collapse-header {
      padding: ${({ theme }) => theme.sizeUnit * 3}px;
      background: transparent;
    }

    .ant-collapse-content {
      border-top: 1px solid ${({ theme }) => theme.colorBorderSecondary};
    }

    .ant-collapse-content-box {
      padding: ${({ theme }) => theme.sizeUnit * 2}px;
      display: flex;
      flex-direction: column;
      gap: ${({ theme }) => theme.sizeUnit * 2}px;
    }
  }
`;

const CollapsePanelHeader = styled.div<{ insightType: WhatIfInsightType }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  color: ${({ theme, insightType }) => {
    switch (insightType) {
      case 'observation':
        return theme.colorInfo;
      case 'implication':
        return theme.colorWarning;
      case 'recommendation':
        return theme.colorSuccess;
      default:
        return theme.colorText;
    }
  }};
`;

interface WhatIfAIInsightsProps {
  affectedChartIds: number[];
  modifications: WhatIfModification[];
}

const WhatIfAIInsights = ({
  affectedChartIds,
  modifications,
}: WhatIfAIInsightsProps) => {
  const [status, setStatus] = useState<WhatIfAIStatus>('idle');
  const [response, setResponse] = useState<WhatIfInterpretResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const dashboardTitle = useSelector<RootState, string>(
    // @ts-ignore
    state => state.dashboardInfo?.dashboard_title || 'Dashboard',
  );

  const chartComparisons = useChartComparison(affectedChartIds);
  const allChartsLoaded = useAllChartsLoaded(affectedChartIds);

  // AbortController for cancelling in-flight /interpret requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup: cancel any pending requests on unmount
  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  // Track modification changes to reset status when user adjusts the slider
  const modificationsKey = getModificationsKey(modifications);
  const prevModificationsKeyRef = useRef<string>(modificationsKey);

  // Reset status when modifications change (user adjusts the slider)
  useEffect(() => {
    if (
      modificationsKey !== prevModificationsKeyRef.current &&
      modifications.length > 0
    ) {
      // Cancel any in-flight request when modifications change
      abortControllerRef.current?.abort();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: resetting state when modifications change
      setStatus('idle');
      setResponse(null);
      prevModificationsKeyRef.current = modificationsKey;
    }
  }, [modificationsKey, modifications.length]);

  const fetchInsights = useCallback(async () => {
    if (modifications.length === 0 || chartComparisons.length === 0) {
      return;
    }

    // Cancel any in-flight request before starting a new one
    abortControllerRef.current?.abort();

    // Create a new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setStatus('loading');
    setError(null);

    try {
      const result = await fetchWhatIfInterpretation(
        {
          modifications,
          charts: chartComparisons,
          dashboardName: dashboardTitle,
        },
        abortController.signal,
      );
      setResponse(result);
      setStatus('success');
    } catch (err) {
      // Don't update state if the request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : t('Failed to generate AI insights'),
      );
      setStatus('error');
    }
  }, [modifications, chartComparisons, dashboardTitle]);

  // Automatically fetch insights when all affected charts have finished loading.
  // We wait for allChartsLoaded to prevent race conditions where we'd send
  // stale data before charts have re-queried with the what-if modifications.
  // The setState call here is intentional - we're synchronizing with prop changes.
  useEffect(() => {
    if (
      modifications.length > 0 &&
      chartComparisons.length > 0 &&
      allChartsLoaded &&
      status === 'idle'
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: triggering async fetch based on prop changes
      fetchInsights();
    }
  }, [modifications, chartComparisons, allChartsLoaded, status, fetchInsights]);

  // Reset state when modifications are cleared.
  // The setState calls here are intentional - we're resetting local state when props change.
  useEffect(() => {
    if (modifications.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: resetting state when modifications cleared
      setStatus('idle');
      setResponse(null);
      setError(null);
    }
  }, [modifications]);

  // Group insights by type
  const insights = response?.insights;
  const groupedInsights = useMemo(() => {
    if (!insights) return {} as GroupedWhatIfInsights;
    return insights.reduce<GroupedWhatIfInsights>((acc, insight) => {
      if (!acc[insight.type]) {
        acc[insight.type] = [];
      }
      acc[insight.type].push(insight);
      return acc;
    }, {} as GroupedWhatIfInsights);
  }, [insights]);

  // Build collapse items from grouped insights
  const collapseItems = useMemo(
    () =>
      INSIGHT_TYPE_ORDER.filter(type => groupedInsights[type]?.length > 0).map(
        type => {
          const typeInsights = groupedInsights[type];
          const config = INSIGHT_TYPE_CONFIG[type];
          const IconComponent = config.icon;

          return {
            key: type,
            label: (
              <CollapsePanelHeader insightType={type}>
                <IconComponent iconSize="m" />
                {config.label}
              </CollapsePanelHeader>
            ),
            children: typeInsights.map((insight, index) => (
              <InsightCard key={index} insightType={insight.type}>
                <InsightTitle>{insight.title}</InsightTitle>
                <InsightDescription>{insight.description}</InsightDescription>
              </InsightCard>
            )),
          };
        },
      ),
    [groupedInsights],
  );

  if (modifications.length === 0) {
    return null;
  }

  return (
    <InsightsContainer data-test="what-if-ai-insights">
      <InsightsHeader>
        <Icons.BulbOutlined iconSize="m" />
        {t('AI Insights')}
      </InsightsHeader>

      {status === 'loading' && (
        <Skeleton active paragraph={SKELETON_PARAGRAPH_3} />
      )}

      {status === 'error' && (
        <Alert
          type="error"
          message={t('Failed to generate insights')}
          description={error}
          showIcon
        />
      )}

      {status === 'success' && response && (
        <>
          <Summary>{response.summary}</Summary>

          <StyledCollapse
            defaultActiveKey={INSIGHT_TYPE_ORDER}
            items={collapseItems}
            ghost
            bordered
          />
        </>
      )}

      {status === 'idle' && !allChartsLoaded && (
        <Skeleton active paragraph={SKELETON_PARAGRAPH_2} />
      )}
    </InsightsContainer>
  );
};

export default WhatIfAIInsights;
