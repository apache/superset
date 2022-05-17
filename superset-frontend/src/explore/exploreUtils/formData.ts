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
  dataset_id: number;
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
  datasetId: number,
  formData: JsonObject,
  chartId?: number,
) => {
  const payload: Payload = {
    dataset_id: datasetId,
    form_data: JSON.stringify(sanitizeFormData(formData)),
  };
  if (chartId) {
    payload.chart_id = chartId;
  }
  return payload;
};

export const postFormData = (
  datasetId: number,
  formData: JsonObject,
  chartId?: number,
  tabId?: string,
): Promise<string> =>
  SupersetClient.post({
    endpoint: assembleEndpoint(undefined, tabId),
    jsonPayload: assemblePayload(datasetId, formData, chartId),
  }).then(r => r.json.key);

export const putFormData = (
  datasetId: number,
  key: string,
  formData: JsonObject,
  chartId?: number,
  tabId?: string,
): Promise<string> =>
  SupersetClient.put({
    endpoint: assembleEndpoint(key, tabId),
    jsonPayload: assemblePayload(datasetId, formData, chartId),
  }).then(r => r.json.message);
