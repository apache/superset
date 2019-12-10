export type SortColumn = {
  id: string;
  desc: boolean;
};

export type SortColumns = Array<SortColumn>;

export type Filter = {
  filterId: number;
  filterValue: string;
};

type FilterMap = {
  [columnId: string]: Filter;
};

export type FetchDataConfig = {
  pageIndex: number;
  pageSize: number;
  sortBy: SortColumns;
  filters: FilterMap;
};

export type TableState = {
  getTableProps: () => any;
  getTableBodyProps: () => any;
  headerGroups: any;
  rows: any;
  prepareRow: (row: any) => void;
  canPreviousPage: boolean;
  canNextPage: boolean;
  pageCount: number;
  gotoPage: (page: number) => void;
  setFilter: (columnId: string, filter: Filter) => void;
  setAllFilters: (filters: FilterMap) => void;
  state: {
    pageIndex: number;
    pageSize: number;
    sortBy: SortColumns;
    filters: FilterMap;
  };
};

export type FilterToggle = {
  id: string;
  Header: string;
  filterId?: number;
  filterValue?: string;
};

export type FilterToggles = Array<FilterToggle>;
