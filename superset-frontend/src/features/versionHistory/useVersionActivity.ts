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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getClientErrorObject } from '@superset-ui/core';
import { fetchActivity } from './api';
import { buildTimeline, mergeActivityPages } from './grouping';
import type {
  ActivityInclude,
  ActivityRecord,
  TimelineEntry,
  VersionedEntityType,
} from './types';

const PAGE_SIZE = 25;

export interface UseVersionActivityResult {
  records: ActivityRecord[];
  timeline: TimelineEntry[];
  count: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function useVersionActivity(
  entityType: VersionedEntityType,
  uuid: string | undefined,
  include: ActivityInclude,
): UseVersionActivityResult {
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Monotonic id so stale responses from a previous uuid/include are dropped.
  const fetchIdRef = useRef(0);

  const fetchPage = useCallback(
    async (pageToLoad: number, reset: boolean) => {
      if (!uuid) {
        return;
      }
      fetchIdRef.current += 1;
      const fetchId = fetchIdRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchActivity(entityType, uuid, {
          include,
          page: pageToLoad,
          pageSize: PAGE_SIZE,
        });
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        setCount(response.count);
        setPage(pageToLoad);
        setRecords(existing =>
          reset
            ? response.result
            : mergeActivityPages(existing, response.result),
        );
      } catch (response) {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        const { error: clientError, message } = await getClientErrorObject(
          response as Parameters<typeof getClientErrorObject>[0],
        );
        setError(clientError || message || null);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [entityType, uuid, include],
  );

  useEffect(() => {
    setRecords([]);
    setCount(0);
    setPage(0);
    fetchPage(0, true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    fetchPage(page + 1, false);
  }, [fetchPage, page]);

  const refresh = useCallback(() => {
    fetchPage(0, true);
  }, [fetchPage]);

  const timeline = useMemo(() => buildTimeline(records), [records]);

  return {
    records,
    timeline,
    count,
    isLoading,
    error,
    // Compare fetched pages (not deduplicated record count) against the
    // server total, so cross-page duplicates can't strand a dead
    // "Load more" button.
    hasMore: (page + 1) * PAGE_SIZE < count,
    loadMore,
    refresh,
  };
}
