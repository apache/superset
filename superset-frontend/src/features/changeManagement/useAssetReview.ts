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
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { fetchForAsset } from './api';
import { onChangeCaptured, onReviewChanged } from './events';
import type { ChangeRequest, ReviewAssetType } from './types';
import { requestFacts, reviewLog } from './log';

/**
 * Decided requests this tab has already withheld, by asset.
 *
 * Session storage rather than a ref, because the host reloads the page on
 * an applied action and the leftover is offered again to the fresh page.
 * Read and written through try/catch: storage can be unavailable, and a
 * banner is not worth an exception.
 */
const staleNudgeKey = (assetType: ReviewAssetType, assetId: number) =>
  `superset:change-management:stale-nudge:${assetType}:${assetId}`;

function staleNudges(assetType: ReviewAssetType, assetId: number): number[] {
  try {
    const raw = window.sessionStorage.getItem(staleNudgeKey(assetType, assetId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

function isStaleNudge(
  assetType: ReviewAssetType,
  assetId: number,
  id: number,
): boolean {
  return staleNudges(assetType, assetId).includes(id);
}

function rememberStaleNudge(
  assetType: ReviewAssetType,
  assetId: number,
  id: number,
): void {
  try {
    const known = staleNudges(assetType, assetId);
    if (known.includes(id)) return;
    window.sessionStorage.setItem(
      staleNudgeKey(assetType, assetId),
      JSON.stringify([...known, id]),
    );
  } catch {
    // Nothing to do: without storage the nudge comes back after a reload,
    // which is what it did before any of this.
  }
}

export interface AssetReview {
  changeRequest: ChangeRequest | null;
  loading: boolean;
  /** Re-read after any action, so the banner reflects what just happened. */
  refresh: () => Promise<void>;
}

/**
 * The open change request on an asset, if the current user may see it.
 *
 * Returns null and never calls the API when review is switched off, so an
 * instance without the feature does no extra work and renders nothing
 * (SOW 6.1: with it off, Superset behaves exactly as today).
 *
 * A failed lookup also yields null rather than surfacing an error. The
 * banner is an addition to the page, not the page itself; a review service
 * that is briefly unreachable should not stop someone reading a dashboard.
 */
export function useAssetReview(
  assetType: ReviewAssetType,
  assetId?: number | null,
): AssetReview {
  const enabled = isFeatureEnabled(FeatureFlag.ChangeManagement);
  const [changeRequest, setChangeRequest] = useState<ChangeRequest | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  /**
   * The request this page has been following, by id.
   *
   * Only read by the guard below, which needs to know whether a decided
   * request the server has just offered is news or a leftover.
   */
  const followingRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !assetId) {
      setChangeRequest(null);
      return;
    }
    setLoading(true);
    try {
      const fetched = await fetchForAsset(assetType, assetId);
      reviewLog('banner: read the review status', {
        reader: 'useAssetReview',
        ...requestFacts(fetched),
      });
      // A decided request the server hands back in place of the open one
      // this page was following is not news, and must not be shown as
      // though it were.
      //
      // `for_asset` falls back to a recently approved request of the
      // reader's own when nothing is open (RECENTLY_DECIDED, twelve
      // hours). That window is wanted: an approval is otherwise silent,
      // and an author who opens the asset afterwards is owed the one
      // outcome they were waiting for. But the fallback fires on every
      // read with nothing open, including the read taken right after the
      // author discarded a *different* change -- so discarding a draft
      // flipped the banner to "Priya Shah approved your change · it is
      // live for viewers", which beside a "Changes discarded." toast
      // reads as though the discard had published something.
      //
      // Keyed on the id, not on the status: the same request going from
      // pending to approved while this page is open is exactly the news
      // the window exists to carry, and it keeps its id. Only a decided
      // request that is not the one we were following is withheld.
      //
      // The withholding has to outlive the page, because the host reloads
      // on an applied action (`onApplied` is `window.location.reload` in
      // DashboardBuilder), and a reload is a page that has followed
      // nothing. So the leftover is remembered by id, for this tab, and
      // withheld again on the way back. By id rather than by a cutoff
      // time: a *later* approval on the same asset is still news and must
      // come through.
      //
      // This is the half of the rule a client can answer. The whole of it
      // belongs in `for_asset`, which can see that a later request on the
      // asset was decided after this approval and so should not offer the
      // approval as the latest word; see the report for the query. Until
      // then this is per-tab, and degrades to today's behaviour -- never
      // to worse -- in a new tab or with storage unavailable.
      const following = followingRef.current;
      if (
        fetched &&
        !fetched.is_open &&
        ((following !== null && following !== fetched.id) ||
          isStaleNudge(assetType, assetId, fetched.id))
      ) {
        reviewLog('banner: withheld a decided request we were not following', {
          reader: 'useAssetReview',
          following,
          ...requestFacts(fetched),
        });
        rememberStaleNudge(assetType, assetId, fetched.id);
        setChangeRequest(null);
        return;
      }
      if (fetched) followingRef.current = fetched.id;
      setChangeRequest(fetched);
    } catch (error) {
      reviewLog('banner: could not read the review status', {
        reader: 'useAssetReview',
        asset: `${assetType} ${assetId}`,
        error: String(error),
      });
      setChangeRequest(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, assetType, assetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A save that was captured for review happened on this page, so what we
  // fetched on load is already stale: re-read rather than make the author
  // reload to discover their own draft (129074).
  useEffect(
    () =>
      onChangeCaptured(() => {
        refresh();
      }),
    [refresh],
  );

  // ...and on a transition, so this hook and `useOpenChange` below always
  // answer the same question the same way. They used to diverge the moment
  // a request was submitted.
  useEffect(
    () =>
      onReviewChanged(() => {
        refresh();
      }),
    [refresh],
  );

  return { changeRequest, loading, refresh };
}

/**
 * Just "is there an open change on this asset, and is it mine".
 *
 * For callers that only need to decide whether to offer a review action --
 * the ⋯ menu -- and would otherwise pull the whole review state in to
 * answer a yes/no question.
 */
export function useOpenChange(
  assetType: ReviewAssetType,
  assetId?: number | null,
) {
  const [changeRequest, setChangeRequest] = useState<ChangeRequest | null>(
    null,
  );
  // Re-read on a capture, for the same reason useAssetReview does and on
  // the same signal. This answer decides whether Request review is
  // offered at all, and a save is the moment it changes: after the author
  // saved a fix for a review that had been sent back, the banner updated
  // and the action beside it did not, so there was no way to send the fix
  // on without reloading the page (QA-14).
  const [captured, setCaptured] = useState(0);

  useEffect(() => onChangeCaptured(() => setCaptured(count => count + 1)), []);
  // And on every transition. Without this the toolbar kept the status it
  // read on load: after a submit it still believed the request was a draft,
  // so it offered "Request review" on a change already with a reviewer,
  // enabled, over a tooltip calling it "your saved draft". The click did
  // nothing, because the dialog it opens is for drafts.
  useEffect(() => onReviewChanged(() => setCaptured(count => count + 1)), []);

  useEffect(() => {
    let live = true;
    if (!assetId || !isFeatureEnabled(FeatureFlag.ChangeManagement)) {
      setChangeRequest(null);
      return () => {
        live = false;
      };
    }
    fetchForAsset(assetType, assetId)
      .then(result => {
        reviewLog('toolbar: read the review status', {
          reader: 'useOpenChange',
          stillMounted: live,
          ...requestFacts(result),
        });
        if (live) setChangeRequest(result);
      })
      .catch(error => {
        reviewLog('toolbar: could not read the review status', {
          reader: 'useOpenChange',
          asset: `${assetType} ${assetId}`,
          error: String(error),
        });
        if (live) setChangeRequest(null);
      });
    return () => {
      live = false;
    };
  }, [assetType, assetId, captured]);

  return changeRequest;
}
