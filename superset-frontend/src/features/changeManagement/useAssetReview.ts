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
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { fetchForAsset } from './api';
import { onChangeCaptured } from './events';
import type { ChangeRequest, ReviewAssetType } from './types';

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

  const refresh = useCallback(async () => {
    if (!enabled || !assetId) {
      setChangeRequest(null);
      return;
    }
    setLoading(true);
    try {
      setChangeRequest(await fetchForAsset(assetType, assetId));
    } catch {
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
  useEffect(() => onChangeCaptured(() => void refresh()), [refresh]);

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
  const [changeRequest, setChangeRequest] = useState<ChangeRequest | null>(null);

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
        if (live) setChangeRequest(result);
      })
      .catch(() => {
        if (live) setChangeRequest(null);
      });
    return () => {
      live = false;
    };
  }, [assetType, assetId]);

  return changeRequest;
}
