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

// Import shared types for internal use
import type {
  WhatIfFilter,
  WhatIfFilterOperator,
  WhatIfModification,
} from 'src/dashboard/types';

// Re-export shared types from dashboard/types.ts
export type { WhatIfFilter, WhatIfFilterOperator, WhatIfModification };

// Types specific to chart comparison display
export interface ChartMetricComparison {
  metricName: string;
  originalValue: number;
  modifiedValue: number;
  percentageChange: number;
}

export interface ChartComparison {
  chartId: number;
  chartName: string;
  chartType: string;
  metrics: ChartMetricComparison[];
}

// Types for /interpret API endpoint
export interface WhatIfInterpretRequest {
  modifications: Array<{
    column: string;
    multiplier: number;
    filters?: WhatIfFilter[];
  }>;
  charts: ChartComparison[];
  dashboardName?: string;
}

export interface WhatIfInsight {
  title: string;
  description: string;
  type: 'observation' | 'implication' | 'recommendation';
}

export interface WhatIfInterpretResponse {
  summary: string;
  insights: WhatIfInsight[];
  rawResponse?: string;
}

export type WhatIfAIStatus = 'idle' | 'loading' | 'success' | 'error';

// Types for /suggest_related API endpoint
export interface AvailableColumn {
  columnName: string;
  description?: string | null;
  verboseName?: string | null;
  datasourceId: number;
}

export interface SuggestedModification {
  column: string;
  multiplier: number;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface WhatIfSuggestRelatedRequest {
  selectedColumn: string;
  userMultiplier: number;
  availableColumns: AvailableColumn[];
  dashboardName?: string;
}

export interface WhatIfSuggestRelatedResponse {
  suggestedModifications: SuggestedModification[];
  explanation?: string;
}

// Extended modification type that tracks whether it came from AI
export interface ExtendedWhatIfModification {
  column: string;
  multiplier: number;
  filters?: WhatIfFilter[];
  isAISuggested?: boolean;
  reasoning?: string;
  confidence?: 'high' | 'medium' | 'low';
}
