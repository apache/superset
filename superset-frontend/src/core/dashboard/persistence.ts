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
import { SupersetClient } from '@superset-ui/core';
import type { DocumentNode } from './DashboardProvider';

export const DOCUMENT_VERSION = 1;

export interface DashboardV2Document {
  version: number;
  nodes: Record<string, DocumentNode>;
}

export interface DashboardV2 {
  id: number;
  uuid: string;
  dashboard_title: string;
  changed_on?: string;
  document: DashboardV2Document;
  embedded: { uuid: string; allowed_domains: string[] } | null;
}

export async function fetchDashboardV2(
  ref: string | number,
): Promise<DashboardV2> {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/dashboard_v2/${ref}`,
  });
  return json.result as DashboardV2;
}

/** Creates the dashboard when `id` is omitted, updates it otherwise. */
export async function saveDashboardV2({
  id,
  title,
  nodes,
}: {
  id?: number;
  title: string;
  nodes: Record<string, DocumentNode>;
}): Promise<DashboardV2> {
  const jsonPayload = {
    dashboard_title: title,
    document: { version: DOCUMENT_VERSION, nodes },
  };
  const { json } =
    id === undefined
      ? await SupersetClient.post({
          endpoint: '/api/v1/dashboard_v2/',
          jsonPayload,
        })
      : await SupersetClient.put({
          endpoint: `/api/v1/dashboard_v2/${id}`,
          jsonPayload,
        });
  return json.result as DashboardV2;
}
