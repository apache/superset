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
  AdhocFilter,
  DataMask,
  NativeFilterType,
  NativeFilterScope,
} from '@superset-ui/core';

export interface NativeFiltersFormItem {
  scope: NativeFilterScope;
  name: string;
  filterType: string;
  dataset: {
    value: number;
    label: string;
  };
  column: string;
  controlValues: {
    [key: string]: any;
  };
  requiredFirst: {
    [key: string]: boolean;
  };
  defaultValue: any;
  defaultDataMask: DataMask;
  dependencies?: string[];
  sortMetric: string | null;
  adhoc_filters?: AdhocFilter[];
  time_range?: string;
  granularity_sqla?: string;
  type: typeof NativeFilterType.NATIVE_FILTER;
  description: string;
}
export interface NativeFilterDivider {
  id: string;
  type: typeof NativeFilterType.DIVIDER;
  title: string;
  description: string;
}

export interface NativeFiltersForm {
  filters: Record<string, NativeFiltersFormItem | NativeFilterDivider>;
  changed?: boolean;
}

export type FilterRemoval =
  | null
  | {
      isPending: true; // the filter sticks around for a moment before removal is finalized
      timerId: number; // id of the timer that finally removes the filter
    }
  | { isPending: false };
