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

import rison from 'rison';
import { useApiUpdate, useApiFetchWithStore } from './apiResources';

interface PutProps {
  datasetId: number;
  overrideColumns: boolean;
}

interface DatasetPutJson {
  dbId: number;
  sql: string;
  columns: Array<Record<string, any>>;
}

export const getByUserEndpoint = async (userId: number) => {
  const queryParams = rison.encode({
    filters: [
      {
        col: 'owners',
        opr: 'rel_m_m',
        value: userId,
      },
    ],
    order_column: 'changed_on_delta_humanized',
    order_direction: 'desc',
  });
  return `/api/v1/dataset?q=${queryParams}`;
};

export const putEndpoint = ({ datasetId, overrideColumns }: PutProps) =>
  `api/v1/dataset/${datasetId}?override_columns=${overrideColumns}`;

export function useDatasetPut(props: PutProps) {
  return useApiUpdate<DatasetPutJson>(putEndpoint(props));
}

export function useDatasetGetByUser(userId: number) {
  return useApiFetchWithStore(getByUserEndpoint(userId));
}
