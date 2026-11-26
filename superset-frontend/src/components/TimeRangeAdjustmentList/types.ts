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
import type { JsonValue } from '@superset-ui/core';

/** A change a dashboard copy or import needs to fit the time range limits. */
export interface TimeRangeAdjustment {
  kind: 'time_range_limit' | 'filter_default';
  dashboard: string;
  dashboard_key?: string;
  file?: string | null;
  name: string;
  filter_id?: string | null;
  field: string;
  old: JsonValue;
  new: JsonValue;
  old_label: string;
  new_label: string;
}

export const TIME_RANGE_ADJUSTMENTS_KEY = 'time_range_adjustments';
export const TIME_RANGE_ADJUSTMENTS_FINGERPRINT_KEY =
  'time_range_adjustments_fingerprint';
