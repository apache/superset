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
  WhatIfModification,
  WhatIfSuggestRelatedRequest,
  WhatIfSuggestRelatedResponse,
  SuggestedModification,
} from './types';

// =============================================================================
// Simulation CRUD Types
// =============================================================================

export interface WhatIfSimulation {
  id: number;
  uuid: string;
  name: string;
  description?: string | null;
  dashboardId: number;
  modifications: WhatIfModification[];
  cascadingEffectsEnabled: boolean;
  createdOn?: string | null;
  changedOn?: string | null;
}

export interface CreateSimulationRequest {
  name: string;
  description?: string;
  dashboardId: number;
  modifications: WhatIfModification[];
  cascadingEffectsEnabled: boolean;
}

export interface UpdateSimulationRequest {
  name?: string;
  description?: string;
  modifications?: WhatIfModification[];
  cascadingEffectsEnabled?: boolean;
}

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

// =============================================================================
// Simulation CRUD API Functions
// =============================================================================

interface SimulationListResponse {
  result: Array<{
    id: number;
    uuid: string;
    name: string;
    description?: string | null;
    dashboard_id?: number;
    modifications: Array<{
      column: string;
      multiplier: number;
      filters?: Array<{
        col: string;
        op: string;
        val: string | number | boolean | Array<string | number>;
      }>;
    }>;
    cascading_effects_enabled: boolean;
    created_on?: string | null;
    changed_on?: string | null;
  }>;
}

interface SimulationCreateResponse {
  id: number;
  uuid: string;
}

export async function fetchAllSimulations(): Promise<WhatIfSimulation[]> {
  const response = await SupersetClient.get({
    endpoint: '/api/v1/what_if/simulations',
  });

  const data = response.json as SimulationListResponse;
  return data.result.map(sim => ({
    id: sim.id,
    uuid: sim.uuid,
    name: sim.name,
    description: sim.description,
    dashboardId: sim.dashboard_id ?? 0,
    modifications: sim.modifications.map(mod => ({
      column: mod.column,
      multiplier: mod.multiplier,
      filters: mod.filters?.map(f => ({
        col: f.col,
        op: f.op as WhatIfFilter['op'],
        val: f.val,
      })),
    })),
    cascadingEffectsEnabled: sim.cascading_effects_enabled,
    createdOn: sim.created_on,
    changedOn: sim.changed_on,
  }));
}

export async function fetchSimulations(
  dashboardId: number,
): Promise<WhatIfSimulation[]> {
  const response = await SupersetClient.get({
    endpoint: `/api/v1/what_if/simulations/dashboard/${dashboardId}`,
  });

  const data = response.json as SimulationListResponse;
  return data.result.map(sim => ({
    id: sim.id,
    uuid: sim.uuid,
    name: sim.name,
    description: sim.description,
    dashboardId,
    modifications: sim.modifications.map(mod => ({
      column: mod.column,
      multiplier: mod.multiplier,
      filters: mod.filters?.map(f => ({
        col: f.col,
        op: f.op as WhatIfFilter['op'],
        val: f.val,
      })),
    })),
    cascadingEffectsEnabled: sim.cascading_effects_enabled,
    createdOn: sim.created_on,
    changedOn: sim.changed_on,
  }));
}

export async function createSimulation(
  request: CreateSimulationRequest,
): Promise<WhatIfSimulation> {
  const response = await SupersetClient.post({
    endpoint: '/api/v1/what_if/simulations',
    jsonPayload: {
      name: request.name,
      description: request.description,
      dashboard_id: request.dashboardId,
      modifications: request.modifications.map(mod => ({
        column: mod.column,
        multiplier: mod.multiplier,
        filters: mod.filters?.map(f => ({
          col: f.col,
          op: f.op,
          val: f.val,
        })),
      })),
      cascading_effects_enabled: request.cascadingEffectsEnabled,
    },
  });

  const data = response.json as SimulationCreateResponse;
  return {
    id: data.id,
    uuid: data.uuid,
    name: request.name,
    description: request.description,
    dashboardId: request.dashboardId,
    modifications: request.modifications,
    cascadingEffectsEnabled: request.cascadingEffectsEnabled,
  };
}

export async function updateSimulation(
  simulationId: number,
  request: UpdateSimulationRequest,
): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (request.name !== undefined) payload.name = request.name;
  if (request.description !== undefined)
    payload.description = request.description;
  if (request.cascadingEffectsEnabled !== undefined) {
    payload.cascading_effects_enabled = request.cascadingEffectsEnabled;
  }
  if (request.modifications !== undefined) {
    payload.modifications = request.modifications.map(mod => ({
      column: mod.column,
      multiplier: mod.multiplier,
      filters: mod.filters?.map(f => ({
        col: f.col,
        op: f.op,
        val: f.val,
      })),
    }));
  }

  await SupersetClient.put({
    endpoint: `/api/v1/what_if/simulations/${simulationId}`,
    jsonPayload: payload,
  });
}

export async function deleteSimulation(simulationId: number): Promise<void> {
  await SupersetClient.delete({
    endpoint: `/api/v1/what_if/simulations/${simulationId}`,
  });
}
