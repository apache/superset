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

interface FailedMapping {
  type: string;
  id: string;
  name: string;
  error: string;
  alternatives: string[];
}

interface PendingReviewData {
  dashboardId: number;
  datasetId?: number;
  reviewReasons: string[];
  failedMappings: FailedMapping[];
  quality: number;
}

interface DashboardGeneratorPanelProps {
  runId: string;
  templateName: string | null;
  onComplete: (dashboardId: number) => void;
  onError: (error: string) => void;
  onPendingReview?: (data: PendingReviewData) => void;
}

interface GenerationStatusResponse {
  status:
    | 'reserved'
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'not_found'
    | 'pending_review';
  message?: string;
  dashboard_id?: number;
  error?: string;
  requires_human_review?: boolean;
  review_reasons?: string[];
  failed_mappings?: FailedMapping[];
  quality?: number;
}

const GENERATOR_STEPS: ProcessStep[] = [
  {
    key: 'analyzing',
    title: t('Analyzing data schema'),
    description: t('Understanding your database structure and relationships'),
  },
  {
    key: 'creating',
    title: t('Creating datasets'),
    description: t('Mapping template charts to your tables'),
  },
  {
    key: 'adapting',
    title: t('Adapting queries'),
    description: t('Rewriting chart queries for your schema'),
  },
  {
    key: 'building',
    title: t('Building dashboard'),
    description: t('Generating final dashboard layout'),
  },
];

const SIMULATED_STEP_DURATIONS = [2500, 3200, 3800];
const LAST_STEP_INDEX = GENERATOR_STEPS.length - 1;

const Container = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
`;

const Subtitle = styled.span`
  ${({ theme }) => `
    .template-name {
      color: ${theme.colorPrimary};
      font-weight: ${theme.fontWeightStrong};
    }
  `}
`;

export default function DashboardGeneratorPanel({
  runId,
  templateName,
  onComplete,
  onError,
  onPendingReview,
}: DashboardGeneratorPanelProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Polling for the last step
  const { data, status: pollingStatus } = usePolling<GenerationStatusResponse>({
    endpoint: `/api/v1/dashboard/generation/status/${runId}`,
    interval: 2000,
    enabled: true,
    isComplete: data =>
      data?.status === 'completed' || data?.status === 'pending_review',
    isError: data => data?.status === 'failed' || data?.status === 'not_found',
    onComplete: data => {
      if (data?.status === 'pending_review') {
        // Handle pending review - needs human intervention
        if (onPendingReview && data.dashboard_id) {
          onPendingReview({
            dashboardId: data.dashboard_id,
            datasetId: data.dataset_id,
            reviewReasons: data.review_reasons || [],
            failedMappings: data.failed_mappings || [],
            quality: data.quality || 0,
          });
        } else if (data.dashboard_id) {
          // Fallback: if no handler, still complete with dashboard_id
          // User can fix issues manually in the dashboard
          onComplete(data.dashboard_id);
        }
      } else if (data?.dashboard_id) {
        onComplete(data.dashboard_id);
      }
    },
    onError: err => {
      if (err && typeof err === 'object' && 'message' in err) {
        onError(
          (err as GenerationStatusResponse).message ||
            t('Dashboard generation failed'),
        );
      } else if (err instanceof Error) {
        onError(err.message);
      } else {
        onError(t('Dashboard generation failed'));
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
      const errorData = data as GenerationStatusResponse;
      onError(
        errorData.message ||
          errorData.error ||
          t('Dashboard generation failed'),
      );
    }
  }, [pollingStatus, data, onError]);

  const subtitleContent = (
    <Subtitle>
      {t('Generating dashboard from')}{' '}
      <span className="template-name">{templateName || 'template'}</span>
    </Subtitle>
  );

  return (
    <Container>
      <AsyncProcessPanel
        title={t('Building your dashboard')}
        subtitle={subtitleContent}
        steps={GENERATOR_STEPS}
        currentStepIndex={currentStepIndex}
      />
    </Container>
  );
}
