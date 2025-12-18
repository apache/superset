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

export interface DatasourceConnectorState {
  databaseId: number | null;
  databaseName: string | null;
  catalogName: string | null;
  schemaName: string | null;
  isSubmitting: boolean;
  forceReanalyze: boolean;
}

export interface DatasourceAnalyzerPostPayload {
  database_id: number;
  schema_name: string;
  catalog_name?: string | null;
  force_reanalyze?: boolean;
}

export interface ExistingReportResponse {
  exists: boolean;
  report_id: number | null;
  created_at: string | null;
  tables_count: number;
}

export interface DatasourceAnalyzerResponse {
  result: {
    run_id: string;
  };
}

export enum ConnectorStep {
  CONNECT_DATA_SOURCE = 0,
  REVIEW_SCHEMA = 1,
  REVIEW_MAPPINGS = 2,
  GENERATE_DASHBOARD = 3,
  REVIEW_PENDING = 4,
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'failed';

export interface ColumnMapping {
  template_column: string;
  user_column: string | null;
  user_table: string | null;
  confidence: number;
  confidence_level: ConfidenceLevel;
  match_reasons: string[];
  alternatives: Array<{
    column: string;
    table: string;
    confidence: number;
  }>;
}

export interface MetricMapping {
  template_metric: string;
  user_expression: string | null;
  confidence: number;
  confidence_level: ConfidenceLevel;
  match_reasons: string[];
  alternatives: string[];
}

export interface MappingProposal {
  proposal_id: string;
  column_mappings: ColumnMapping[];
  metric_mappings: MetricMapping[];
  unmapped_columns: string[];
  unmapped_metrics: string[];
  review_reasons: string[];
  overall_confidence: number;
}

export interface MappingProposalResponse {
  requires_review: boolean;
  proposal_id?: string;
  run_id?: string;
  message?: string;
  column_mappings?: ColumnMapping[];
  metric_mappings?: MetricMapping[];
  unmapped_columns?: string[];
  unmapped_metrics?: string[];
  review_reasons?: string[];
  overall_confidence?: number;
}

export interface AdjustedMappings {
  columns: Record<string, { column: string; table: string }>;
  metrics: Record<string, string>;
}
