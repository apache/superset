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
  ExtraFormDataAppend,
  ExtraFormDataOverrideExtras,
  ExtraFormDataOverrideRegular,
  ExtraFormDataOverride,
  QueryObject,
} from './types';

export const DTTM_ALIAS = '__timestamp';
export const NO_TIME_RANGE = 'No filter';

export const EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS: (keyof ExtraFormDataOverrideExtras)[] =
  ['relative_start', 'relative_end', 'time_grain_sqla'];

export const EXTRA_FORM_DATA_APPEND_KEYS: (keyof ExtraFormDataAppend)[] = [
  'adhoc_filters',
  'filters',
  'interactive_groupby',
  'interactive_highlight',
  'interactive_drilldown',
  'custom_form_data',
];

export const EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS: Record<
  keyof ExtraFormDataOverrideRegular,
  keyof QueryObject
> = {
  granularity: 'granularity',
  granularity_sqla: 'granularity',
  time_column: 'time_column',
  time_grain: 'time_grain',
  time_range: 'time_range',
};

export const EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS = Object.keys(
  EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS,
) as (keyof ExtraFormDataOverrideRegular)[];

export const EXTRA_FORM_DATA_OVERRIDE_KEYS: (keyof ExtraFormDataOverride)[] = [
  ...EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS,
  ...EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS,
];
