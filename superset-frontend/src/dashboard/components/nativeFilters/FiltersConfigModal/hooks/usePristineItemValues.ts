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
import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { isEqual } from 'lodash-es';

/**
 * Each item as the form held it before anyone edited it, so a save can tell
 * an edit from a round trip.
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
 *
 * `remember` overwrites rather than keeping the first value it is given. A
 * filter's dataset and column arrive from a fetch, so the first render after
 * the panel mounts has `targets: [{}]` and only settles a moment later;
 * freezing that first reading made every filter look edited. The caller
 * stops calling once the item is marked modified, so the last reading before
 * the first edit is the one that stands.
 */
export interface PristineItemValues {
  /** Record how an item stands while nobody has edited it yet. */
  remember: (id: string, value: unknown) => void;
  /** Whether `value` is what the form held before the first edit. */
  isUnchanged: (id: string, value: unknown) => boolean;
  /** Forget everything, for a reopened or reset modal. */
  reset: () => void;
}

export function usePristineItemValues(): PristineItemValues {
  const pristine = useRef<Record<string, unknown>>({});

  const remember = useCallback((id: string, value: unknown) => {
    pristine.current[id] = value;
  }, []);

  const isUnchanged = useCallback(
    (id: string, value: unknown) =>
      // An item nobody recorded is one we cannot vouch for -- a filter added
      // in this session, or one whose form never mounted. Saying "changed"
      // there keeps the save, which is the side to be wrong on.
      id in pristine.current && isEqual(pristine.current[id], value),
    [],
  );

  const reset = useCallback(() => {
    pristine.current = {};
  }, []);

  return { remember, isUnchanged, reset };
}

/**
 * How a filter's own form reports its pristine value to the modal.
 *
 * The modal cannot read it for itself. A filter's dataset and column arrive
 * from a fetch, and that fetch settling re-renders the filter's form, not the
 * modal around it -- so a reading taken from the modal is always the empty
 * one taken a moment too early. The form is the only component that re-renders
 * when its own fields settle, so it is the one that has to report.
 *
 * The modal's implementation ignores a report for an item already marked
 * modified, which is what freezes the baseline at the last reading before the
 * first edit.
 */
export const PristineItemValuesContext = createContext<(id: string) => void>(
  () => {},
);

/** Report this item's current value while it is still untouched. */
export function useReportPristineValue(id: string): void {
  const report = useContext(PristineItemValuesContext);
  // Deliberately on every render: the point is to catch the render in which
  // the form's asynchronous fields settle, which is not otherwise signalled.
  useEffect(() => {
    report(id);
  });
}
