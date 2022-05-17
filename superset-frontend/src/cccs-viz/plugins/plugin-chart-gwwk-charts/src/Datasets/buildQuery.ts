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
import { buildQueryContext, QueryFormData } from '@superset-ui/core';
import { getSearchKeywords } from '../utils';

/**
 * The buildQuery function is used to create an instance of QueryContext that's
 * sent to the chart data endpoint. In addition to containing information of which
 * datasource to use, it specifies the type (e.g. full payload, samples, query) and
 * format (e.g. CSV or JSON) of the result and whether or not to force refresh the data from
 * the datasource as opposed to using a cached copy of the data, if available.
 *
 * More importantly though, QueryContext contains a property `queries`, which is an array of
 * QueryObjects specifying individual data requests to be made. A QueryObject specifies which
 * columns, metrics and filters, among others, to use during the query. Usually it will be enough
 * to specify just one query based on the baseQueryObject, but for some more advanced use cases
 * it is possible to define post processing operations in the QueryObject, or multiple queries
 * if a viz needs multiple different result sets.
 */

export default function buildQuery(formData: QueryFormData) {
  /*
  We receive a filter ip_string IN ('1.1.1.1')
  our job is to determine the type of this filter and to use
  this type to find datasets which have columns of that type.
  We do this by filtering the cccs_explore_launcher table
  by it's found_column_type.

   */

  return buildQueryContext(formData, baseQueryObject => {
    if (!baseQueryObject.filters) baseQueryObject.filters = [];
    const filter = baseQueryObject.filters.pop();
    while (baseQueryObject.filters.length > 0) {
      baseQueryObject.filters.pop();
    }
    if (filter) {
      baseQueryObject.filters?.push({
        col: 'keywords',
        op: 'IN',
        val: getSearchKeywords(filter.col.toString()),
      });
    }
    baseQueryObject.columns = [
      'id',
      'name',
      'filter_name',
      'filter_type',
      'dataset_column_names',
    ];

    // Run a RAW query (not AGGREGATED)
    // clear metrics attribute to perform a RAW mode query.
    baseQueryObject.metrics = undefined;

    return [
      {
        ...baseQueryObject,
      },
    ];
  });
}
