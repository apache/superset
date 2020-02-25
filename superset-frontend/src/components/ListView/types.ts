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
export interface SortColumn {
  id: string;
  desc?: boolean;
}

export type SortColumns = SortColumn[];

export interface Select {
  label: string;
  value: any;
}

export interface Filter {
  Header: string;
  id: string;
  operators: Select[];
  input?: 'text' | 'textarea' | 'select' | 'checkbox';
  selects?: Select[];
}

export type Filters = Filter[];

export interface FilterValue {
  id: string;
  operator?: string;
  value: string | boolean | number;
}

export interface FetchDataConfig {
  pageIndex: number;
  pageSize: number;
  sortBy: SortColumns;
  filters: FilterValue[];
}

export interface InternalFilter extends FilterValue {
  Header: string;
}

export interface FilterOperatorMap {
  [columnId: string]: Array<{
    name: string;
    operator:
      | 'sw'
      | 'ew'
      | 'ct'
      | 'eq'
      | 'nsw'
      | 'new'
      | 'nct'
      | 'neq'
      | 'rel_m_m';
  }>;
}
