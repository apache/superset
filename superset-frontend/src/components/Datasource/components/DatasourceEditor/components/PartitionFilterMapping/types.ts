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

/** The subset of a dataset column this feature reads. */
export interface PartitionMappingColumn {
  column_name: string;
  type?: string | null;
  is_dttm?: boolean;
  filterable?: boolean;
  groupby?: boolean;
  partition_value_transform?: string | null;
  partition_transform_is_monotonic?: boolean;
}

/** The dataset-level half of the mapping. */
export interface PartitionMappingDatasource {
  id?: number;
  main_dttm_col?: string | null;
  partition_column?: string | null;
  partition_mapped_column?: string | null;
  partition_value_transform_default?: string | null;
}

/** Response shape of `POST /api/v1/dataset/<pk>/partition_mapping/preview/`. */
export interface PartitionMappingPreview {
  valid: boolean;
  sample_input?: string;
  emitted_predicate?: string;
  error?: string;
  /** Why it is invalid, so the panel can headline it correctly. */
  reason?: 'parse' | 'validation' | 'operator' | 'engine' | 'unconfigured';
}

/**
 * What a column's row expand should show.
 *
 * `mapped` holds the transform; `unmapped` offers to take it over; the
 * partition column itself shows nothing, because it is the target of the
 * mapping rather than a source for one.
 */
export type PartitionRowState = 'mapped' | 'unmapped' | 'partition' | 'none';
