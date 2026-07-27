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
  SaveGroup,
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
  /**
   * The newest save group from the last *unfiltered* fetch. The timeline is
   * server-filtered by the search term, so its first group is merely the
   * newest match — using that for "Current" tagging or restore gating would
   * mislabel an older save while a search is active.
   */
  newestGroup: SaveGroup | null;
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
  // value omits the filter.
  q = '',
): UseVersionActivityResult {
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [newestGroup, setNewestGroup] = useState<SaveGroup | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Monotonic id so stale responses from a previous uuid/include are dropped.
  const fetchIdRef = useRef(0);
  // Mirror of `records` so the chained loadMore loop can see the merged
  // result immediately. Kept in lock-step with setRecords by applyRecords —
  // never write either one directly.
  const recordsRef = useRef<ActivityRecord[]>([]);
  const applyRecords = useCallback((next: ActivityRecord[]) => {
    recordsRef.current = next;
    setRecords(next);
  }, []);

  // The cached newest group describes one entity's history; a different
  // entity must not inherit it.
  useEffect(() => {
    setNewestGroup(null);
  }, [entityType, uuid]);

  const fetchPage = useCallback(
    async (pageToLoad: number, reset: boolean) => {
      // Bump before the guard: clearing the uuid must invalidate any
      // in-flight response so it cannot land afterwards.
      fetchIdRef.current += 1;
      const fetchId = fetchIdRef.current;
      if (!uuid) {
        // The invalidated in-flight request can no longer clear the
        // spinner from its own finally block; clear it here.
        setIsLoading(false);
        return;
      }
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
        const next = reset
          ? response.result
          : mergeActivityPages(recordsRef.current, response.result);
        applyRecords(next);
        if (reset && !q.trim()) {
          // Only an unfiltered first page is authoritative about which
          // save is truly the newest.
          setNewestGroup(
            (buildTimeline(response.result).find(
              entry => entry.type === 'group',
            ) as SaveGroup | undefined) ?? null,
          );
        }
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
    applyRecords([]);
    setCount(0);
    setPage(0);
    fetchPage(0, true);
  }, [applyRecords, fetchPage]);

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
      applyRecords(merged);
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
  }, [applyRecords, count, entityType, include, page, q, uuid]);

  const refresh = useCallback(() => {
    fetchPage(0, true);
  }, [fetchPage]);

  const timeline = useMemo(() => buildTimeline(records), [records]);

  return {
    records,
    timeline,
    newestGroup,
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
