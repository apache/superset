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
import { SupersetClient } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { TagType } from 'src/components';
import { fetchTags, OBJECT_TYPE_ID_MAP } from 'src/features/tags/tags';
import { LEGACY_AGGREGATION_TAG } from 'src/explore/constants';

type DeleteOutcome = 'removed' | 'forbidden' | 'failed';

const CHART = { objectType: 'chart' } as const;

/**
 * Remove the legacy-aggregation tag (see LEGACY_AGGREGATION_TAG) from a saved
 * chart, resolving `true` once the chart no longer carries it.
 *
 * The straightforward way is `DELETE /api/v1/tag/...`, but that route is
 * gated on `can_write` on `Tag`, which a custom role can withhold from a
 * chart owner (every default role has it). The backend's own answer for
 * that owner is the chart `PUT` with a `tags` list: `validate_tags` accepts
 * either `can_write` on `Tag` *or* `can_tag` on `Chart`, so on a 403 from
 * the tag route this falls back to re-saving the chart's custom tag list
 * minus the legacy one. That fallback goes through `UpdateChartCommand`,
 * which also stamps `last_saved_at`/`last_saved_by`, so it is kept as the
 * fallback rather than the first choice.
 *
 * Never rejects: both callers (the Explore notice's "Accept" button and a
 * pivot table save) treat removal as best-effort, and a chart that was
 * never tagged (404) counts as removed since there's nothing left to do.
 */
export async function removeLegacyAggregationTag(
  sliceId: number,
): Promise<boolean> {
  // Called directly rather than through `deleteTaggedObjects`, which maps
  // every failure to a message string: the status is what decides whether
  // the chart tag list is worth trying.
  const outcome: DeleteOutcome = await SupersetClient.delete({
    endpoint: `/api/v1/tag/${OBJECT_TYPE_ID_MAP.chart}/${sliceId}/${LEGACY_AGGREGATION_TAG}`,
  })
    .then((): DeleteOutcome => 'removed')
    .catch((error: unknown): DeleteOutcome => {
      const status = (error as { status?: number } | undefined)?.status;
      if (status === 404) {
        return 'removed';
      }
      if (status === 403) {
        return 'forbidden';
      }
      logging.warn('Failed to remove legacy aggregation tag', error);
      return 'failed';
    });
  if (outcome !== 'forbidden') {
    return outcome === 'removed';
  }

  try {
    const tags = await new Promise<TagType[]>((resolve, reject) => {
      fetchTags({ ...CHART, objectId: sliceId }, resolve, reject);
    });
    const remaining = tags.filter(tag => tag.name !== LEGACY_AGGREGATION_TAG);
    if (remaining.length === tags.length) {
      return true;
    }
    await SupersetClient.put({
      endpoint: `/api/v1/chart/${sliceId}`,
      jsonPayload: { tags: remaining.map(tag => tag.id) },
    });
    return true;
  } catch (error) {
    logging.warn(
      'Failed to remove legacy aggregation tag through the chart tag list',
      error,
    );
    return false;
  }
}
