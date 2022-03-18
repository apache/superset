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
import { DashboardPermalinkValue } from 'src/dashboard/types';

const assembleEndpoint = (
  dashId: string | number,
  key?: string,
  tabId?: string,
) => {
  let endpoint = `api/v1/dashboard/${dashId}/filter_state`;
  if (key) {
    endpoint = endpoint.concat(`/${key}`);
  }
  if (tabId) {
    endpoint = endpoint.concat(`?tab_id=${tabId}`);
  }
  return endpoint;
};

export const updateFilterKey = (
  dashId: string,
  value: string,
  key: string,
  tabId?: string,
) =>
  SupersetClient.put({
    endpoint: assembleEndpoint(dashId, key, tabId),
    jsonPayload: { value },
  })
    .then(r => r.json.message)
    .catch(err => {
      logging.error(err);
      return null;
    });

export const createFilterKey = (
  dashId: string | number,
  value: string,
  tabId?: string,
) =>
  SupersetClient.post({
    endpoint: assembleEndpoint(dashId, undefined, tabId),
    jsonPayload: { value },
  })
    .then(r => r.json.key as string)
    .catch(err => {
      logging.error(err);
      return null;
    });

export const getFilterValue = (dashId: string | number, key: string) =>
  SupersetClient.get({
    endpoint: assembleEndpoint(dashId, key),
  })
    .then(({ json }) => JSON.parse(json.value))
    .catch(err => {
      logging.error(err);
      return null;
    });

export const getPermalinkValue = (key: string) =>
  SupersetClient.get({
    endpoint: `/api/v1/dashboard/permalink/${key}`,
  })
    .then(({ json }) => json as DashboardPermalinkValue)
    .catch(err => {
      logging.error(err);
      return null;
    });
