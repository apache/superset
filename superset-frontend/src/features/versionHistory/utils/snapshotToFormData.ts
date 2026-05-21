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
import { QueryFormData } from '@superset-ui/core';
import { VersionSnapshot } from '../types';

function parseParams(params: unknown): Record<string, unknown> {
  if (!params) return {};
  if (typeof params === 'object') return params as Record<string, unknown>;
  if (typeof params === 'string') {
    try {
      return JSON.parse(params) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Adapts a chart version snapshot from the backend (DB-shaped: ``params``
 * stored as a JSON string alongside scalar fields) into a control-panel
 * ``form_data`` object suitable for shadow-rendering the chart preview.
 *
 * The base ``current`` form_data is merged in so missing keys (datasource,
 * dashboard context) survive the swap.
 */
export function snapshotToFormData(
  snapshot: VersionSnapshot | null,
  current: QueryFormData | undefined,
): QueryFormData | null {
  if (!snapshot) return null;
  const parsedParams = parseParams(snapshot.params);
  const merged: Record<string, unknown> = {
    ...(current ?? {}),
    ...parsedParams,
  };

  if (typeof snapshot.viz_type === 'string') {
    merged.viz_type = snapshot.viz_type;
  }
  if (typeof snapshot.slice_name === 'string') {
    merged.slice_name = snapshot.slice_name;
  }
  if (snapshot.datasource_id != null && snapshot.datasource_type) {
    merged.datasource = `${snapshot.datasource_id}__${snapshot.datasource_type}`;
  }
  return merged as unknown as QueryFormData;
}
