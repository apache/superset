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
import { omit } from 'lodash-es';
import { explore as exploreApi } from '@apache-superset/core';
import type {
  ChartDataResponseResult,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import { setControlValue } from 'src/explore/actions/exploreActions';
import { getFormDataFromControls } from 'src/explore/controlUtils';
import { QUERY_MODE_REQUISITES } from 'src/explore/constants';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import { store, RootState } from 'src/views/store';
import { navigation } from '../navigation';

const getExploreState = () => (store.getState() as RootState).explore;

// The Redux slice below is retained across an in-SPA navigation, so
// checking it alone can't tell a still-active chart from a stale one left
// over from before the user navigated to another page.
const isExploreActive = (): boolean => navigation.getPage() === 'explore';

const getChartId: typeof exploreApi.getChartId = () =>
  isExploreActive()
    ? (getExploreState().slice?.slice_id ?? undefined)
    : undefined;

const getControlValues: typeof exploreApi.getControlValues = () =>
  isExploreActive()
    ? { ...(getExploreState().form_data as Record<string, unknown>) }
    : {};

const getControlValue: typeof exploreApi.getControlValue = (name: string) =>
  isExploreActive()
    ? (getExploreState().form_data as Record<string, unknown>)[name]
    : undefined;

// Explore queries with the form data derived from the current `controls`
// state (see ExploreViewContainer's mapStateToProps), not the pre-normalization
// `form_data` slice, which can lag behind controls filled in by defaults or by
// mapStateToProps. Building form data the same way keeps getQuery()/
// getChartData() describing the same data as the chart on screen.
const getCurrentFormData = (): QueryFormData => {
  const { controls, hiddenFormData } = getExploreState();
  const hasQueryMode = !!controls?.query_mode?.value;
  const fieldsToOmit = hasQueryMode
    ? Object.keys(hiddenFormData ?? {}).filter(
        key => !QUERY_MODE_REQUISITES.has(key),
      )
    : Object.keys(hiddenFormData ?? {});
  return omit(
    getFormDataFromControls(controls ?? {}),
    fieldsToOmit,
  ) as QueryFormData;
};

// Mirrors the currently-applied server-side state (e.g. a Table chart's
// current page) that Explore keeps in `dataMask` rather than `form_data`, so
// a paginated chart's exported query/data matches what's on screen.
const getOwnState = (chartId: number | undefined): JsonObject | undefined =>
  chartId != null
    ? (store.getState() as RootState).dataMask[chartId]?.ownState
    : undefined;

const requireFormData = (): QueryFormData => {
  const formData = getCurrentFormData();
  if (!isExploreActive() || !formData?.datasource) {
    throw new Error('No chart is currently loaded in Explore');
  }
  return formData;
};

const setControlValues: typeof exploreApi.setControlValues = async (
  values: Record<string, unknown>,
) => {
  requireFormData();
  Object.entries(values).forEach(([controlName, value]) => {
    store.dispatch(
      setControlValue(controlName, value, undefined, { programmatic: true }),
    );
  });
};

const getQuery: typeof exploreApi.getQuery = async () => {
  const formData = requireFormData();
  // With GLOBAL_ASYNC_QUERIES enabled, an uncached request comes back as a
  // 202 job envelope rather than the result array, so this must go through
  // the same async-response handling as a normal chart query.
  const results = await requestChartDataResolved({
    formData,
    resultFormat: 'json',
    resultType: 'query',
    ownState: getOwnState(getChartId()),
  });
  const result = results?.[0] as ChartDataResponseResult | undefined;
  if (!result || result.error) {
    throw new Error(result?.error ?? 'Failed to retrieve the query');
  }
  return result.query;
};

const getChartData: typeof exploreApi.getChartData = async () => {
  const formData = requireFormData();
  // With GLOBAL_ASYNC_QUERIES enabled, an uncached request comes back as a
  // 202 job envelope rather than the result array, so this must go through
  // the same async-response handling as a normal chart query.
  const results = await requestChartDataResolved({
    formData,
    resultFormat: 'json',
    resultType: 'full',
    ownState: getOwnState(getChartId()),
  });
  const result = results?.[0] as ChartDataResponseResult | undefined;
  if (!result || result.error) {
    throw new Error(result?.error ?? 'Failed to export chart data');
  }
  return {
    columns: result.colnames ?? [],
    rows: (result.data ?? []) as Record<string, unknown>[],
  };
};

export const explore: typeof exploreApi = {
  getChartId,
  getControlValues,
  getControlValue,
  setControlValues,
  getQuery,
  getChartData,
};
