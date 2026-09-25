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

  useEffect(() => {
    setTag(null);
    if (!sliceId) {
      return;
    }
    fetchTags(
      { objectType: 'chart', objectId: sliceId },
      (tags: TagType[]) => {
        setTag(tags.find(t => t.name === LEGACY_AGGREGATION_TAG) ?? null);
      },
      error => {
        logging.warn('Failed to fetch chart tags', error);
      },
    );
  }, [sliceId]);

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
