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
import { isEqual, omit } from 'lodash';
import { SupersetClient, JsonObject, JsonValue } from '@superset-ui/core';

type Payload = {
  datasource_id: number;
  datasource_type: string;
  form_data: string;
  chart_id?: number;
};

const TEMPORARY_CONTROLS = ['url_params'];

export const sanitizeFormData = (formData: JsonObject): JsonObject =>
  omit(formData, TEMPORARY_CONTROLS);

export const getNullIfEmpty = (value: JsonValue | undefined) => {
  // Considering `[]`, `{}`, `null` and `undefined` as identical
  // for this purpose
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value) && value.length === 0) {
      return null;
    }
    const keys = Object.keys(value);
    if (keys && keys.length === 0) {
      return null;
    }
  }
  return value;
};

export const isEqualish = (
  val1: JsonValue | undefined,
  val2: JsonValue | undefined,
) => isEqual(getNullIfEmpty(val1), getNullIfEmpty(val2));

export const getFormDataDiffs = (
  formData1: JsonObject,
  formData2: JsonObject,
) => {
  const ofd = sanitizeFormData(formData1);
  const cfd = sanitizeFormData(formData2);

  const fdKeys = Object.keys(cfd);
  const diffs = {};
  fdKeys.forEach(fdKey => {
    if (!ofd[fdKey] && !cfd[fdKey]) {
      return;
    }
    if (['filters', 'having', 'having_filters', 'where'].includes(fdKey)) {
      return;
    }
    if (!isEqual(getNullIfEmpty(ofd[fdKey]), getNullIfEmpty(cfd[fdKey]))) {
      diffs[fdKey] = { before: ofd[fdKey], after: cfd[fdKey] };
    }
  });
  return diffs;
};

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
