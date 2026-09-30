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
import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { css } from '@apache-superset/core/theme';
import { TagType } from 'src/components';
import { fetchTags, deleteTaggedObjects } from 'src/features/tags/tags';
import { LEGACY_AGGREGATION_TAG } from 'src/explore/constants';
import { ExploreAlert } from './ExploreAlert';

interface LegacyAggregationAlertProps {
  sliceId?: number;
}

export const LegacyAggregationAlert = ({
  sliceId,
}: LegacyAggregationAlertProps) => {
  const [tag, setTag] = useState<TagType | null>(null);
  // A same-slice save is the other way (alongside this component's own
  // "Accept" button) a legacy aggregation tag can go away -- saveModalActions
  // deletes it server-side as part of a pivot_table_v2 save. This object
  // changes identity on every successful save, so including it below
  // re-fetches after a save and drops a tag the save already cleared,
  // instead of leaving this component's local state stale until the user
  // navigates away and back.
  const lastSaveResult = useSelector(
    (state: { saveModal?: { data?: unknown } }) => state.saveModal?.data,
  );

  useEffect(() => {
    setTag(null);
    if (!sliceId) {
      return undefined;
    }
    // Guards the async callbacks below against a stale in-flight request --
    // e.g. the user switches charts (`sliceId` changes) or saves again
    // (`lastSaveResult` changes) before the first request resolves.
    let cancelled = false;
    fetchTags(
      { objectType: 'chart', objectId: sliceId },
      (tags: TagType[]) => {
        if (cancelled) {
          return;
        }
        setTag(tags.find(t => t.name === LEGACY_AGGREGATION_TAG) ?? null);
      },
      error => {
        if (!cancelled) {
          logging.warn('Failed to fetch chart tags', error);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sliceId, lastSaveResult]);

  const removeTag = useCallback(() => {
    if (!sliceId || !tag) {
      return;
    }
    deleteTaggedObjects(
      { objectType: 'chart', objectId: sliceId },
      tag,
      () => setTag(null),
      error => logging.warn('Failed to remove legacy aggregation tag', error),
    );
  }, [sliceId, tag]);

  if (!tag) {
    return null;
  }

  return (
    <ExploreAlert
      title={t('This chart was updated to use the restored aggregation')}
      bodyText={t(
        'This pivot table used a legacy per-table aggregation setting that Superset previously ignored. It now computes correctly, so totals and subtotals may look different than before. Please validate them, then accept this notice or save the chart.',
      )}
      type="warning"
      primaryButtonText={t('Accept')}
      primaryButtonAction={removeTag}
      css={theme => css`
        margin: 0 0 ${theme.sizeUnit * 4}px 0;
      `}
    />
  );
};
