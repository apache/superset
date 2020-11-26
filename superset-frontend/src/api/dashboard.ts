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
import rison from 'rison';
import Dashboard from 'src/types/Dashboard';

export const importDashboard = async (dashboardFile: File) => {
  const endpoint = encodeURI(`/api/v1/dashboard/import/`);
  const formData = new FormData();
  formData.append('formData', dashboardFile);
  await SupersetClient.post({
    endpoint,
    body: formData,
  });
  return Promise.resolve();
};

export const get = async () => {
  const queryParams = rison.encode({
    order_column: 'changed_on_delta_humanized',
    order_direction: 'desc',
    page: 0,
    page_size: 10,
  });
  const endpoint = `/api/v1/dashboard?q=${queryParams}`;
  const {
    json: {
      json: { result },
    },
  } = await SupersetClient.get({
    endpoint,
  });
  return Promise.resolve(result);
};

export const show = async (id: number) => {
  const endpoint = `/api/v1/dashboard/${id}`;
  const json = await SupersetClient.get({ endpoint });
  return Promise.resolve(json.json);
};

export const destroyBulk = async (dashboards: Dashboard[]) => {
  const endpoint = `/api/v1/dashboard/?q=${rison.encode(
    dashboards.map(({ id }: { id: number }) => id),
  )}`;
  const {
    json: {
      json: { message },
    },
  } = await SupersetClient.delete({ endpoint });
  return Promise.resolve(message);
};
