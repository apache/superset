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
import { useHistory } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { Tag } from '@superset-ui/core/components';
import { fetchOpenByAsset } from './api';
import { approvalsPath } from './approvalsPath';
import type { ChangeStatus, ReviewAssetType } from './types';

/**
 * List rows get a tag and nothing more (Decision 7). The list is for
 * finding things; the decision happens on the asset or in Approvals.
 */
const LIST_LABEL: Partial<Record<ChangeStatus, string>> = {
  pending: t('Awaiting review'),
  // SOW 5.5 and mock 6 both name this badge "Changes pending".
  draft: t('Changes pending'),
  changes_requested: t('Changes requested'),
};

const LIST_COLOR: Partial<Record<ChangeStatus, string>> = {
  pending: 'blue',
  draft: 'default',
  changes_requested: 'orange',
};

/**
 * One request per list, shared by every row.
 *
 * Returns an empty map when review is off or the reader is a viewer, so
 * rows render exactly as they do today.
 */
export function useOpenChanges(
  assetType: ReviewAssetType,
): Record<string, ChangeStatus> {
  const enabled = isFeatureEnabled(FeatureFlag.ChangeManagement);
  const [open, setOpen] = useState<Record<string, ChangeStatus>>({});

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setOpen({});
      return undefined;
    }
    fetchOpenByAsset(assetType)
      .then(result => {
        if (!cancelled) setOpen(result);
      })
      .catch(() => {
        // A list that cannot read review state is still a usable list.
        if (!cancelled) setOpen({});
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, assetType]);

  return open;
}

export interface ReviewStatusTagProps {
  status?: ChangeStatus;
  /**
   * With both of these the tag is a link to the open request's page. The
   * open-changes map is keyed by asset and carries only a status, so the
   * request id is looked up on click rather than for every row up front.
   */
  assetType?: ReviewAssetType;
  assetId?: number | string;
}

function LinkedReviewTag({
  status,
  assetType,
  assetId,
}: Required<ReviewStatusTagProps>) {
  const history = useHistory();

  const openRequest = useCallback(() => {
    history.push(approvalsPath());
  }, [history]);

  return (
    // A real anchor, so it is keyboard- and middle-click-reachable; the
    // click handler swaps the generic list for this asset's own request.
    <a
      href={approvalsPath()}
      onClick={event => {
        event.preventDefault();
        openRequest();
      }}
    >
      <Tag
        color={LIST_COLOR[status]}
        data-test="review-status-tag"
        style={{ cursor: 'pointer' }}
      >
        {LIST_LABEL[status]}
      </Tag>
    </a>
  );
}

export default function ReviewStatusTag({
  status,
  assetType,
  assetId,
}: ReviewStatusTagProps) {
  if (!status || !LIST_LABEL[status]) return null;
  if (assetType && assetId !== undefined) {
    return (
      <LinkedReviewTag
        status={status}
        assetType={assetType}
        assetId={assetId}
      />
    );
  }
  return (
    <Tag color={LIST_COLOR[status]} data-test="review-status-tag">
      {LIST_LABEL[status]}
    </Tag>
  );
}
