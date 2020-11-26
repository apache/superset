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
import Chart from 'src/types/Chart';

export const importChart = async (chartFile: File) => {
  const endpoint = encodeURI(`/api/v1/chart/import/`);
  const formData = new FormData();
  formData.append('formData', chartFile);
  await SupersetClient.post({
    endpoint,
    body: formData,
  });
  return Promise.resolve();
};

export const destroyBulk = async (charts: Chart[]) => {
  const endpoint = `/api/v1/chart/?q=${rison.encode(
    charts.map(({ id }: { id: number }) => id),
  )}`;
  const {
    json: {
      json: { message },
    },
  } = await SupersetClient.delete({ endpoint });
  return Promise.resolve(message);
};
