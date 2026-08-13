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
import { JsonObject, QueryFormData } from '@superset-ui/core';
import { omit } from 'lodash-es';
import { UNSAVED_CHART_ID } from 'src/explore/constants';
import type { ExplorePageState } from 'src/explore/types';

/**
 * Explore stores the chart's form data in the history entry so that stepping
 * back through entries restores previous chart states. The marker tells those
 * entries apart from regular navigation to another page or chart.
 */
const CHART_STATE_MARKER = '__exploreChartState';

/**
 * The chart id has to be stamped on: form data assembled from the controls
 * carries none, so a state would otherwise not be attributable to its chart.
 */
export const toChartStateHistoryState = (
  formData: QueryFormData,
  chartId?: number,
): JsonObject => ({
  ...formData,
  slice_id: formData.slice_id ?? chartId,
  [CHART_STATE_MARKER]: true,
});

export const getChartStateFromHistoryState = (
  state: unknown,
): QueryFormData | undefined =>
  state &&
  typeof state === 'object' &&
  (state as JsonObject)[CHART_STATE_MARKER] === true
    ? (omit(state as JsonObject, CHART_STATE_MARKER) as QueryFormData)
    : undefined;

/**
 * Chart states are only interchangeable within the same chart and dataset -
 * applying one to another chart would mix the two.
 */
/**
 * The chart a state can be restored into. ExplorePage decides whether to reload
 * and ExploreViewContainer whether to restore, so both have to read it here -
 * disagreeing leaves a POP resolving to neither.
 */
export const selectRestoreTarget = (
  state: ExplorePageState,
): Partial<QueryFormData> => ({
  slice_id:
    state.explore?.slice?.slice_id ?? state.explore?.form_data?.slice_id,
  datasource: state.explore?.controls?.datasource?.value as string | undefined,
});

export const isSameChartState = (
  a?: Partial<QueryFormData>,
  b?: Partial<QueryFormData>,
): boolean =>
  !!a &&
  !!b &&
  (a.slice_id ?? UNSAVED_CHART_ID) === (b.slice_id ?? UNSAVED_CHART_ID) &&
  a.datasource === b.datasource;
