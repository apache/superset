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
import { useState, useEffect, useRef } from 'react';
import { t } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import {
  AsyncProcessPanel,
  type ProcessStep,
} from '@superset-ui/core/components';
import { usePolling } from 'src/hooks/usePolling';

interface DatasourceAnalyzerPanelProps {
  runId: string;
  databaseName: string | null;
  onComplete: (reportId: number) => void;
  onError: (error: string) => void;
}

interface AnalysisStatusResponse {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'not_found';
  message?: string;
  database_report_id?: number;
  error?: string;
  error_message?: string;
}

const ANALYZER_STEPS: ProcessStep[] = [
  {
    key: 'connecting',
    title: t('Connecting to database'),
    description: t('Establishing secure connection'),
  },
  {
    key: 'scanning',
    title: t('Scanning schema'),
    description: t('Discovering tables, views, and relationships'),
  },
  {
    key: 'analyzing',
    title: t('Analyzing structure'),
    description: t('Identifying primary keys, foreign keys, and data types'),
  },
  {
    key: 'ai_interpretation',
    title: t('AI interpretation'),
    description: t('Generating semantic descriptions for tables and columns'),
  },
];

const SIMULATED_STEP_DURATIONS = [2500, 3200, 3800];
const LAST_STEP_INDEX = ANALYZER_STEPS.length - 1;

const Container = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
`;

const Subtitle = styled.span`
  ${({ theme }) => `
    .database-name {
      color: ${theme.colorPrimary};
      font-weight: ${theme.fontWeightStrong};
    }
  `}
`;

export default function DatasourceAnalyzerPanel({
  runId,
  databaseName,
  onComplete,
  onError,
}: DatasourceAnalyzerPanelProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Polling for the last step
  const { data, status: pollingStatus } = usePolling<AnalysisStatusResponse>({
    endpoint: `/api/v1/datasource/analysis/status/${runId}`,
    interval: 2000,
    enabled: true,
    isComplete: data => data?.status === 'completed',
    isError: data => data?.status === 'failed' || data?.status === 'not_found',
    onComplete: data => {
      if (data?.database_report_id) {
        onComplete(data.database_report_id);
      }
    },
    onError: err => {
      if (err && typeof err === 'object') {
        const errData = err as AnalysisStatusResponse;
        onError(
          errData.error_message ||
            errData.message ||
            errData.error ||
            t('Analysis failed'),
        );
      } else if (err instanceof Error) {
        onError(err.message);
      } else {
        onError(t('Analysis failed'));
      }
    },
  });

  // Simulate steps 0 through LAST_STEP_INDEX - 1
  useEffect(() => {
    const advanceSimulatedSteps = () => {
      let accumulatedDelay = 0;

      SIMULATED_STEP_DURATIONS.forEach((duration, index) => {
        accumulatedDelay += duration;
        const timeout = setTimeout(() => {
          setCurrentStepIndex(index + 1);

        }, accumulatedDelay);
        timeoutsRef.current.push(timeout);
      });
    };

    advanceSimulatedSteps();

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  // Handle polling status changes
  useEffect(() => {
    if (pollingStatus === 'error' && data) {
      const errorData = data as AnalysisStatusResponse;
      onError(
        errorData.error_message ||
          errorData.message ||
          errorData.error ||
          t('Analysis failed'),
      );
    }
  }, [pollingStatus, data, onError]);

  const subtitleContent = (
    <Subtitle>
      {t('Connected to')}{' '}
      <span className="database-name">{databaseName || 'database'}</span>
    </Subtitle>
  );

  return (
    <Container>
      <AsyncProcessPanel
        title={t('Analyzing database schema')}
        subtitle={subtitleContent}
        steps={ANALYZER_STEPS}
        currentStepIndex={currentStepIndex}
      />
    </Container>
  );
}
