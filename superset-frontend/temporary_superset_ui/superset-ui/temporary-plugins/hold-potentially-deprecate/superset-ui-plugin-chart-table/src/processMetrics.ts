/*
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

import { QueryFormMetric, AdhocMetric } from '@superset-ui/core';
import { createSelector } from 'reselect';
import { PlainObject } from './types';

type inputType = {
  metrics: QueryFormMetric[];
  percentMetrics: QueryFormMetric[];
  records: PlainObject[];
};

function processMetrics(
  metrics: QueryFormMetric[],
  percentMetrics: QueryFormMetric[],
  records: PlainObject[],
) {
  const processedMetrics = (metrics || []).map(
    m => (m as AdhocMetric).label ?? (m as string),
  );

  const processedPercentMetrics = (percentMetrics || [])
    .map(m => (m as AdhocMetric).label ?? (m as string))
    .map(m => `%${m}`);

  return processedMetrics
    .concat(processedPercentMetrics)
    .filter(m => typeof records[0][m] === 'number');
}

const getCreateSelectorFunction = () =>
  createSelector(
    (data: inputType) => data.metrics,
    data => data.percentMetrics,
    data => data.records,
    (metrics, percentMetrics, records) =>
      processMetrics(metrics, percentMetrics, records),
  );

export default getCreateSelectorFunction;
