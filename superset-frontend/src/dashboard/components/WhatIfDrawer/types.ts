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

export type WhatIfFilterOperator =
  | '=='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'IN'
  | 'NOT IN'
  | 'TEMPORAL_RANGE';

export interface WhatIfFilter {
  col: string;
  op: WhatIfFilterOperator;
  val: string | number | boolean | Array<string | number>;
}

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
