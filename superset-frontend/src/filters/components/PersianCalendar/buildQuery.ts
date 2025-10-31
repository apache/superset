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
  BuildQuery,
} from '@superset-ui/core';

interface PersianCalendarQueryFormData {
  time_range?: string;
  datasource: string;
  viz_type: string;
  [key: string]: any;
}

const buildQuery: BuildQuery<PersianCalendarQueryFormData> = (
  formData: PersianCalendarQueryFormData,
  options,
) => {
  // For native filters, we don't need to build a specific query
  // The filter works by setting data mask which affects other charts
  return buildQueryContext(formData, baseQueryObject => {
    return [
      {
        ...baseQueryObject,
        // Native filters don't generate their own queries
        // They work by filtering data for other charts
        datasource: formData.datasource || baseQueryObject.datasource,
        queries: [],
      },
    ];
  });
};

export default buildQuery;