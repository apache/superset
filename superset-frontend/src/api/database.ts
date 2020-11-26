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

import { SupersetClient, JsonResponse } from '@superset-ui/core';
import rison from 'rison';
import Dataset from 'src/types/Dataset';

const returnResult = async (endpoint: string) => {
  const json = await SupersetClient.get({
    endpoint,
  });
  return json.json;
};

export const importDataset = async (datasetFile: File) => {
  const endpoint = encodeURI(`/api/v1/database/import/`);
  const formData = new FormData();
  formData.append('formData', datasetFile);
  const response: JsonResponse = await SupersetClient.post({
    endpoint,
    body: formData,
  });
  return Promise.resolve(response);
};

export const get = async () => {
  const queryParams = rison.encode({
    order_column: 'changed_on_delta_humanized',
    order_direction: 'desc',
    page: 0,
    page_size: 10,
  });
  const endpoint = `/api/v1/database?q=${queryParams}`;
  const result = await returnResult(endpoint);
  return Promise.resolve(result);
};

export const show = async (id: number) => {
  const endpoint = `/api/v1/database${id}`;
  const result = await returnResult(endpoint);
  return Promise.resolve(result);
};

export const getRelated = async (id: number) => {
  const endpoint = `/api/v1/database/${id}/related_objects`;
  const result = await returnResult(endpoint);
  return Promise.resolve(result);
};

export const destroy = async (id: number) => {
  return SupersetClient.delete({
    endpoint: `/api/v1/database/${id}`,
  });
};

export const bulkDestroy = async (datasets: Dataset[]) => {
  const {
    json: {
      json: { message },
    },
  } = await SupersetClient.delete({
    endpoint: `/api/v1/database/?q=${rison.encode(
      datasets.map(({ id }) => id),
    )}`,
  });
  return Promise.resolve(message);
};
