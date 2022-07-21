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

/* eslint-disable camelcase */
import {
  AppliedTimeExtras,
  isDruidFormData,
  QueryFormData,
  QueryObjectExtras,
  QueryObjectFilterClause,
  TimeColumnConfigKey,
} from './types';

type ExtraFilterQueryField = {
  time_range?: string;
  granularity_sqla?: string;
  time_grain_sqla?: string;
  druid_time_origin?: string;
  granularity?: string;
};

type ExtractedExtra = ExtraFilterQueryField & {
  filters: QueryObjectFilterClause[];
  extras: QueryObjectExtras;
  applied_time_extras: AppliedTimeExtras;
};

export default function extractExtras(formData: QueryFormData): ExtractedExtra {
  const applied_time_extras: AppliedTimeExtras = {};
  const filters: QueryObjectFilterClause[] = [];
  const extras: QueryObjectExtras = {};
  const extract: ExtractedExtra = {
    filters,
    extras,
    applied_time_extras,
  };

  const reservedColumnsToQueryField: Record<
    TimeColumnConfigKey,
    keyof ExtraFilterQueryField
  > = {
    __time_range: 'time_range',
    __time_col: 'granularity_sqla',
    __time_grain: 'time_grain_sqla',
    __time_origin: 'druid_time_origin',
    __granularity: 'granularity',
  };

  (formData.extra_filters || []).forEach(filter => {
    if (filter.col in reservedColumnsToQueryField) {
      const key = filter.col as TimeColumnConfigKey;
      const queryField = reservedColumnsToQueryField[key];
      extract[queryField] = filter.val as string;
      applied_time_extras[key] = filter.val as string;
    } else {
      filters.push(filter);
    }
  });

  // map to undeprecated names and remove deprecated fields
  if (isDruidFormData(formData) && !extract.druid_time_origin) {
    extras.druid_time_origin = formData.druid_time_origin;
    delete extract.druid_time_origin;
  } else {
    // SQL
    extras.time_grain_sqla =
      extract.time_grain_sqla || formData.time_grain_sqla;
    extract.granularity =
      extract.granularity_sqla ||
      formData.granularity ||
      formData.granularity_sqla;
    delete extract.granularity_sqla;
    delete extract.time_grain_sqla;
  }

  return extract;
}
