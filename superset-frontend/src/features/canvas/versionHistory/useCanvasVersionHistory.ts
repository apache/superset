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
import { getClientErrorObject } from '@superset-ui/core';
import type { VersionMeta } from 'src/features/versionHistory/types';
import { LOG_ACTIONS_CANVAS_ERROR } from 'src/logger/LogUtils';
import type { CanvasVersionSnapshot } from '../types';
import { useCanvasLogger } from '../useCanvasLogger';
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
  canvasId?: number,
): CanvasVersionHistory {
  const log = useCanvasLogger(canvasId);
  const [versions, setVersions] = useState<VersionMeta[]>();
  const [preview, setPreview] = useState<CanvasVersionSnapshot>();
  const [loading, setLoading] = useState<string>();
  const [error, setError] = useState<string>();
  // Which preview request is the latest. A response for an earlier one -- a
  // version clicked before another, or before a draft opened and turned the
  // history off -- is dropped rather than shown in place of the canvas.
  const request = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled || !canvasUuid) return;
    try {
      const list = await fetchCanvasVersions(canvasUuid);
      setVersions([...list].reverse());
      setError(undefined);
    } catch (response) {
      setError(await errorMessage(response));
      // A 403 here is not a failure: the list doubles as the permission
      // check, so every viewer who is not an editor gets one on every page
      // view. Reporting those would drown the ones that mean something.
      const { status } = await getClientErrorObject(response);
      if (status !== 403) {
        log(LOG_ACTIONS_CANVAS_ERROR, {
          scope: 'version_list',
          status,
          has_err: true,
        });
      }
    }
  }, [enabled, canvasUuid, log]);

  useEffect(() => {
    request.current += 1;
    setVersions(undefined);
    setPreview(undefined);
    setLoading(undefined);
    reload();
  }, [reload]);

  const showVersion = useCallback(
    async (versionUuid: string) => {
      if (!canvasUuid) return;
      request.current += 1;
      const requested = request.current;
      const latest = () => requested === request.current;
      setLoading(versionUuid);
      try {
        const snapshot = await fetchCanvasVersion(canvasUuid, versionUuid);
        if (!latest()) return;
        setPreview(snapshot);
        setError(undefined);
      } catch (response) {
        const message = await errorMessage(response);
        if (latest()) setError(message);
        // Counted even when superseded: the request still failed, and this
        // event is the only trace of it once its message is dropped.
        const { status } = await getClientErrorObject(response);
        log(LOG_ACTIONS_CANVAS_ERROR, {
          scope: 'version_preview',
          status,
          has_err: true,
        });
      } finally {
        // Whatever superseded this request cleared or owns the spinner.
        if (latest()) setLoading(undefined);
      }
    },
    [canvasUuid, log],
  );

  const showCurrent = useCallback(() => {
    request.current += 1;
    setPreview(undefined);
    setLoading(undefined);
  }, []);

  const restore = useCallback(
    async (versionUuid: string) => {
      if (!canvasUuid) throw new Error('No canvas to restore');
      const result = await restoreCanvasVersion(canvasUuid, versionUuid);
      // Back on the current canvas, as with showCurrent: a preview still
      // loading was asked for before the restore and is dropped.
      request.current += 1;
      setPreview(undefined);
      setLoading(undefined);
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
