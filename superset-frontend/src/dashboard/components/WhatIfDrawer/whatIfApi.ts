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

import { SupersetClient, Signal } from '@superset-ui/core';
import {
  WhatIfInterpretRequest,
  WhatIfInterpretResponse,
  ChartComparison,
  WhatIfFilter,
  WhatIfSuggestRelatedRequest,
  WhatIfSuggestRelatedResponse,
  SuggestedModification,
} from './types';

interface ApiResponse {
  result: {
    summary: string;
    insights: Array<{
      title: string;
      description: string;
      type: string;
    }>;
    raw_response?: string;
  };
}

export async function fetchWhatIfInterpretation(
  request: WhatIfInterpretRequest,
  signal?: Signal,
): Promise<WhatIfInterpretResponse> {
  const response = await SupersetClient.post({
    endpoint: '/api/v1/what_if/interpret',
    signal,
    jsonPayload: {
      modifications: request.modifications.map(mod => ({
        column: mod.column,
        multiplier: mod.multiplier,
        ...(mod.filters && mod.filters.length > 0
          ? {
              filters: mod.filters.map((f: WhatIfFilter) => ({
                col: f.col,
                op: f.op,
                val: f.val,
              })),
            }
          : {}),
      })),
      charts: request.charts.map((chart: ChartComparison) => ({
        chart_id: chart.chartId,
        chart_name: chart.chartName,
        chart_type: chart.chartType,
        metrics: chart.metrics.map(m => ({
          metric_name: m.metricName,
          original_value: m.originalValue,
          modified_value: m.modifiedValue,
          percentage_change: m.percentageChange,
        })),
      })),
      dashboard_name: request.dashboardName,
    },
  });

  const data = response.json as ApiResponse;
  const { result } = data;

  return {
    summary: result.summary,
    insights: result.insights.map(insight => ({
      title: insight.title,
      description: insight.description,
      type: insight.type as 'observation' | 'implication' | 'recommendation',
    })),
    rawResponse: result.raw_response,
  };
}

interface ApiSuggestRelatedResponse {
  result: {
    suggested_modifications: Array<{
      column: string;
      multiplier: number;
      reasoning: string;
      confidence: string;
    }>;
    explanation?: string;
  };
}

export async function fetchRelatedColumnSuggestions(
  request: WhatIfSuggestRelatedRequest,
  signal?: Signal,
): Promise<WhatIfSuggestRelatedResponse> {
  const response = await SupersetClient.post({
    endpoint: '/api/v1/what_if/suggest_related',
    signal,
    jsonPayload: {
      selected_column: request.selectedColumn,
      user_multiplier: request.userMultiplier,
      available_columns: request.availableColumns.map(col => ({
        column_name: col.columnName,
        description: col.description,
        verbose_name: col.verboseName,
        datasource_id: col.datasourceId,
      })),
      dashboard_name: request.dashboardName,
    },
  });

  const data = response.json as ApiSuggestRelatedResponse;
  const { result } = data;

  return {
    suggestedModifications: result.suggested_modifications.map(
      (mod): SuggestedModification => ({
        column: mod.column,
        multiplier: mod.multiplier,
        reasoning: mod.reasoning,
        confidence: mod.confidence as 'high' | 'medium' | 'low',
      }),
    ),
    explanation: result.explanation,
  };
}
