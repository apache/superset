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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { makeApi, SupersetApiError } from '@superset-ui/core';
import { EmbeddedDashboard } from 'src/dashboard/types';

export const embeddedKeys = {
  all: ['embeddedDashboard'] as const,
  detail: (id: string | number) => [...embeddedKeys.all, String(id)] as const,
} as const;

const embeddedEndpoint = (id: string) => `/api/v1/dashboard/${id}/embedded`;

/**
 * Reads the dashboard's embedded config. Returns null when the dashboard isn't
 * currently embedded (the API answers 404 in that case).
 */
export function useEmbeddedDashboard(
  dashboardId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: embeddedKeys.detail(dashboardId),
    queryFn: () =>
      makeApi<Record<string, never>, { result: EmbeddedDashboard }>({
        method: 'GET',
        endpoint: embeddedEndpoint(dashboardId),
      })({})
        .then(({ result }) => result)
        .catch(err => {
          if ((err as SupersetApiError).status === 404) {
            return null;
          }
          throw err;
        }),
    enabled: options?.enabled ?? true,
  });
}

/** Enables (or updates) embedding for the dashboard. */
export function useEnableEmbedded(dashboardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (allowedDomains: string[]) =>
      makeApi<{ allowed_domains: string[] }, { result: EmbeddedDashboard }>({
        method: 'POST',
        endpoint: embeddedEndpoint(dashboardId),
      })({ allowed_domains: allowedDomains }).then(({ result }) => result),
    onSuccess: result => {
      queryClient.setQueryData(embeddedKeys.detail(dashboardId), result);
    },
  });
}

/** Disables embedding for the dashboard. */
export function useDisableEmbedded(dashboardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      makeApi<Record<string, never>, unknown>({
        method: 'DELETE',
        endpoint: embeddedEndpoint(dashboardId),
      })({}),
    onSuccess: () => {
      queryClient.setQueryData(embeddedKeys.detail(dashboardId), null);
    },
  });
}
