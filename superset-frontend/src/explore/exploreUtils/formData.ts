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
import { SupersetClient, JsonObject } from '@superset-ui/core';

type Payload = {
  dataset_id: number;
  form_data: string;
  chart_id?: number;
};

const assemblePayload = (
  datasetId: number,
  form_data: JsonObject,
  chartId?: number,
) => {
  const payload: Payload = {
    dataset_id: datasetId,
    form_data: JSON.stringify(form_data),
  };
  if (chartId) {
    payload.chart_id = chartId;
  }
  return payload;
};

export const postFormData = (
  datasetId: number,
  form_data: JsonObject,
  chartId?: number,
): Promise<string> =>
  SupersetClient.post({
    endpoint: 'api/v1/explore/form_data',
    jsonPayload: assemblePayload(datasetId, form_data, chartId),
  }).then(r => r.json.key);

export const putFormData = (
  datasetId: number,
  key: string,
  form_data: JsonObject,
  chartId?: number,
): Promise<string> =>
  SupersetClient.put({
    endpoint: `api/v1/explore/form_data/${key}`,
    jsonPayload: assemblePayload(datasetId, form_data, chartId),
  }).then(r => r.json.message);
