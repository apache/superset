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
/* eslint camelcase: 0 */
import { t, SupersetClient } from '@superset-ui/core';
import rison from 'rison';

import { addDangerToast } from 'src/messageToasts/actions';
import { getDatasourceParameter } from 'src/modules/utils';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';

export const SET_ALL_SLICES = 'SET_ALL_SLICES';
export function setAllSlices(slices) {
  return { type: SET_ALL_SLICES, payload: { slices } };
}

export const FETCH_ALL_SLICES_STARTED = 'FETCH_ALL_SLICES_STARTED';
export function fetchAllSlicesStarted() {
  return { type: FETCH_ALL_SLICES_STARTED };
}

export const FETCH_ALL_SLICES_FAILED = 'FETCH_ALL_SLICES_FAILED';
export function fetchAllSlicesFailed(error) {
  return { type: FETCH_ALL_SLICES_FAILED, payload: { error } };
}

const FETCH_SLICES_PAGE_SIZE = 200;
export function fetchAllSlices(userId) {
  return (dispatch, getState) => {
    const { sliceEntities } = getState();
    if (sliceEntities.lastUpdated === 0) {
      dispatch(fetchAllSlicesStarted());

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
            'url',
            'viz_type',
          ],
          filters: [{ col: 'owners', opr: 'rel_m_m', value: userId }],
          page_size: FETCH_SLICES_PAGE_SIZE,
          order_column: 'changed_on_delta_humanized',
          order_direction: 'desc',
        })}`,
      })
        .then(({ json }) => {
          const slices = {};
          json.result.forEach(slice => {
            let form_data = JSON.parse(slice.params);
            form_data = {
              ...form_data,
              // force using datasource stored in relational table prop
              datasource:
                getDatasourceParameter(
                  slice.datasource_id,
                  slice.datasource_type,
                ) || form_data.datasource,
            };
            slices[slice.id] = {
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
            };
          });

          return dispatch(setAllSlices(slices));
        })
        .catch(
          errorResponse =>
            console.log(errorResponse) ||
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
    }

    return dispatch(setAllSlices(sliceEntities.slices));
  };
}
