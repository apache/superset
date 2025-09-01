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
  getComparisonInfo,
} from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  const buildQuery = (baseQueryObject: any) => {
    const queries = [baseQueryObject];

    // Handle both old and new time comparison formats
    const timeComparison = 
      (formData.extra_form_data?.custom_form_data as any)?.time_compare ||
      (formData.extra_form_data as any)?.time_compare;
      
    if (timeComparison && timeComparison !== 'NoComparison') {
      const comparisonFormData = getComparisonInfo(
        formData,
        timeComparison,
        formData.extra_form_data,
      );
      queries.push({
        ...baseQueryObject,
        ...comparisonFormData,
      });
    }
    return queries;
  };

  return buildQueryContext(formData, buildQuery);
}
