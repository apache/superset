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
import rison from 'rison';
import { Dispatch } from 'redux';
import { SupersetClient, t } from '@superset-ui/core';
import { addSuccessToast } from 'src/components/MessageToasts/actions';
import { isEmpty } from 'lodash';
import { Operators } from '../constants';
interface Dashboard {
  title: string;
  new?: boolean;
}

interface Slice {
  slice_id: number;
  owners: string[];
  form_data: FormData;
}

interface FormData {
  datasource: string;
  viz_type: string;
  adhoc_filters?: AdhocFilter[];
  [key: string]: string | number | AdhocFilter[] | undefined;
}

interface AdhocFilter {
  clause?: string;
  subject?: string;
  operator: string;
  comparator?: string;
  expressionType?: string;
  isExtra?: boolean;
}

interface SlicePayload {
  params: string;
  slice_name: string;
  viz_type: string;
  datasource_id: number;
  datasource_type: string;
  dashboards: number[];
  owners: string[];
  query_context: string;
}

const ADHOC_FILTER_REGEX = /^adhoc_filters/;

export const FETCH_DASHBOARDS_SUCCEEDED = 'FETCH_DASHBOARDS_SUCCEEDED';
export function fetchDashboardsSucceeded(choices: string[]) {
  return { type: FETCH_DASHBOARDS_SUCCEEDED, choices };
}

export const FETCH_DASHBOARDS_FAILED = 'FETCH_DASHBOARDS_FAILED';
export function fetchDashboardsFailed(userId: string) {
  return { type: FETCH_DASHBOARDS_FAILED, userId };
}

export const SET_SAVE_CHART_MODAL_VISIBILITY = 'SET_SAVE_CHART_MODAL_VISIBILITY';
export function setSaveChartModalVisibility(isVisible: boolean) {
  return { type: SET_SAVE_CHART_MODAL_VISIBILITY, isVisible };
}

export const SAVE_SLICE_FAILED = 'SAVE_SLICE_FAILED';
export function saveSliceFailed() {
  return { type: SAVE_SLICE_FAILED };
}

export const SAVE_SLICE_SUCCESS = 'SAVE_SLICE_SUCCESS';
export function saveSliceSuccess(data: any) {
  return { type: SAVE_SLICE_SUCCESS, data };
}

function extractAdhocFiltersFromFormData(formDataToHandle: FormData): Partial<FormData> {
  return Object.entries(formDataToHandle).reduce<Partial<FormData>>((acc, [key, value]) => {
    if (ADHOC_FILTER_REGEX.test(key) && Array.isArray(value)) {
      const filteredFilters = value.filter((f: AdhocFilter) => !f.isExtra);
      return { ...acc, [key]: filteredFilters };
    }
    return acc;
  }, {});
}

const hasTemporalRangeFilter = (formData: Partial<FormData>): boolean =>
  (formData?.adhoc_filters || []).some(
    (filter: any) => filter.operator === Operators.TemporalRange,
  );

export const getSlicePayload = (
  sliceName: string,
  formDataWithNativeFilters: FormData = {} as FormData,
  dashboards: number[],
  owners: string[],
  formDataFromSlice: FormData = {} as FormData,
): SlicePayload => {
  const adhocFilters: Partial<FormData> = extractAdhocFiltersFromFormData(formDataWithNativeFilters);
  if (!isEmpty(formDataFromSlice)) {
    Object.keys(adhocFilters).forEach(adhocFilterKey => {
      if (isEmpty(adhocFilters[adhocFilterKey])) {
        if (Array.isArray(formDataFromSlice[adhocFilterKey])) {
          const filters = formDataFromSlice[adhocFilterKey] as AdhocFilter[];
          filters.forEach(filter => {
            if (filter.operator === Operators.TemporalRange && !filter.isExtra) {
              const targetArray = adhocFilters[adhocFilterKey] as AdhocFilter[] || [];
              targetArray.push({
                ...filter,
                comparator: 'No filter',
              });
              adhocFilters[adhocFilterKey] = targetArray;
            }
          });
        }
      }
    });
  }

  if (!hasTemporalRangeFilter(adhocFilters)) {
    formDataWithNativeFilters.adhoc_filters?.forEach((filter: AdhocFilter) => {
      if (filter.operator === Operators.TemporalRange && filter.isExtra) {
        if (!adhocFilters.adhoc_filters) {
          adhocFilters.adhoc_filters = [];
        }
        adhocFilters.adhoc_filters.push({ ...filter, comparator: 'No filter' });
      }
    });
  }
  const formData = {
    ...formDataWithNativeFilters,
    ...adhocFilters,
    dashboards,
  };

  const [datasourceId, datasourceType] = formData.datasource.split('__');
  const payload: SlicePayload = {
    params: JSON.stringify(formData),
    slice_name: sliceName,
    viz_type: formData.viz_type,
    datasource_id: parseInt(datasourceId, 10),
    datasource_type: datasourceType,
    dashboards,
    owners,
    query_context: JSON.stringify({
      formData,
      force: false,
      resultFormat: 'json',
      resultType: 'full',
      setDataMask: null,
      ownState: null,
    }),
  };

  return payload;
}
const addToasts = (isNewSlice: boolean, sliceName: string, addedToDashboard: Dashboard) => {
  const toasts = [];
  if (isNewSlice) {
    toasts.push(addSuccessToast(t('Chart [%s] has been saved', sliceName)));
  } else {
    toasts.push(addSuccessToast(t('Chart [%s] has been overwritten', sliceName)));
  }

  if (addedToDashboard) {
    if (addedToDashboard.new) {
      toasts.push(
        addSuccessToast(t('Dashboard [%s] just got created and chart [%s] was added to it', addedToDashboard.title, sliceName)),
      );
    } else {
      toasts.push(addSuccessToast(t('Chart [%s] was added to dashboard [%s]', sliceName, addedToDashboard.title)));
    }
  }

  return toasts;
};

export const updateSlice = (slice: Slice, sliceName: string, dashboards: number[], addedToDashboard: Dashboard) => async (dispatch: Dispatch, getState: () => any) => {
  const { slice_id: sliceId, owners, form_data: formDataFromSlice } = slice;
  const { explore: { form_data: { url_params: _, ...formData } } } = getState();
  try {
    const response = await SupersetClient.put({
      endpoint: `/api/v1/chart/${sliceId}`,
      jsonPayload: getSlicePayload(sliceName, formData, dashboards, owners, formDataFromSlice),
    });

    dispatch(saveSliceSuccess(response.json));
    addToasts(false, sliceName, addedToDashboard).map(dispatch);
    return response.json;
  } catch (error) {
    dispatch(saveSliceFailed());
    throw error;
  }
};

export const createSlice = (sliceName: string, dashboards: number[], addedToDashboard: Dashboard) => async (dispatch: Dispatch, getState: () => any) => {
  const { explore: { form_data: { url_params: _, ...formData } } } = getState();
  try {
    const response = await SupersetClient.post({
      endpoint: `/api/v1/chart/`,
      jsonPayload: getSlicePayload(sliceName, formData, dashboards, [], {} as FormData),
    });

    dispatch(saveSliceSuccess(response.json));
    addToasts(true, sliceName, addedToDashboard).map(dispatch);
    return response.json;
  } catch (error) {
    dispatch(saveSliceFailed());
    throw error;
  }
};

export const createDashboard = (dashboardName: string) => async (dispatch: Dispatch) => {
  try {
    const response = await SupersetClient.post({
      endpoint: `/api/v1/dashboard/`,
      jsonPayload: { dashboard_title: dashboardName },
    });

    return response.json;
  } catch (error) {
    dispatch(saveSliceFailed());
    throw error;
  }
};

export const getSliceDashboards = (slice: Slice) => async (dispatch: Dispatch) => {
  try {
    const response = await SupersetClient.get({
      endpoint: `/api/v1/chart/${slice.slice_id}?q=${rison.encode({ columns: ['dashboards.id'] })}`,
    });

    return response.json.result.dashboards.map(({ id }: { id: number }) => id);
  } catch (error) {
    dispatch(saveSliceFailed());
    throw error;
  }
};
