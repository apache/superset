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
import { omit } from 'lodash';
import { SupersetClient, JsonObject } from '@superset-ui/core';

type Payload = {
  datasource_id: number;
  datasource_type: string;
  form_data: string;
  chart_id?: number;
};

const TEMPORARY_CONTROLS = ['url_params'];

export const sanitizeFormData = (formData: JsonObject): JsonObject =>
  omit(formData, TEMPORARY_CONTROLS);

const assembleEndpoint = (key?: string, tabId?: string) => {
  let endpoint = 'api/v1/explore/form_data';
  if (key) {
    endpoint = endpoint.concat(`/${key}`);
  }
  if (tabId) {
    endpoint = endpoint.concat(`?tab_id=${tabId}`);
  }
  return endpoint;
};

const assemblePayload = (
  datasourceId: number,
  datasourceType: string,
  formData: JsonObject,
  chartId?: number,
) => {
  const payload: Payload = {
    datasource_id: datasourceId,
    datasource_type: datasourceType,
    form_data: JSON.stringify(sanitizeFormData(formData)),
  };
  if (chartId) {
    payload.chart_id = chartId;
  }
  return payload;
};

export const postFormData = (
  datasourceId: number,
  datasourceType: string,
  formData: JsonObject,
  chartId?: number,
  tabId?: string,
): Promise<string> =>
  SupersetClient.post({
    endpoint: assembleEndpoint(undefined, tabId),
    jsonPayload: assemblePayload(
      datasourceId,
      datasourceType,
      formData,
      chartId,
    ),
  }).then(r => r.json.key);

export const putFormData = (
  datasourceId: number,
  datasourceType: string,
  key: string,
  formData: JsonObject,
  chartId?: number,
  tabId?: string,
): Promise<string> =>
  SupersetClient.put({
    endpoint: assembleEndpoint(key, tabId),
    jsonPayload: assemblePayload(
      datasourceId,
      datasourceType,
      formData,
      chartId,
    ),
  }).then(r => r.json.message);
