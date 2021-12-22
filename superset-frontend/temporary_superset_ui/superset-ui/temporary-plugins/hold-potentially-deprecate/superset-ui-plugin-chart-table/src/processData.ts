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
  timeseriesLimitMetric: QueryFormMetric;
  orderDesc: boolean;
  records: PlainObject[];
  metrics: string[];
};

function processData(
  timeseriesLimitMetric: QueryFormMetric,
  orderDesc: boolean,
  records: PlainObject[],
  metrics: string[],
) {
  const sortByKey =
    timeseriesLimitMetric &&
    ((timeseriesLimitMetric as AdhocMetric).label ||
      (timeseriesLimitMetric as string));

  let processedRecords = records;

  if (sortByKey) {
    processedRecords = records
      .slice()
      .sort(
        orderDesc
          ? (a, b) => b[sortByKey] - a[sortByKey]
          : (a, b) => a[sortByKey] - b[sortByKey],
      );
  }

  return processedRecords.map(
    sortByKey && !metrics.includes(sortByKey)
      ? row => {
          const data = { ...row };
          delete data[sortByKey];

          return { data };
        }
      : row => ({ data: row }),
  );
}

const getCreateSelectorFunction = () =>
  createSelector(
    (data: inputType) => data.timeseriesLimitMetric,
    data => data.orderDesc,
    data => data.records,
    data => data.metrics,
    (timeseriesLimitMetric, orderDesc, records, metrics) =>
      processData(timeseriesLimitMetric, orderDesc, records, metrics),
  );

export default getCreateSelectorFunction;
