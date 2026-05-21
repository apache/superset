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

export function useVersionSnapshot(
  entityType: EntityType,
  uuid: string | null | undefined,
  versionUuid: string | null | undefined,
): UseVersionSnapshotResult {
  const [snapshot, setSnapshot] = useState<VersionSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid || !versionUuid) {
      setSnapshot(null);
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
        setSnapshot(json as VersionSnapshot);
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
