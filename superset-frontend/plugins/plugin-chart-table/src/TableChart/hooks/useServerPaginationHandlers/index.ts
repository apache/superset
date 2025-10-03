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
import { useCallback, useMemo, useEffect, useRef } from 'react';
import { SetDataMaskHook } from '@superset-ui/core';
import { debounce, isEqual } from 'lodash';
import { SearchOption, SortByItem, ServerPaginationData } from '../../../types';
import { updateTableOwnState } from '../../../DataTable/utils/externalAPIs';

export interface UseServerPaginationHandlersProps {
  serverPagination: boolean;
  serverPaginationData?: ServerPaginationData;
  serverPageLength: number;
  hasServerPageLengthChanged: boolean;
  searchOptions: SearchOption[];
  setDataMask: SetDataMaskHook;
}

export interface UseServerPaginationHandlersReturn {
  handleServerPaginationChange: (pageNumber: number, pageSize: number) => void;
  handleSortByChange: (sortBy: SortByItem[]) => void;
  debouncedSearch: (searchText: string) => void;
  handleChangeSearchCol: (searchCol: string) => void;
}

/**
 * Manages all server-side pagination handlers including page changes, sorting,
 * search, and search column selection. Includes debounced search with cleanup.
 */
export function useServerPaginationHandlers({
  serverPagination,
  serverPaginationData,
  serverPageLength,
  hasServerPageLengthChanged,
  searchOptions,
  setDataMask,
}: UseServerPaginationHandlersProps): UseServerPaginationHandlersReturn {
  const prevPageLengthRef = useRef(serverPageLength);

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

  const debouncedSearch = useMemo(
    () =>
      debounce((searchText: string) => {
        const modifiedOwnState = {
          ...serverPaginationData,
          searchColumn:
            serverPaginationData?.searchColumn || searchOptions[0]?.value,
          searchText,
          currentPage: 0,
        };
        updateTableOwnState(setDataMask, modifiedOwnState);
      }, 800),
    [serverPaginationData, searchOptions, setDataMask],
  );

  const handleChangeSearchCol = useCallback(
    (searchCol: string) => {
      if (!isEqual(searchCol, serverPaginationData?.searchColumn)) {
        const modifiedOwnState = {
          ...serverPaginationData,
          searchColumn: searchCol,
          searchText: '',
        };
        updateTableOwnState(setDataMask, modifiedOwnState);
      }
    },
    [serverPaginationData, setDataMask],
  );

  useEffect(
    () => () => {
      debouncedSearch.cancel();
    },
    [debouncedSearch],
  );

  useEffect(() => {
    if (
      hasServerPageLengthChanged &&
      prevPageLengthRef.current !== serverPageLength
    ) {
      prevPageLengthRef.current = serverPageLength;
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: 0,
        pageSize: serverPageLength,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    }
  }, [
    hasServerPageLengthChanged,
    serverPageLength,
    serverPaginationData,
    setDataMask,
  ]);

  return {
    handleServerPaginationChange,
    handleSortByChange,
    debouncedSearch,
    handleChangeSearchCol,
  };
}
