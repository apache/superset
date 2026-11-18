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

/**
 * @fileoverview A frame's bindings: every one fetched when the manifest, the
 * source or the filters change, or on `refresh`, and one at a time on
 * `rerun`. A result that `rerun` replaces leaves the others' objects as they
 * were, so the frame host sends the frame only the one that changed. A
 * `rerun` that a full fetch overtakes is dropped, as it ran on older inputs.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BindingData, FrameStatus } from '@superset-oss/artifacts-sdk';
import type { HostManifest } from '../frames/api';
import { errorMessage } from '../http';
import {
  BindingSource,
  fetchBinding,
  fetchBindings,
  SelectFilterValue,
} from './bindings';

export interface Bindings {
  /** Each binding's latest result, by name. */
  bindings: Readonly<Record<string, BindingData>>;
  status: FrameStatus;
  /** Why the bindings failed, when `status` is `error`. */
  error?: string;
  /** Run every binding again. */
  refresh: () => void;
  /** Run one binding again; rejects when it fails. */
  rerun: (binding: string) => Promise<void>;
}

export default function useBindings(
  manifest: HostManifest | undefined,
  source: BindingSource | undefined,
  filters: SelectFilterValue[],
  /** Changes whenever the host asks for fresh data, as a canvas refresh. */
  refreshKey?: unknown,
): Bindings {
  const [bindings, setBindings] = useState<Record<string, BindingData>>({});
  const [status, setStatus] = useState<FrameStatus>('loading');
  const [error, setError] = useState<string>();
  const [nonce, setNonce] = useState(0);
  // The source and the filters change identity on every render of the
  // caller; their keys say when they changed.
  const sourceKey = JSON.stringify(source ?? null);
  const filtersKey = JSON.stringify(filters);
  const latest = useRef({ source, filters });
  latest.current = { source, filters };
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    const { source: from, filters: selected } = latest.current;
    if (!manifest || !from) return undefined;
    if (Object.keys(manifest.bindings ?? {}).length === 0) {
      setBindings({});
      setStatus('ok');
      setError(undefined);
      return undefined;
    }
    let cancelled = false;
    setStatus('loading');
    fetchBindings(manifest, from, selected)
      .then(data => {
        if (cancelled) return;
        setBindings(data);
        setStatus('ok');
        setError(undefined);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [manifest, sourceKey, filtersKey, refreshKey, nonce]);

  const refresh = useCallback(() => setNonce(value => value + 1), []);

  const rerun = useCallback(async (binding: string) => {
    const { source: from, filters: selected } = latest.current;
    if (!from) return;
    const started = generation.current;
    const data = await fetchBinding(from, binding, selected);
    if (generation.current === started) {
      setBindings(current => ({ ...current, [binding]: data }));
    }
  }, []);

  return { bindings, status, error, refresh, rerun };
}
