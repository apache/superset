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
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import { addDangerToast } from '../../messageToasts/actions';
import { getDatasourceParameter } from '../../modules/utils';
import getClientErrorObject from '../../utils/getClientErrorObject';

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

export function fetchAllSlices(userId) {
  return (dispatch, getState) => {
    const { sliceEntities } = getState();
    if (sliceEntities.lastUpdated === 0) {
      dispatch(fetchAllSlicesStarted());

      return SupersetClient.get({
        endpoint: `/sliceaddview/api/read?_flt_0_created_by=${userId}`,
      })
        .then(({ json }) => {
          const slices = {};
          json.result.forEach(slice => {
            let form_data = JSON.parse(slice.params);
            let datasource = form_data.datasource;
            if (!datasource) {
              datasource = getDatasourceParameter(
                slice.datasource_id,
                slice.datasource_type,
              );
              form_data = {
                ...form_data,
                datasource,
              };
            }
            if (['markup', 'separator'].indexOf(slice.viz_type) === -1) {
              slices[slice.id] = {
                slice_id: slice.id,
                slice_url: slice.slice_url,
                slice_name: slice.slice_name,
                edit_url: slice.edit_url,
                form_data,
                datasource_name: slice.datasource_name_text,
                datasource_link: slice.datasource_link,
                changed_on: new Date(slice.changed_on).getTime(),
                description: slice.description,
                description_markdown: slice.description_markeddown,
                viz_type: slice.viz_type,
                modified: slice.modified,
                changed_on_humanized: slice.changed_on_humanized,
              };
            }
          });

          return dispatch(setAllSlices(slices));
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
    }

    return dispatch(setAllSlices(sliceEntities.slices));
  };
}
