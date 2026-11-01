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

interface PartitionFilterMappingSummary {
  active?: boolean;
  evaluable?: boolean | null;
  is_monotonic?: boolean;
  mapped_column?: string | null;
}

interface DatasetWithPartitionMapping {
  partition_filter_mapping?: PartitionFilterMappingSummary | null;
  columns?: { column_name: string; is_dttm?: boolean }[];
}

/**
 * The column a time range should go on so that a filter's value list prunes
 * partitions, or `undefined` when no time range would.
 *
 * Only a live mapping prunes, and only an order-preserving one mirrors a range
 * -- the time range among them. `evaluable === false` is the engine having
 * refused the transform; `null` is "not probed yet" and still counts. The
 * mapped column must be temporal, because that is what the filter's time
 * column picker offers.
 */
export function partitionedTimeRangeColumn(
  dataset: DatasetWithPartitionMapping | undefined,
): string | undefined {
  const mapping = dataset?.partition_filter_mapping;
  const mappedColumn = mapping?.mapped_column;
  if (
    !mapping?.active ||
    mapping.evaluable === false ||
    !mapping.is_monotonic ||
    !mappedColumn
  ) {
    return undefined;
  }
  return dataset?.columns?.some(
    column => column.column_name === mappedColumn && column.is_dttm,
  )
    ? mappedColumn
    : undefined;
}
