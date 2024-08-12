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
import Chart from 'src/types/Chart';
import { useApiV1Resource, useTransformedResource } from './apiResources';

function extractOwnerNames({ owners }: Chart) {
  if (!owners) return null;
  return owners.map(owner => `${owner.first_name} ${owner.last_name}`);
}

const ownerNamesQuery = rison.encode({
  columns: ['owners.first_name', 'owners.last_name'],
  keys: ['none'],
});

export function useChartOwnerNames(chartId: string) {
  return useTransformedResource(
    useApiV1Resource<Chart>(`/api/v1/chart/${chartId}?q=${ownerNamesQuery}`),
    extractOwnerNames,
  );
}
