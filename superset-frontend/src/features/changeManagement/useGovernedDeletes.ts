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
import { useEffect, useMemo, useState } from 'react';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { fetchGovernedDeletes } from './api';
import { onChangeCaptured } from './events';
import type { ReviewAssetType } from './types';

/**
 * Which of these assets' deletes would be held for review, as {id: boolean}.
 *
 * The delete confirmation has two outcomes and used to describe only one of
 * them: SOW 5.1 exempts a dashboard that has never been published, that
 * delete applies at once, and the dialog still promised a review (B1). An
 * id missing from the map is unanswered, and the copy helpers fall back to
 * the feature flag for it -- right for charts and datasets, which have no
 * exemption, and the pre-existing wording for the moment before the answer
 * lands.
 *
 * Only worth calling for dashboards. Asked once for the page's rows rather
 * than per click, the same shape `useOpenChanges` uses, because the
 * confirmation's copy is computed while the row renders and cannot wait.
 */
export function useGovernedDeletes(
  assetType: ReviewAssetType,
  ids: (number | string)[],
): Record<string, boolean> {
  const enabled = isFeatureEnabled(FeatureFlag.ChangeManagement);
  const [governed, setGoverned] = useState<Record<string, boolean>>({});
  // Publishing a dashboard is itself a captured change, and approving it
  // makes every later delete of that dashboard governed. A page that read
  // the answer on mount and never again would go on offering the draft
  // wording for a dashboard that is now live -- the same staleness
  // `useOpenChanges` refreshes against.
  const [captured, setCaptured] = useState(0);

  useEffect(() => onChangeCaptured(() => setCaptured(count => count + 1)), []);

  // The identity of `ids` is the caller's array, which is new on every
  // render of a list. Keyed on the contents instead, or this fetches in a
  // loop.
  const key = useMemo(() => ids.map(String).sort().join(','), [ids]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !key) {
      setGoverned({});
      return undefined;
    }
    fetchGovernedDeletes(assetType, key.split(','))
      .then(result => {
        if (!cancelled) setGoverned(result);
      })
      .catch(() => {
        // Unanswered, which the copy reads as the flag's own answer: the
        // wording this replaced. A list that cannot reach the endpoint is
        // still a usable list.
        if (!cancelled) setGoverned({});
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, assetType, key, captured]);

  return governed;
}

export default useGovernedDeletes;
