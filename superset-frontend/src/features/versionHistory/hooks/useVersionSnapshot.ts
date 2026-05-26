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
import { useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { EntityType, VersionSnapshot } from '../types';

interface UseVersionSnapshotResult {
  snapshot: VersionSnapshot | null;
  loading: boolean;
  error: string | null;
}

// Module-scoped cache of resolved snapshots, keyed by
// ``{entityType}:{uuid}:{versionUuid}``. Snapshots are immutable —
// restoring/forking creates a new version with a new UUID, so cache hits
// are always safe and we avoid re-hitting the endpoint when the user
// flips back and forth between two history rows.
const snapshotCache = new Map<string, VersionSnapshot>();

function cacheKey(
  entityType: EntityType,
  uuid: string,
  versionUuid: string,
): string {
  return `${entityType}:${uuid}:${versionUuid}`;
}

export function useVersionSnapshot(
  entityType: EntityType,
  uuid: string | null | undefined,
  versionUuid: string | null | undefined,
): UseVersionSnapshotResult {
  const [snapshot, setSnapshot] = useState<VersionSnapshot | null>(() => {
    if (!uuid || !versionUuid) return null;
    return snapshotCache.get(cacheKey(entityType, uuid, versionUuid)) ?? null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid || !versionUuid) {
      setSnapshot(null);
      return undefined;
    }
    const key = cacheKey(entityType, uuid, versionUuid);
    const cached = snapshotCache.get(key);
    if (cached) {
      setSnapshot(cached);
      setError(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    SupersetClient.get({
      endpoint: `/api/v1/${entityType}/${uuid}/versions/${versionUuid}/`,
    })
      .then(({ json }) => {
        if (cancelled) return;
        // SupersetClient returns the envelope ``{ result: ... }``; the
        // snapshot fields (position_json, issued_at, _version, ...) live
        // inside ``result``, not at the root.
        const result = (json as { result?: VersionSnapshot } | undefined)
          ?.result;
        if (result) {
          snapshotCache.set(key, result);
        }
        setSnapshot(result ?? null);
      })
      .catch(e => {
        if (cancelled) return;
        setError(String((e as Error)?.message ?? e));
        setSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, uuid, versionUuid]);

  return { snapshot, loading, error };
}
