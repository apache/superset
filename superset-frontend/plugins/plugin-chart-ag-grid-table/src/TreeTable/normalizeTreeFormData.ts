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
import { TreeTableFormData } from './types';

const TABLE_ONLY_KEYS = [
  'server_pagination',
  'server_page_length',
  'groupby',
  'metrics',
  'all_columns',
  'percent_metrics',
  'order_by_cols',
  'timeseries_limit_metric',
  'series_limit_metric',
  'order_desc',
  'time_grain_sqla',
  'time_compare',
  'comparison_type',
] as const;

export default function normalizeTreeFormData(
  formData: TreeTableFormData,
): TreeTableFormData {
  const normalized = { ...formData };
  TABLE_ONLY_KEYS.forEach(key => {
    delete normalized[key];
  });
  return normalized;
}
