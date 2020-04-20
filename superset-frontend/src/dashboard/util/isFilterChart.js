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
/* eslint-disable camelcase */

/**
 * Check if a chart is one of the filter chart types, i.e., FilterBox
 * and any charts with `table_filter = TRUE`.
 *
 * TODO: change `table_filter` to a more generic name.
 */
export default function isFilterChart(slice) {
  const { form_data = {} } = slice;
  const vizType = slice.viz_type || form_data.viz_type;
  return vizType === 'filter_box' || !!form_data.table_filter;
}
