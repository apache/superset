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
 * @fileoverview A frame's bindings, all from one data request: fetched when
 * the manifest, the source or the filters change, or on `refresh`. A `rerun`
 * fetches them all as well, but replaces only the result of the binding it
 * names, leaving the others' objects as they were, so the frame host sends
 * the frame only the one that changed. A `rerun` that a full fetch overtakes
 * is dropped, as it ran on older inputs.
 *
 * Results belong to the manifest and the source they were fetched for: until
 * a new manifest's or source's own results land, there are none, so a new
 * frame never starts with another version's rows. Across a filter change,
 * the last results stand until the new ones land.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BindingData, FrameStatus } from '@superset-oss/artifacts-sdk';
import type { HostManifest } from '../frames/api';
import { errorMessage } from '../http';
import { BindingSource, fetchBindings, SelectFilterValue } from './bindings';

export interface Bindings {
  /** Each binding's latest result, by name. */
  bindings: Readonly<Record<string, BindingData>>;
  status: FrameStatus;
  /** Why the bindings failed, when `status` is `error`. */
  error?: string;
  /** Run every binding again. */
  refresh: () => void;
  /** Fetch the bindings again for one of them; rejects when that fails. */
  rerun: (binding: string) => Promise<void>;
}

const NONE: Readonly<Record<string, BindingData>> = Object.freeze({});

interface Fetched {
  manifest: HostManifest;
  sourceKey: string;
  bindings: Record<string, BindingData>;
  status: FrameStatus;
  error?: string;
}

export default function useBindings(
  manifest: HostManifest | undefined,
  source: BindingSource | undefined,
  filters: SelectFilterValue[],
  /** Changes whenever the host asks for fresh data, as a canvas refresh. */
  refreshKey?: unknown,
): Bindings {
  const [fetched, setFetched] = useState<Fetched>();
  const [nonce, setNonce] = useState(0);
  // The source and the filters change identity on every render of the
  // caller; their keys say when they changed.
  const sourceKey = JSON.stringify(source ?? null);
  const filtersKey = JSON.stringify(filters);
  const latest = useRef({ manifest, source, filters });
  latest.current = { manifest, source, filters };
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    const { source: from, filters: selected } = latest.current;
    if (!manifest || !from) return undefined;
    const settle = (next: Omit<Fetched, 'manifest' | 'sourceKey'>) =>
      setFetched({ manifest, sourceKey, ...next });
    if (Object.keys(manifest.bindings ?? {}).length === 0) {
      settle({ bindings: {}, status: 'ok' });
      return undefined;
    }
    let cancelled = false;
    setFetched(
      current => current && { ...current, status: 'loading', error: undefined },
    );
    fetchBindings(manifest, from, selected)
      .then(data => {
        if (!cancelled) settle({ bindings: data, status: 'ok' });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setFetched(current => ({
          manifest,
          sourceKey,
          bindings:
            current?.manifest === manifest && current.sourceKey === sourceKey
              ? current.bindings
              : {},
          status: 'error',
          error: errorMessage(reason),
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [manifest, sourceKey, filtersKey, refreshKey, nonce]);

  const refresh = useCallback(() => setNonce(value => value + 1), []);

  const rerun = useCallback(async (binding: string) => {
    const {
      manifest: declared,
      source: from,
      filters: selected,
    } = latest.current;
    if (!declared || !from) return;
    const started = generation.current;
    const data = await fetchBindings(declared, from, selected);
    if (generation.current !== started) return;
    if (!Object.prototype.hasOwnProperty.call(data, binding)) {
      throw new Error(`no binding named "${binding}"`);
    }
    setFetched(
      current =>
        current && {
          ...current,
          bindings: { ...current.bindings, [binding]: data[binding] },
        },
    );
  }, []);

  const own =
    fetched !== undefined &&
    fetched.manifest === manifest &&
    fetched.sourceKey === sourceKey;
  return {
    bindings: own ? fetched.bindings : NONE,
    status: own ? fetched.status : 'loading',
    error: own ? fetched.error : undefined,
    refresh,
    rerun,
  };
}
