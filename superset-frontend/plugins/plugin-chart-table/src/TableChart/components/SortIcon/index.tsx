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
import { ColumnInstance } from 'react-table';
import { FaSort } from '@react-icons/all-files/fa/FaSort';
import { FaSortDown as FaSortDesc } from '@react-icons/all-files/fa/FaSortDown';
import { FaSortUp as FaSortAsc } from '@react-icons/all-files/fa/FaSortUp';

export interface SortIconProps<D extends object> {
  column: ColumnInstance<D>;
}

/**
 * Renders the appropriate sort icon based on column sort state
 * - Unsorted: FaSort (⇕)
 * - Sorted descending: FaSortDesc (↓)
 * - Sorted ascending: FaSortAsc (↑)
 */
export default function SortIcon<D extends object>({
  column,
}: SortIconProps<D>) {
  const { isSorted, isSortedDesc } = column;
  let sortIcon = <FaSort />;

  if (isSorted) sortIcon = isSortedDesc ? <FaSortDesc /> : <FaSortAsc />;

  return sortIcon;
}
