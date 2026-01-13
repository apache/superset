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
import { formatSelectOptions } from '@superset-ui/chart-controls';

export const SERVER_PAGE_SIZE_OPTIONS = formatSelectOptions<number>([
  10, 20, 50, 100, 200,
]);

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

export const CUSTOM_AGG_FUNCS = {
  queryTotal: 'Metric total',
};

export const FILTER_POPOVER_OPEN_DELAY = 200;
export const FILTER_INPUT_SELECTOR = 'input[data-ref="eInput"]';
export const NOOP_FILTER_COMPARATOR = () => 0;

export const FILTER_INPUT_POSITIONS = {
  FIRST: 'first' as const,
  SECOND: 'second' as const,
  UNKNOWN: 'unknown' as const,
} as const;

export const FILTER_CONDITION_BODY_INDEX = {
  FIRST: 0,
  SECOND: 1,
} as const;
