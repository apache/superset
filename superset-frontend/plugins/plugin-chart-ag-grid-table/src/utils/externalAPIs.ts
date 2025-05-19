import { SetDataMaskHook } from '@superset-ui/core';

interface TableOwnState {
  currentPage?: number;
  pageSize?: number;
  sortColumn?: string;
  sortOrder?: 'asc' | 'desc';
  searchText?: string;
}

export const updateTableOwnState = (
  setDataMask: SetDataMaskHook = () => {},
  modifiedOwnState: TableOwnState,
) =>
  setDataMask({
    ownState: modifiedOwnState,
  });
