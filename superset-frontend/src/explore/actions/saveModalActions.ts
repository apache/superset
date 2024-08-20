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
import {
  DatasourceType,
  type QueryFormData,
  SimpleAdhocFilter,
  SupersetClient,
  t,
} from '@superset-ui/core';
import { addSuccessToast } from 'src/components/MessageToasts/actions';
import { isEmpty } from 'lodash';
import { Slice } from 'src/dashboard/types';
import { Operators } from '../constants';
import { buildV1ChartDataPayload } from '../exploreUtils';

export interface PayloadSlice extends Slice {
  params: string;
  dashboards: number[];
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

export const SET_SAVE_CHART_MODAL_VISIBILITY =
  'SET_SAVE_CHART_MODAL_VISIBILITY';
export function setSaveChartModalVisibility(isVisible: boolean) {
  return { type: SET_SAVE_CHART_MODAL_VISIBILITY, isVisible };
}

export const SAVE_SLICE_FAILED = 'SAVE_SLICE_FAILED';
export function saveSliceFailed() {
  return { type: SAVE_SLICE_FAILED };
}

export const SAVE_SLICE_SUCCESS = 'SAVE_SLICE_SUCCESS';
export function saveSliceSuccess(data: Partial<QueryFormData>) {
  return { type: SAVE_SLICE_SUCCESS, data };
}

function extractAdhocFiltersFromFormData(
  formDataToHandle: QueryFormData,
): Partial<QueryFormData> {
  const result: Partial<QueryFormData> = {};
  Object.entries(formDataToHandle).forEach(([key, value]) => {
    if (ADHOC_FILTER_REGEX.test(key) && Array.isArray(value)) {
      result[key] = (value as SimpleAdhocFilter[]).filter(
        (f: SimpleAdhocFilter) => !f.isExtra,
      );
    }
  });
  return result;
}

const hasTemporalRangeFilter = (formData: Partial<QueryFormData>): boolean =>
  (formData?.adhoc_filters || []).some(
    (filter: SimpleAdhocFilter) => filter.operator === Operators.TemporalRange,
  );

export const getSlicePayload = (
  sliceName: string,
  formDataWithNativeFilters: QueryFormData = {} as QueryFormData,
  dashboards: number[],
  owners: [],
  formDataFromSlice: QueryFormData = {} as QueryFormData,
): Partial<PayloadSlice> => {
  const adhocFilters: Partial<QueryFormData> = extractAdhocFiltersFromFormData(
    formDataWithNativeFilters,
  );

  if (
    !isEmpty(formDataFromSlice) &&
    formDataWithNativeFilters.adhoc_filters &&
    formDataWithNativeFilters.adhoc_filters.length > 0
  ) {
    Object.keys(adhocFilters).forEach(adhocFilterKey => {
      if (isEmpty(adhocFilters[adhocFilterKey])) {
        const sourceFilters = formDataFromSlice[adhocFilterKey];
        if (Array.isArray(sourceFilters)) {
          const targetArray = adhocFilters[adhocFilterKey] || [];
          sourceFilters.forEach(filter => {
            if (filter.operator === Operators.TemporalRange) {
              targetArray.push({
                ...filter,
                comparator: filter.comparator || 'No filter',
              });
            }
          });
          adhocFilters[adhocFilterKey] = targetArray;
        }
      }
    });
  }

  if (!hasTemporalRangeFilter(adhocFilters)) {
    formDataWithNativeFilters.adhoc_filters?.forEach(
      (filter: SimpleAdhocFilter) => {
        if (filter.operator === Operators.TemporalRange && filter.isExtra) {
          if (!adhocFilters.adhoc_filters) {
            adhocFilters.adhoc_filters = [];
          }
          adhocFilters.adhoc_filters.push({
            ...filter,
            comparator: 'No filter',
          });
        }
      },
    );
  }
  const formData = {
    ...formDataWithNativeFilters,
    ...adhocFilters,
    dashboards,
  };
  let datasourceId = 0;
  let datasourceType: DatasourceType = DatasourceType.Table;

  if (formData.datasource) {
    const [id, typeString] = formData.datasource.split('__');
    datasourceId = parseInt(id, 10);

    const formattedTypeString =
      typeString.charAt(0).toUpperCase() + typeString.slice(1);
    if (formattedTypeString in DatasourceType) {
      datasourceType =
        DatasourceType[formattedTypeString as keyof typeof DatasourceType];
    }
  }

  const payload: Partial<PayloadSlice> = {
    params: JSON.stringify(formData),
    slice_name: sliceName,
    viz_type: formData.viz_type,
    datasource_id: datasourceId,
    datasource_type: datasourceType,
    dashboards,
    owners,
    query_context: JSON.stringify(
      buildV1ChartDataPayload({
        formData,
        force: false,
        resultFormat: 'json',
        resultType: 'full',
        setDataMask: null,
        ownState: null,
      }),
    ),
  };

  return payload;
};

const addToasts = (
  isNewSlice: boolean,
  sliceName: string,
  addedToDashboard?: {
    title: string;
    new?: boolean;
  },
) => {
  const toasts = [];
  if (isNewSlice) {
    toasts.push(addSuccessToast(t('Chart [%s] has been saved', sliceName)));
  } else {
    toasts.push(
      addSuccessToast(t('Chart [%s] has been overwritten', sliceName)),
    );
  }

  if (addedToDashboard) {
    if (addedToDashboard.new) {
      toasts.push(
        addSuccessToast(
          t(
            'Dashboard [%s] just got created and chart [%s] was added to it',
            addedToDashboard.title,
            sliceName,
          ),
        ),
      );
    } else {
      toasts.push(
        addSuccessToast(
          t(
            'Chart [%s] was added to dashboard [%s]',
            sliceName,
            addedToDashboard.title,
          ),
        ),
      );
    }
  }

  return toasts;
};

export const updateSlice =
  (
    slice: Slice,
    sliceName: string,
    dashboards: number[],
    addedToDashboard?: {
      title: string;
      new?: boolean;
    },
  ) =>
  async (dispatch: Dispatch, getState: () => Partial<QueryFormData>) => {
    const { slice_id: sliceId, owners, form_data: formDataFromSlice } = slice;
    const formData = getState().explore?.form_data;
    try {
      const response = await SupersetClient.put({
        endpoint: `/api/v1/chart/${sliceId}`,
        jsonPayload: getSlicePayload(
          sliceName,
          formData,
          dashboards,
          owners as [],
          formDataFromSlice,
        ),
      });

      dispatch(saveSliceSuccess(response.json));
      addToasts(false, sliceName, addedToDashboard).map(dispatch);
      return response.json;
    } catch (error) {
      dispatch(saveSliceFailed());
      throw error;
    }
  };

export const createSlice =
  (
    sliceName: string,
    dashboards: number[],
    addedToDashboard?: {
      title: string;
      new?: boolean;
    },
  ) =>
  async (dispatch: Dispatch, getState: () => Partial<QueryFormData>) => {
    const formData = getState().explore?.form_data;
    try {
      const response = await SupersetClient.post({
        endpoint: `/api/v1/chart/`,
        jsonPayload: getSlicePayload(
          sliceName,
          formData,
          dashboards,
          [],
          {} as QueryFormData,
        ),
      });

      dispatch(saveSliceSuccess(response.json));
      addToasts(true, sliceName, addedToDashboard).map(dispatch);
      return response.json;
    } catch (error) {
      dispatch(saveSliceFailed());
      throw error;
    }
  };

export const createDashboard =
  (dashboardName: string) => async (dispatch: Dispatch) => {
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

export const getSliceDashboards =
  (slice: Partial<Slice>) => async (dispatch: Dispatch) => {
    try {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/chart/${slice.slice_id}?q=${rison.encode({
          columns: ['dashboards.id'],
        })}`,
      });

      return response.json.result.dashboards.map(
        ({ id }: { id: number }) => id,
      );
    } catch (error) {
      dispatch(saveSliceFailed());
      throw error;
    }
  };
