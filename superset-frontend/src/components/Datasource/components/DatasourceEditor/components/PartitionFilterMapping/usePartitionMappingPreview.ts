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
import { useEffect, useMemo, useRef, useState } from 'react';
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useDebounceValue } from 'src/hooks/useDebounceValue';
import type { PartitionMappingPreview } from './types';
import { transformCanPreview } from './utils';

interface PreviewRequest {
  datasetId?: number;
  mappedColumn: string;
  partitionColumn: string;
  valueTransform: string;
  sampleValues: string[];
  operator: string;
  isMonotonic: boolean;
  /** Skip entirely when the section isn't showing a mapping. */
  enabled: boolean;
}

/**
 * Preview the predicate a transform would emit, debounced.
 *
 * The endpoint fires a real warehouse query, so the transform is debounced
 * before it leaves the browser, and a transform that cannot work is not sent at
 * all. Neither is a guard -- the server keeps a per-user, per-dataset budget of
 * its own, and remains the authority on whether a transform is usable. The
 * point is that a half-written transform should not spend that budget and leave
 * none for the finished one.
 */
export function usePartitionMappingPreview({
  datasetId,
  mappedColumn,
  partitionColumn,
  valueTransform,
  sampleValues,
  operator,
  isMonotonic,
  enabled,
}: PreviewRequest) {
  const [preview, setPreview] = useState<PartitionMappingPreview | null>(null);
  const [loading, setLoading] = useState(false);
  // Which request the displayed state belongs to. `AbortController` alone is
  // not enough: aborting settles nothing, so a handler still runs and has to
  // ask whether it is still the current one. See the effect below.
  const latestRequest = useRef(0);

  const debouncedTransform = useDebounceValue(valueTransform, 500);
  // `sampleValues` is a fresh array on every render, so depending on it
  // directly would refire the effect -- and spend the preview budget -- on
  // every keystroke elsewhere in the row. Depend on its serialized form and
  // hand the effect a value whose identity tracks that same key.
  const sampleKey = JSON.stringify(sampleValues);
  const samples = useMemo<string[]>(() => JSON.parse(sampleKey), [sampleKey]);

  useEffect(() => {
    const transform = debouncedTransform?.trim();
    // Claimed before the early return as well, so a request already in flight
    // cannot come back and overwrite what this run decided.
    latestRequest.current += 1;
    const requestId = latestRequest.current;

    if (
      !enabled ||
      !datasetId ||
      !mappedColumn ||
      !transformCanPreview(transform, mappedColumn, partitionColumn)
    ) {
      setPreview(null);
      // The spinner belongs to a request this run has just superseded. Its own
      // handlers see the abort and stop short of clearing it, so clearing it
      // here is the only thing that does -- otherwise clearing the transform
      // mid-flight left the panel spinning for good.
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);

    SupersetClient.post({
      endpoint: `/api/v1/dataset/${datasetId}/partition_mapping/preview/`,
      jsonPayload: {
        mapped_column: mappedColumn,
        // The candidate, not the saved one: the owner is previewing a mapping
        // they have not committed yet.
        partition_column: partitionColumn,
        value_transform: transform,
        sample_values: samples,
        operator,
        is_monotonic: isMonotonic,
      },
      signal: controller.signal,
    })
      .then(({ json }) => {
        // This hits a live warehouse query, so responses can arrive out of
        // order. Without this an older one overwrites the current preview and
        // reports "Valid" for a transform the input no longer holds.
        if (requestId !== latestRequest.current) {
          return;
        }
        setPreview(json.result as PartitionMappingPreview);
      })
      .catch(async error => {
        if (requestId !== latestRequest.current) {
          return;
        }
        const clientError = await getClientErrorObject(error);
        setPreview({
          valid: false,
          // `message` first only when it really is a string. A marshmallow
          // rejection -- a transform past the 1,024-character bound, say --
          // answers 400 with an object-valued `message`
          // (`{value_transform: [...]}`), which `getClientErrorObject` leaves
          // as it found it while putting the normalized text in `error`.
          // Preferring `message` unconditionally handed that object to
          // `Alert description`, and React threw "Objects are not valid as a
          // React child" instead of showing the owner the validation error.
          error:
            (typeof clientError.message === 'string'
              ? clientError.message
              : undefined) ||
            clientError.error ||
            t('The preview could not be loaded.'),
        });
      })
      .finally(() => {
        if (requestId === latestRequest.current) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    datasetId,
    mappedColumn,
    partitionColumn,
    debouncedTransform,
    samples,
    operator,
    isMonotonic,
    enabled,
  ]);

  return { preview, loading };
}
