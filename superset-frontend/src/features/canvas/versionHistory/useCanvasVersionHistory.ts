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
import { useCallback, useEffect, useState } from 'react';
import { getClientErrorObject } from '@superset-ui/core';
import type { VersionMeta } from 'src/features/versionHistory/types';
import type { CanvasVersionSnapshot } from '../types';
import {
  fetchCanvasVersion,
  fetchCanvasVersions,
  restoreCanvasVersion,
  RestoreResult,
} from './api';

export interface CanvasVersionHistory {
  /** Newest first; undefined until loaded, or when the user can't read it. */
  versions?: VersionMeta[];
  /** The version shown instead of the live canvas, if any. */
  preview?: CanvasVersionSnapshot;
  /** The version whose preview is loading. */
  loading?: string;
  error?: string;
  reload: () => Promise<void>;
  showVersion: (versionUuid: string) => Promise<void>;
  showCurrent: () => void;
  restore: (versionUuid: string) => Promise<RestoreResult>;
}

const errorMessage = async (
  response: Parameters<typeof getClientErrorObject>[0],
) => {
  const error = await getClientErrorObject(response);
  return error.message || error.error || String(response);
};

/**
 * A canvas' saved versions, a preview of one of them, and restoring one. The
 * list doubles as the permission check: only the canvas' editors can read it,
 * so `versions` stays undefined for everyone else.
 */
export function useCanvasVersionHistory(
  canvasUuid: string | undefined,
  enabled: boolean,
): CanvasVersionHistory {
  const [versions, setVersions] = useState<VersionMeta[]>();
  const [preview, setPreview] = useState<CanvasVersionSnapshot>();
  const [loading, setLoading] = useState<string>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    if (!enabled || !canvasUuid) return;
    try {
      const list = await fetchCanvasVersions(canvasUuid);
      setVersions([...list].reverse());
      setError(undefined);
    } catch (response) {
      setError(await errorMessage(response));
    }
  }, [enabled, canvasUuid]);

  useEffect(() => {
    setVersions(undefined);
    setPreview(undefined);
    reload();
  }, [reload]);

  const showVersion = useCallback(
    async (versionUuid: string) => {
      if (!canvasUuid) return;
      setLoading(versionUuid);
      try {
        setPreview(await fetchCanvasVersion(canvasUuid, versionUuid));
        setError(undefined);
      } catch (response) {
        setError(await errorMessage(response));
      } finally {
        setLoading(undefined);
      }
    },
    [canvasUuid],
  );

  const showCurrent = useCallback(() => setPreview(undefined), []);

  const restore = useCallback(
    async (versionUuid: string) => {
      if (!canvasUuid) throw new Error('No canvas to restore');
      const result = await restoreCanvasVersion(canvasUuid, versionUuid);
      setPreview(undefined);
      await reload();
      return result;
    },
    [canvasUuid, reload],
  );

  return {
    versions,
    preview,
    loading,
    error,
    reload,
    showVersion,
    showCurrent,
    restore,
  };
}
