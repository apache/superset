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
   * The entity's newest self save, fetched by a dedicated one-record probe
   * on every reset. The visible timeline cannot be trusted for this: it is
   * server-filtered by the search term (its first group is merely the newest
   * match), scoped by the include filter, and its first page can be filled
   * entirely by newer related records — any of which would mislabel the
   * "Current" version or drop it.
   */
  newestGroup: SaveGroup | null;
  /**
   * Whether the dedicated newest-self probe identified the live version.
   * Restore must fail closed while this is loading or unavailable; the
   * visible timeline may be filtered and cannot safely stand in for it.
   */
  currentVersionStatus: 'loading' | 'known' | 'unavailable' | 'empty';
  count: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  /**
   * True when the server clipped the history at its fetch ceiling: `count`
   * is a floor, and records older than the last page exist but cannot be
   * paged to. The panel says so rather than presenting the clipped history
   * as complete.
   */
  truncated: boolean;
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
  const [currentVersionStatus, setCurrentVersionStatus] =
    useState<UseVersionActivityResult['currentVersionStatus']>('loading');
  const [count, setCount] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Monotonic id so stale responses from a previous uuid/include are dropped.
  const fetchIdRef = useRef(0);
  // The newest-self probe gets its own staleness counter: loadMore bumps
  // fetchIdRef, and a click landing between a reset's page-0 response and
  // its probe's response would otherwise discard the probe permanently —
  // leaving the newest save untagged. Only a newer reset (or a uuid clear)
  // supersedes a probe.
  const probeIdRef = useRef(0);
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
    setCurrentVersionStatus(uuid ? 'loading' : 'empty');
  }, [entityType, uuid]);

  const fetchPage = useCallback(
    async (pageToLoad: number, reset: boolean) => {
      // Bump before the guard: clearing the uuid must invalidate any
      // in-flight response so it cannot land afterwards.
      fetchIdRef.current += 1;
      const fetchId = fetchIdRef.current;
      // Invalidate in-flight probes here, not when this reset's own probe
      // starts: a uuid switch runs a new fetchPage immediately, and the old
      // entity's probe resolving before the new page-0 response would
      // otherwise pass its id check and write the previous entity's newest
      // save into newestGroup.
      probeIdRef.current += 1;
      if (!uuid) {
        // The invalidated in-flight request can no longer clear the
        // spinner from its own finally block; clear it here.
        setIsLoading(false);
        return;
      }
      if (reset) {
        const probeId = probeIdRef.current;
        // A reset can follow a save or restore, so the previous newest group
        // is no longer authoritative. The probe is independent of the visible
        // timeline request: either request can fail without suppressing the
        // other's result.
        setNewestGroup(null);
        setCurrentVersionStatus('loading');
        fetchActivity(entityType, uuid, {
          include: 'self',
          page: 0,
          pageSize: 1,
        })
          .then(probe => {
            if (probeId !== probeIdRef.current) {
              return;
            }
            const group = buildTimeline(probe.result).find(
              entry => entry.type === 'group',
            ) as SaveGroup | undefined;
            setNewestGroup(group ?? null);
            setCurrentVersionStatus(group ? 'known' : 'empty');
          })
          .catch(() => {
            if (probeId !== probeIdRef.current) {
              return;
            }
            setNewestGroup(null);
            setCurrentVersionStatus('unavailable');
          });
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
        setTruncated(!!response.truncated);
        setPage(pageToLoad);
        const next = reset
          ? response.result
          : mergeActivityPages(recordsRef.current, response.result);
        applyRecords(next);
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
    setTruncated(false);
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
        setTruncated(!!response.truncated);
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
    currentVersionStatus,
    count,
    isLoading,
    error,
    // Compare fetched pages (not deduplicated record count) against the
    // server total, so cross-page duplicates can't strand a dead
    // "Load more" button.
    hasMore: (page + 1) * PAGE_SIZE < count,
    truncated,
    loadMore,
    refresh,
  };
}
