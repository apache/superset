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
import {
  buildQueryContext,
  ensureIsArray,
  getXAxisColumn,
  QueryFormData,
  QueryFormOrderBy,
} from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  const columns = [
    ...ensureIsArray(getXAxisColumn(formData)),
    ...ensureIsArray(formData.series),
  ];
  const metrics = [
    ...ensureIsArray(formData.open),
    ...ensureIsArray(formData.close),
    ...ensureIsArray(formData.high),
    ...ensureIsArray(formData.low),
  ];
  const orderby: QueryFormOrderBy[] | undefined = columns.length
    ? [[columns[0], true]]
    : undefined;

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns,
      metrics,
      series_columns: ensureIsArray(formData.series),
      orderby,
    },
  ]);
}
