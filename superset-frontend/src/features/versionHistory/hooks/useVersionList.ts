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
import { EntityType, Version } from '../types';

interface UseVersionListResult {
  versions: Version[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useVersionList(
  entityType: EntityType,
  uuid: string | null | undefined,
): UseVersionListResult {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Incrementing token used to drop responses from earlier requests when a
  // new one supersedes them (uuid change, panel toggle, etc.).
  const requestIdRef = useRef(0);

  const refetch = useCallback(async () => {
    if (!uuid) return;
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    setError(null);
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/${entityType}/${uuid}/versions/`,
      });
      if (requestId !== requestIdRef.current) return;
      const result = (json as { result?: Version[] }).result ?? [];
      // API returns oldest-first; reverse so the latest version is the
      // first row and renders as the "Current version".
      setVersions([...result].reverse());
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(String((e as Error)?.message ?? e));
      setVersions([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [entityType, uuid]);

  useEffect(() => {
    refetch();
    return () => {
      // Bump the token so any in-flight response is ignored.
      requestIdRef.current += 1;
    };
  }, [refetch]);

  return { versions, loading, error, refetch };
}
