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
import { SupersetClient } from '@superset-ui/connection';
import getClientErrorObject from 'src/utils/getClientErrorObject';

export const UPLOAD_CSV_SUCCESS = 'UPLOAD_CSV_SUCCESS';
export const UPLOAD_CSV_FAILURE = 'UPLOAD_CSV_FAILURE';

export function uploadCsv(data) {
  return dispatch =>
    SupersetClient.post({
      endpoint: '/csvimporter/csvtodatabase/add',
      postPayload: { ...data },
      stringify: false,
    })
      .then(() => {
        dispatch({ type: UPLOAD_CSV_SUCCESS, message: '' });
        window.open('/tablemodelview/list/', '_self');
      })
      .catch((response) => {
        getClientErrorObject(response).then((error) => {
          dispatch({ type: UPLOAD_CSV_FAILURE, message: error.error });
        });
      });
}
