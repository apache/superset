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
import {
  DatasourceType,
  SupersetClient,
  t,
  getClientErrorObject,
} from '@superset-ui/core';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { Dispatch } from 'redux';
import { Slice } from '../types';

const FETCH_SLICES_PAGE_SIZE = 200;

export function getDatasourceParameter(
  datasourceId: number,
  datasourceType: DatasourceType,
) {
  return `${datasourceId}__${datasourceType}`;
}

export const ADD_SLICES = 'ADD_SLICES';
function addSlices(slices: { [id: number]: Slice }) {
  return { type: ADD_SLICES, payload: { slices } };
}

export const SET_SLICES = 'SET_SLICES';
function setSlices(slices: { [id: number]: Slice }) {
  return { type: SET_SLICES, payload: { slices } };
}

export const FETCH_ALL_SLICES_STARTED = 'FETCH_ALL_SLICES_STARTED';
function fetchAllSlicesStarted() {
  return { type: FETCH_ALL_SLICES_STARTED };
}

export const FETCH_ALL_SLICES_FAILED = 'FETCH_ALL_SLICES_FAILED';
function fetchAllSlicesFailed(error: string) {
  return { type: FETCH_ALL_SLICES_FAILED, payload: { error } };
}

const parseResult = (result: any[]) =>
  result.reduce((slices, slice: any) => {
    let form_data = JSON.parse(slice.params);
    form_data = {
      ...form_data,
      // force using datasource stored in relational table prop
      datasource:
        getDatasourceParameter(slice.datasource_id, slice.datasource_type) ||
        form_data.datasource,
    };
    return {
      ...slices,
      [slice.id]: {
        slice_id: slice.id,
        slice_url: slice.url,
        slice_name: slice.slice_name,
        form_data,
        datasource_name: slice.datasource_name_text,
        datasource_url: slice.datasource_url,
        datasource_id: slice.datasource_id,
        datasource_type: slice.datasource_type,
        changed_on: new Date(slice.changed_on_utc).getTime(),
        description: slice.description,
        description_markdown: slice.description_markeddown,
        viz_type: slice.viz_type,
        modified: slice.changed_on_delta_humanized,
        changed_on_humanized: slice.changed_on_delta_humanized,
        thumbnail_url: slice.thumbnail_url,
        owners: slice.owners,
        created_by: slice.created_by,
      },
    };
  }, {});

export function updateSlices(slices: { [id: number]: Slice }) {
  return (dispatch: Dispatch) => {
    dispatch(setSlices(slices));
  };
}

export function fetchSlices(
  userId?: number,
  filter_value?: string,
  sortColumn = 'changed_on',
) {
  return (dispatch: Dispatch) => {
    dispatch(fetchAllSlicesStarted());

    const filters: {
      col: string;
      opr: string;
      value: string | number;
    }[] = filter_value
      ? [{ col: 'slice_name', opr: 'chart_all_text', value: filter_value }]
      : [];

    if (userId) {
      filters.push({ col: 'owners', opr: 'rel_m_m', value: userId });
    }

    return SupersetClient.get({
      endpoint: `/api/v1/chart/?q=${rison.encode({
        columns: [
          'changed_on_delta_humanized',
          'changed_on_utc',
          'datasource_id',
          'datasource_type',
          'datasource_url',
          'datasource_name_text',
          'description_markeddown',
          'description',
          'id',
          'params',
          'slice_name',
          'thumbnail_url',
          'url',
          'viz_type',
          'owners.id',
          'created_by.id',
        ],
        filters,
        page_size: FETCH_SLICES_PAGE_SIZE,
        order_column:
          sortColumn === 'changed_on'
            ? 'changed_on_delta_humanized'
            : sortColumn,
        order_direction: sortColumn === 'changed_on' ? 'desc' : 'asc',
      })}`,
    })
      .then(({ json }) => {
        const { result } = json;
        const slices = parseResult(result);
        return dispatch(addSlices(slices));
      })
      .catch(errorResponse =>
        getClientErrorObject(errorResponse).then(({ error }) => {
          dispatch(
            fetchAllSlicesFailed(
              error || t('Could not fetch all saved charts'),
            ),
          );
          dispatch(
            addDangerToast(
              t('Sorry there was an error fetching saved charts: ') + error,
            ),
          );
        }),
      );
  };
}
