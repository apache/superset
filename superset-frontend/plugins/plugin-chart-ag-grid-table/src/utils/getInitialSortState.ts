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
// All ag grid sort related stuff
import {
  GridState,
  SortModelItem,
} from '@superset-ui/core/components/ThemedAgGridReact';
import { SortByItem } from '../types';

const getInitialSortState = (sortBy?: SortByItem[]): SortModelItem[] => {
  if (Array.isArray(sortBy) && sortBy.length > 0) {
    return [
      {
        colId: sortBy[0]?.id,
        sort: sortBy[0]?.desc ? 'desc' : 'asc',
      },
    ];
  }
  return [];
};

export const shouldSort = ({
  colId,
  sortDir,
  percentMetrics,
  serverPagination,
  gridInitialState,
}: {
  colId: string;
  sortDir: string;
  percentMetrics: string[];
  serverPagination: boolean;
  gridInitialState: GridState;
}) => {
  // percent metrics are not sortable
  if (percentMetrics.includes(colId)) return false;
  // if server pagination is not enabled, return false
  // since this is server pagination sort
  if (!serverPagination) return false;

  const {
    colId: initialColId = '',
    sort: initialSortDir,
  }: Partial<SortModelItem> = gridInitialState?.sort?.sortModel?.[0] || {};

  // if the initial sort is the same as the current sort, return false
  if (initialColId === colId && initialSortDir === sortDir) return false;

  return true;
};

export default getInitialSortState;
