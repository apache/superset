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
// Pagination counts raw records but the timeline groups and dedupes
// them, so one fetched page can yield zero new visible rows (e.g. a
// single save fanning out into dozens of records). "Load more" chases
// pages until something new becomes visible, capped per click.
const MAX_CHAINED_PAGES = 8;

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
  // Free-text search runs server-side over the full history (not just the
  // loaded pages). Pass the already-debounced term; an empty/whitespace
  // value omits the filter. (sc-107283 guide, 2026-06-12.)
  q = '',
): UseVersionActivityResult {
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Monotonic id so stale responses from a previous uuid/include are dropped.
  const fetchIdRef = useRef(0);
  // Mirror of `records` so the chained loadMore loop can see the merged
  // result immediately (functional setState doesn't expose it).
  const recordsRef = useRef<ActivityRecord[]>([]);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

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
          q,
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
    [entityType, uuid, include, q],
  );

  useEffect(() => {
    setRecords([]);
    setCount(0);
    setPage(0);
    fetchPage(0, true);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!uuid) {
      return;
    }
    fetchIdRef.current += 1;
    const fetchId = fetchIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      let merged = recordsRef.current;
      const visibleBefore = buildTimeline(merged).length;
      let nextPage = page;
      let total = count;
      for (let chained = 0; chained < MAX_CHAINED_PAGES; chained += 1) {
        nextPage += 1;
        // Pages must be fetched sequentially: each iteration decides
        // whether to continue based on the merged visible yield so far.
        // eslint-disable-next-line no-await-in-loop
        const response = await fetchActivity(entityType, uuid, {
          include,
          page: nextPage,
          pageSize: PAGE_SIZE,
          q,
        });
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        total = response.count;
        merged = mergeActivityPages(merged, response.result);
        const exhausted = (nextPage + 1) * PAGE_SIZE >= total;
        if (buildTimeline(merged).length > visibleBefore || exhausted) {
          break;
        }
      }
      setCount(total);
      setPage(nextPage);
      recordsRef.current = merged;
      setRecords(merged);
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
  }, [count, entityType, include, page, q, uuid]);

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
