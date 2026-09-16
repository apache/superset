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
import { explore as exploreApi } from '@apache-superset/core';
import type { ChartDataResponseResult, QueryFormData } from '@superset-ui/core';
import { setControlValue } from 'src/explore/actions/exploreActions';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { store, RootState } from 'src/views/store';

const getExploreState = () => (store.getState() as RootState).explore;

const getChartId: typeof exploreApi.getChartId = () =>
  getExploreState().slice?.slice_id ?? undefined;

const getControlValues: typeof exploreApi.getControlValues = () => ({
  ...(getExploreState().form_data as Record<string, unknown>),
});

const getControlValue: typeof exploreApi.getControlValue = (name: string) =>
  (getExploreState().form_data as Record<string, unknown>)[name];

const setControlValues: typeof exploreApi.setControlValues = async (
  values: Record<string, unknown>,
) => {
  Object.entries(values).forEach(([controlName, value]) => {
    store.dispatch(
      setControlValue(controlName, value, undefined, { programmatic: true }),
    );
  });
};

const requireFormData = (): QueryFormData => {
  const { form_data } = getExploreState();
  if (!form_data?.datasource) {
    throw new Error('No chart is currently loaded in Explore');
  }
  return form_data;
};

const getQuery: typeof exploreApi.getQuery = async () => {
  const formData = requireFormData();
  const response = await getChartDataRequest({
    formData,
    resultFormat: 'json',
    resultType: 'query',
  });
  const result = response.json?.result?.[0] as
    | ChartDataResponseResult
    | undefined;
  if (!result || result.error) {
    throw new Error(result?.error ?? 'Failed to retrieve the query');
  }
  return result.query;
};

const getChartData: typeof exploreApi.getChartData = async () => {
  const formData = requireFormData();
  const response = await getChartDataRequest({
    formData,
    resultFormat: 'json',
    resultType: 'full',
  });
  const result = response.json?.result?.[0] as
    | ChartDataResponseResult
    | undefined;
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
