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
import { useCallback, useEffect, useRef, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { ActivityInclude, ActivityRecord, EntityType } from '../types';

interface UseActivityOptions {
  include?: ActivityInclude;
  page?: number;
  pageSize?: number;
  since?: string;
  until?: string;
}

interface UseActivityResult {
  records: ActivityRecord[] | null;
  count: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_PAGE_SIZE = 25;
// Activity endpoint accepts flat query params (NOT inside the rison ``q``
// envelope) — verified against /api/v1/{entity}/{uuid}/activity/.
function buildEndpoint(
  entityType: EntityType,
  uuid: string,
  opts: UseActivityOptions,
): string {
  const params = new URLSearchParams();
  params.set('include', opts.include ?? 'all');
  params.set('page', String(opts.page ?? 0));
  params.set('page_size', String(opts.pageSize ?? DEFAULT_PAGE_SIZE));
  if (opts.since) params.set('since', opts.since);
  if (opts.until) params.set('until', opts.until);
  return `/api/v1/${entityType}/${uuid}/activity/?${params.toString()}`;
}

export function useActivity(
  entityType: EntityType,
  uuid: string | null | undefined,
  options: UseActivityOptions = {},
): UseActivityResult {
  const [records, setRecords] = useState<ActivityRecord[] | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Incrementing token used to drop responses from earlier requests when a
  // new one supersedes them (uuid change, filter change, panel toggle, ...).
  const requestIdRef = useRef(0);

  const { include, page, pageSize, since, until } = options;

  const refetch = useCallback(async () => {
    if (!uuid) return;
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    setError(null);
    try {
      const { json } = await SupersetClient.get({
        endpoint: buildEndpoint(entityType, uuid, {
          include,
          page,
          pageSize,
          since,
          until,
        }),
      });
      if (requestId !== requestIdRef.current) return;
      // SupersetClient returns the envelope ``{ result, count }``; unwrap
      // explicitly — past bugs were caused by treating the envelope itself
      // as the array.
      const envelope = json as
        | { result?: ActivityRecord[]; count?: number }
        | undefined;
      setRecords(envelope?.result ?? []);
      setCount(envelope?.count ?? 0);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(String((e as Error)?.message ?? e));
      setRecords([]);
      setCount(0);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [entityType, uuid, include, page, pageSize, since, until]);

  useEffect(() => {
    refetch();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refetch]);

  return { records, count, loading, error, refetch };
}
