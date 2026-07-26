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
  QueryFormData,
  QueryFormOrderBy,
} from '@superset-ui/core';
import { buildColumnsOrderBy, applyOrderBy } from '../utils/orderby';

export default function buildQuery(formData: QueryFormData) {
  const { metric, sort_by_metric, groupby = [], row_limit } = formData;
  const orderby: QueryFormOrderBy[] = [];
  if (sort_by_metric && metric) {
    orderby.push([metric, false]);
  }
  orderby.push(...buildColumnsOrderBy(groupby));

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      ...applyOrderBy(orderby, row_limit),
    },
  ]);
}
