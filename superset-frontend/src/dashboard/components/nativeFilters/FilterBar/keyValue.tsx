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
import { SupersetClient, logging } from '@superset-ui/core';

export const updateFilterKey = (dashId: string, value: string, key: string) =>
  SupersetClient.put({
    endpoint: `api/v1/dashboard/${dashId}/filter_state/${key}/`,
    jsonPayload: { value },
  })
    .then(r => r.json.message)
    .catch(err => {
      logging.error(err);
      return null;
    });

export const createFilterKey = (dashId: string | number, value: string) =>
  SupersetClient.post({
    endpoint: `api/v1/dashboard/${dashId}/filter_state`,
    jsonPayload: { value },
  })
    .then(r => r.json.key)
    .catch(err => {
      logging.error(err);
      return null;
    });

export const getFilterValue = (
  dashId: string | number | undefined,
  key: string,
) =>
  SupersetClient.get({
    endpoint: `api/v1/dashboard/${dashId}/filter_state/${key}/`,
  })
    .then(({ json }) => JSON.parse(json.value))
    .catch(err => {
      logging.error(err);
      return null;
    });
