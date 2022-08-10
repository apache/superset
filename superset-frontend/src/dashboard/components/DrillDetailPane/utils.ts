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
import { omit } from 'lodash';
import {
  ensureIsArray,
  QueryFormData,
  BinaryQueryObjectFilterClause,
  buildQueryObject,
} from '@superset-ui/core';

export function getDrillPayload(
  queryFormData?: QueryFormData,
  drillFilters?: BinaryQueryObjectFilterClause[],
) {
  if (!queryFormData) {
    return undefined;
  }
  const queryObject = buildQueryObject(queryFormData);
  const extras = omit(queryObject.extras, 'having');
  const filters = [
    ...ensureIsArray(queryObject.filters),
    ...ensureIsArray(drillFilters).map(f => omit(f, 'formattedVal')),
  ];
  return {
    granularity: queryObject.granularity,
    time_range: queryObject.time_range,
    filters,
    extras,
  };
}
