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
import { useCallback, useRef } from 'react';
import { isEqual } from 'lodash-es';

/**
 * Each item as the form first held it, so a save can tell an edit from a
 * round trip.
 *
 * The modal marks an item modified the moment its form is touched and never
 * un-marks it, so opening a filter, changing a field and putting it back
 * still posted that filter. The save asks for nothing, but it is a write all
 * the same, and under change management it opens a request and locks the
 * dashboard for everyone else.
 *
 * Comparing the form against the *stored* filter instead does not work. A
 * stored filter is saved through `transformSavedFilter` and the form through
 * `transformFormInput`, and the latter fills in the defaults of controls the
 * stored filter predates -- `controlValues.creatable`,
 * `controlValues.operatorType`, `targets[].datasourceType`. The two shapes
 * never match, so a comparison between them never fires. Both sides have to
 * come from the form, which is what this records.
 */
export interface PristineItemValues {
  /** Record how an item stood before anyone touched it. A no-op once set. */
  capture: (id: string, value: unknown) => void;
  /** Whether `value` is what the form first held for `id`. */
  isUnchanged: (id: string, value: unknown) => boolean;
  /** Forget everything, for a reopened or reset modal. */
  reset: () => void;
}

export function usePristineItemValues(): PristineItemValues {
  const pristine = useRef<Record<string, unknown>>({});

  const capture = useCallback((id: string, value: unknown) => {
    if (!(id in pristine.current)) {
      pristine.current[id] = value;
    }
  }, []);

  const isUnchanged = useCallback(
    (id: string, value: unknown) =>
      // An item nobody recorded is one we cannot vouch for -- a filter added
      // in this session, or one whose form had not mounted when the snapshot
      // was taken. Saying "changed" there keeps the save, which is the side
      // to be wrong on.
      id in pristine.current && isEqual(pristine.current[id], value),
    [],
  );

  const reset = useCallback(() => {
    pristine.current = {};
  }, []);

  return { capture, isUnchanged, reset };
}
