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
import { DataMaskStateWithId, DataMaskWithId } from 'src/dataMask/types';
import { createErrorHandler } from 'src/views/CRUD/utils';
import queryString from 'query-string';
import rison from 'rison';

export const updateFilter = (dashId: string, value: string, key: string) =>
  SupersetClient.put({
    endpoint: `api/v1/dashboard/${dashId}/filter_state/${key}`,
    body: value,
  })
    .then(r => {
      console.log('RESPONSE --->', r);
    })
    .catch(err => err);

export const createFilterKey = (dashId: string, value: DataMaskStateWithId) =>
  SupersetClient.post({
    endpoint: `api/v1/dashboard/${dashId}/filter_state`,
    jsonPayload: { value },
  })
    .then(r => {
      console.log('createfilterkey', r.json.key);
      return r.json.key;
    })
    .catch(err => console.log('err', err));

export const getFilterValue = (dashId: string, key: string) =>
  SupersetClient.get({
    endpoint: `api/v1/dashboard/${dashId}/filter_state/${key}/`,
  })
    .then(({json}) => JSON.parse(json.value))
    .catch(err => err);
