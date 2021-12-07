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
import isEmpty from 'lodash/isEmpty';
import isBoolean from 'lodash/isBoolean';

import { QueryObject } from './types';

export default function normalizeOrderBy(
  queryObject: QueryObject,
): QueryObject {
  if (Array.isArray(queryObject.orderby) && queryObject.orderby.length > 0) {
    // ensure a valid orderby clause
    const orderbyClause = queryObject.orderby[0];
    if (
      Array.isArray(orderbyClause) &&
      orderbyClause.length === 2 &&
      !isEmpty(orderbyClause[0]) &&
      isBoolean(orderbyClause[1])
    ) {
      return queryObject;
    }
  }

  // ensure that remove invalid orderby clause
  const cloneQueryObject = { ...queryObject };
  delete cloneQueryObject.timeseries_limit_metric;
  delete cloneQueryObject.legacy_order_by;
  delete cloneQueryObject.order_desc;
  delete cloneQueryObject.orderby;

  const isAsc = !queryObject.order_desc;
  if (
    queryObject.timeseries_limit_metric !== undefined &&
    queryObject.timeseries_limit_metric !== null &&
    !isEmpty(queryObject.timeseries_limit_metric)
  ) {
    return {
      ...cloneQueryObject,
      orderby: [[queryObject.timeseries_limit_metric, isAsc]],
    };
  }

  // todo: Removed `legacy_ordery_by` after refactoring
  if (
    queryObject.legacy_order_by !== undefined &&
    queryObject.legacy_order_by !== null &&
    !isEmpty(queryObject.legacy_order_by)
  ) {
    return {
      ...cloneQueryObject,
      // @ts-ignore
      orderby: [[queryObject.legacy_order_by, isAsc]],
    };
  }

  if (Array.isArray(queryObject.metrics) && queryObject.metrics.length > 0) {
    return {
      ...cloneQueryObject,
      orderby: [[queryObject.metrics[0], isAsc]],
    };
  }

  return cloneQueryObject;
}
