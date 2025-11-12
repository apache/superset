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
import { useCallback } from 'react';
import { SetDataMaskHook } from '@superset-ui/core';
import { updateTableOwnState } from '../../../DataTable/utils/externalAPIs';
import { SortByItem, ServerPaginationData, SearchOption } from '../../../types';

export interface UseServerPaginationProps {
  serverPaginationData: ServerPaginationData;
  setDataMask: SetDataMaskHook;
  serverPagination: boolean;
}

export function useServerPagination({
  serverPaginationData,
  setDataMask,
  serverPagination,
}: UseServerPaginationProps) {
  const handleServerPaginationChange = useCallback(
    (pageNumber: number, pageSize: number) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: pageNumber,
        pageSize,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask, serverPaginationData],
  );

  const handleSortByChange = useCallback(
    (sortBy: SortByItem[]) => {
      if (!serverPagination) return;
      const modifiedOwnState = {
        ...serverPaginationData,
        sortBy,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask, serverPagination, serverPaginationData],
  );

  const handleSearchColChange = useCallback(
    (searchCol: string) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        searchColumn: searchCol,
        searchText: '',
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask, serverPaginationData],
  );

  const handleSearch = useCallback(
    (searchText: string, searchOptions: SearchOption[]) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        searchColumn:
          serverPaginationData?.searchColumn || searchOptions[0]?.value,
        searchText,
        currentPage: 0,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask, serverPaginationData],
  );

  return {
    handleServerPaginationChange,
    handleSortByChange,
    handleSearchColChange,
    handleSearch,
  };
}
