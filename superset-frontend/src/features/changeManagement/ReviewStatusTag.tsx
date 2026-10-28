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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';
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

// `assetType` and `assetId` are what the caller used to decide this variant
// should render at all, and they are passed on for that reason -- the link
// itself is the author's queue rather than this asset's own request.
function LinkedReviewTag({ status }: Required<ReviewStatusTagProps>) {
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

const OpenChangesContext = createContext<Record<string, ChangeStatus>>({});

/**
 * One bulk read of review state, shared by everything inside it.
 *
 * A dashboard shows many charts, and asking per chart would turn opening a
 * dashboard into a request per card -- the same reason the list pages read
 * once for the whole page. Mounted around the dashboard, the headers below
 * read the answer out of context instead.
 */
export function OpenChangesProvider({
  assetType,
  children,
}: PropsWithChildren<{ assetType: ReviewAssetType }>) {
  const open = useOpenChanges(assetType);
  return (
    <OpenChangesContext.Provider value={open}>
      {children}
    </OpenChangesContext.Provider>
  );
}

/** The open change for one asset, from the nearest provider. */
export function useOpenChangeStatus(
  assetId: number | string | undefined,
): ChangeStatus | undefined {
  const open = useContext(OpenChangesContext);
  return assetId === undefined ? undefined : open[String(assetId)];
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
