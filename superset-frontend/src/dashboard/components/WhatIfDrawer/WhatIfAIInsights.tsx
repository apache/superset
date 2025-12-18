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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@superset-ui/core';
import { styled, Alert } from '@apache-superset/core/ui';
import { Icons } from '@superset-ui/core/components/Icons';
import { Skeleton } from '@superset-ui/core/components/';
import { RootState, WhatIfModification } from 'src/dashboard/types';
import { whatIfHighlightStyles } from 'src/dashboard/util/useWhatIfHighlightStyles';
import { fetchWhatIfInterpretation } from './whatIfApi';
import { useChartComparison, useAllChartsLoaded } from './useChartComparison';
import {
  WhatIfAIStatus,
  WhatIfInsight,
  WhatIfInterpretResponse,
} from './types';

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

interface WhatIfAIInsightsProps {
  affectedChartIds: number[];
}

const WhatIfAIInsights = ({ affectedChartIds }: WhatIfAIInsightsProps) => {
  const [status, setStatus] = useState<WhatIfAIStatus>('idle');
  const [response, setResponse] = useState<WhatIfInterpretResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const whatIfModifications = useSelector<RootState, WhatIfModification[]>(
    state => state.dashboardState.whatIfModifications ?? [],
  );

  const dashboardTitle = useSelector<RootState, string>(
    // @ts-ignore
    state => state.dashboardInfo?.dashboard_title || 'Dashboard',
  );

  const chartComparisons = useChartComparison(affectedChartIds);
  const allChartsLoaded = useAllChartsLoaded(affectedChartIds);

  // Track modification changes to reset status when user adjusts the slider
  const modificationsKey = getModificationsKey(whatIfModifications);
  const prevModificationsKeyRef = useRef<string>(modificationsKey);

  // Debug logging for race condition diagnosis
  const willTriggerFetch =
    whatIfModifications.length > 0 &&
    chartComparisons.length > 0 &&
    allChartsLoaded &&
    status === 'idle';

  console.log('[WhatIfAIInsights] State:', {
    affectedChartIds,
    allChartsLoaded,
    chartComparisonsLength: chartComparisons.length,
    whatIfModificationsLength: whatIfModifications.length,
    status,
    modificationsKey,
    willTriggerFetch,
  });

  // Log chart comparison details when about to fetch (helps diagnose race conditions)
  if (willTriggerFetch && chartComparisons.length > 0) {
    console.log(
      '[WhatIfAIInsights] Chart comparisons to send:',
      chartComparisons.map(c => ({
        chartId: c.chartId,
        chartName: c.chartName,
        metrics: c.metrics.map(m => ({
          name: m.metricName,
          original: m.originalValue,
          modified: m.modifiedValue,
          change: `${m.percentageChange.toFixed(2)}%`,
        })),
      })),
    );
  }

  // Reset status when modifications change (user adjusts the slider)
  useEffect(() => {
    if (
      modificationsKey !== prevModificationsKeyRef.current &&
      whatIfModifications.length > 0
    ) {
      console.log(
        '[WhatIfAIInsights] Modifications changed, resetting status to idle',
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: resetting state when modifications change
      setStatus('idle');
      setResponse(null);
      prevModificationsKeyRef.current = modificationsKey;
    }
  }, [modificationsKey, whatIfModifications.length]);

  const fetchInsights = useCallback(async () => {
    if (whatIfModifications.length === 0 || chartComparisons.length === 0) {
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const result = await fetchWhatIfInterpretation({
        modifications: whatIfModifications,
        charts: chartComparisons,
        dashboardName: dashboardTitle,
      });
      setResponse(result);
      setStatus('success');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('Failed to generate AI insights'),
      );
      setStatus('error');
    }
  }, [whatIfModifications, chartComparisons, dashboardTitle]);

  // Automatically fetch insights when all affected charts have finished loading.
  // We wait for allChartsLoaded to prevent race conditions where we'd send
  // stale data before charts have re-queried with the what-if modifications.
  // The setState call here is intentional - we're synchronizing with Redux state changes.
  useEffect(() => {
    if (
      whatIfModifications.length > 0 &&
      chartComparisons.length > 0 &&
      allChartsLoaded &&
      status === 'idle'
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: triggering async fetch based on Redux state
      fetchInsights();
    }
  }, [
    whatIfModifications,
    chartComparisons,
    allChartsLoaded,
    status,
    fetchInsights,
  ]);

  // Reset state when modifications are cleared.
  // The setState calls here are intentional - we're resetting local state when Redux state changes.
  useEffect(() => {
    if (whatIfModifications.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: resetting state when Redux modifications cleared
      setStatus('idle');
      setResponse(null);
      setError(null);
    }
  }, [whatIfModifications]);

  if (whatIfModifications.length === 0) {
    return null;
  }

  return (
    <InsightsContainer data-test="what-if-ai-insights">
      <InsightsHeader>
        <Icons.BulbOutlined iconSize="m" />
        {t('AI Insights')}
      </InsightsHeader>

      {status === 'loading' && <Skeleton active paragraph={{ rows: 3 }} />}

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

          {response.insights.map((insight: WhatIfInsight, index: number) => (
            <InsightCard key={index} insightType={insight.type}>
              <InsightTitle>{insight.title}</InsightTitle>
              <InsightDescription>{insight.description}</InsightDescription>
            </InsightCard>
          ))}
        </>
      )}

      {status === 'idle' && !allChartsLoaded && (
        <Skeleton active paragraph={{ rows: 2 }} />
      )}
    </InsightsContainer>
  );
};

export default WhatIfAIInsights;
