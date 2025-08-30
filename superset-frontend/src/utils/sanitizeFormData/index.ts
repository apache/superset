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
import { JsonObject } from '@superset-ui/core';
import { omit } from 'lodash';

const TEMPORARY_CONTROLS: string[] = ['url_params'];

/**
 * Check if a filter was derived from Rison URL parameters
 */
function isRisonFilter(filter: any): boolean {
  // eslint-disable-next-line no-underscore-dangle
  return filter && filter.__superset_rison_filter__ === true;
}

/**
 * Filter out Rison-derived filters from an array
 */
function excludeRisonFilters(filters: any[]): any[] {
  return filters.filter(filter => !isRisonFilter(filter));
}

export const sanitizeFormData = (formData: JsonObject): JsonObject => {
  const sanitized = omit(formData, TEMPORARY_CONTROLS);

  // Remove Rison filters from adhoc_filters to prevent them from being stored server-side
  if (
    (sanitized as any).adhoc_filters &&
    Array.isArray((sanitized as any).adhoc_filters)
  ) {
    (sanitized as any).adhoc_filters = excludeRisonFilters(
      (sanitized as any).adhoc_filters,
    );
  }

  return sanitized;
};
