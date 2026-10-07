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

import { buildQueryContext, SupersetClient } from '@superset-ui/core';
import type { QueryFormData } from '@superset-ui/core';
import type { DataRow } from './resolveBindings';

export interface DataBinding {
  datasetId: number;
  metrics: unknown[];
  dimensions?: string[];
  filters?: Record<string, unknown>[];
  rowLimit?: number;
}

/**
 * Rows for a widget's `dataBinding`, through the existing chart data API.
 * Stands in for SIP-231's widget data route until it exists.
 */
export async function fetchRows(binding: DataBinding): Promise<DataRow[]> {
  const formData = {
    datasource: `${binding.datasetId}__table`,
    viz_type: 'table',
    metrics: binding.metrics.filter(metric => metric != null && metric !== ''),
    groupby: (binding.dimensions ?? []).filter(Boolean),
    adhoc_filters: binding.filters ?? [],
    row_limit: binding.rowLimit ?? 1000,
    result_format: 'json',
    result_type: 'full',
  } as unknown as QueryFormData;
  const { json } = await SupersetClient.post({
    endpoint: '/api/v1/chart/data',
    jsonPayload: buildQueryContext(formData),
  });
  const result = json?.result?.[0];
  if (!result || result.error) {
    throw new Error(result?.error ?? 'The data request returned no result');
  }
  return result.data ?? [];
}
