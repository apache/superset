/* eslint-disable no-underscore-dangle */
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
import { Column, Metric, ensureIsArray } from '@superset-ui/core';
import { Dataset } from 'src/components/Chart/types';

export const useVerboseMap = (dataset?: Dataset) => {
  const verbose_map: Record<string, string> = {};
  ensureIsArray(dataset?.columns).forEach((column: Column) => {
    verbose_map[column.column_name] = column.verbose_name || column.column_name;
  });
  ensureIsArray(dataset?.metrics).forEach((metric: Metric) => {
    verbose_map[metric.metric_name] = metric.verbose_name || metric.metric_name;
  });
  return verbose_map;
};
