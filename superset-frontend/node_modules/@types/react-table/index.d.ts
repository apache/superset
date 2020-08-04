// Type definitions for react-table 7.0
// Project: https://github.com/tannerlinsley/react-table
// Definitions by: Guy Gascoigne-Piggford <https://github.com/ggascoigne>,
//                 Michael Stramel <https://github.com/stramel>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 3.5
// reflects react-table@7.0.0-rc.15

// tslint:disable:no-empty-interface
// no-empty-interface is disabled to allow easy extension with declaration merging

// tslint:disable:no-unnecessary-generics
// no-unnecessary-generics is disabled because many of these definitions are either used in a generic
// context or the signatures are required to match for declaration merging

import { ComponentType, DependencyList, EffectCallback, MouseEvent, ReactElement, ReactNode } from 'react';

export {};

/**
 * The empty definitions of below provides a base definition for the parts used by useTable, that can then be extended in the users code.
 *
 * @example
 *  export interface TableOptions<D extends object = {}}>
 *    extends
 *      UseExpandedOptions<D>,
 *      UseFiltersOptions<D> {}
 * see https://gist.github.com/ggascoigne/646e14c9d54258e40588a13aabf0102d for more details
 */
export interface TableOptions<D extends object> extends UseTableOptions<D> {}

export interface TableInstance<D extends object = {}>
    extends Omit<TableOptions<D>, 'columns' | 'pageCount'>,
        UseTableInstanceProps<D> {}

export interface TableState<D extends object = {}> {
    hiddenColumns?: Array<IdType<D>>;
}

export interface Hooks<D extends object = {}> extends UseTableHooks<D> {}

export interface Cell<D extends object = {}> extends UseTableCellProps<D> {}

export interface Column<D extends object = {}> extends UseTableColumnOptions<D> {}

export interface ColumnInstance<D extends object = {}>
    extends Omit<Column<D>, 'id' | 'columns'>,
        UseTableColumnProps<D> {}

export interface HeaderGroup<D extends object = {}> extends ColumnInstance<D>, UseTableHeaderGroupProps<D> {}

export interface Row<D extends object = {}> extends UseTableRowProps<D> {}

export interface TableCommonProps {
    style?: React.CSSProperties;
}

export interface TableProps extends TableCommonProps {}

export interface TableBodyProps extends TableCommonProps {}

export interface TableKeyedProps extends TableCommonProps {
    key: React.Key;
}

export interface TableHeaderGroupProps extends TableKeyedProps {}

export interface TableFooterGroupProps extends TableKeyedProps {}

export interface TableHeaderProps extends TableKeyedProps {}

export interface TableFooterProps extends TableKeyedProps {}

export interface TableRowProps extends TableKeyedProps {}

export interface TableCellProps extends TableKeyedProps {}

export interface TableToggleCommonProps {
    onChange?: () => void;
    style?: { cursor: string };
    checked?: boolean;
    title?: string;
    indeterminate?: boolean;
}

export interface MetaBase<D extends object> {
    instance: TableInstance<D>;
    userProps: any;
}

// inspired by ExtendState in  https://github.com/reduxjs/redux/blob/master/src/types/store.ts
export type Meta<D extends object, Extension = never, M = MetaBase<D>> = [Extension] extends [never]
    ? M
    : M & Extension;

//#region useTable
export function useTable<D extends object = {}>(
    options: TableOptions<D>,
    ...plugins: Array<PluginHook<D>>
): TableInstance<D>;

/**
 * NOTE: To use custom options, use "Interface Merging" to add the custom options
 */
export type UseTableOptions<D extends object> = {
    columns: Array<Column<D>>;
    data: D[];
} & Partial<{
    initialState: Partial<TableState<D>>;
    reducer: (newState: TableState<D>, action: ActionType, previousState: TableState<D>) => TableState<D>;
    useControlledState: (state: TableState<D>, meta: Meta<D>) => TableState<D>;
    defaultColumn: Partial<Column<D>>;
    initialRowStateKey: IdType<D>;
    getSubRows: (originalRow: D, relativeIndex: number) => D[];
    getRowId: (originalRow: D, relativeIndex: number) => IdType<D>;
}>;

export type PropGetter<D extends object, Props, T extends object = never, P = Partial<Props>> =
    | ((props: P, meta: Meta<D, T>) => P | P[])
    | P
    | P[];

export type TablePropGetter<D extends object> = PropGetter<D, TableProps>;

export type TableBodyPropGetter<D extends object> = PropGetter<D, TableBodyProps>;

export type HeaderPropGetter<D extends object> = PropGetter<D, TableHeaderProps, { column: HeaderGroup<D> }>;

export type FooterGroupPropGetter<D extends object> = PropGetter<D, TableFooterGroupProps, { column: HeaderGroup<D> }>;

export type HeaderGroupPropGetter<D extends object> = PropGetter<D, TableHeaderGroupProps, { column: HeaderGroup<D> }>;

export type FooterPropGetter<D extends object> = PropGetter<D, TableFooterProps, { column: HeaderGroup<D> }>;

export type RowPropGetter<D extends object> = PropGetter<D, TableRowProps, { row: Row<D> }>;

export type CellPropGetter<D extends object> = PropGetter<D, TableCellProps, { cell: Cell<D> }>;

export interface ReducerTableState<D extends object> extends TableState<D>, Record<string, any> {}

export interface UseTableHooks<D extends object> extends Record<string, any> {
    useOptions: Array<(options: TableOptions<D>, args: TableOptions<D>) => TableOptions<D>>;
    stateReducers: Array<
        (
            newState: TableState<D>,
            action: ActionType,
            previousState?: TableState<D>,
            instance?: TableInstance<D>,
        ) => ReducerTableState<D> | undefined
    >;
    columns: Array<(columns: Array<Column<D>>, meta: Meta<D>) => Array<Column<D>>>;
    columnsDeps: Array<(deps: any[], meta: Meta<D>) => any[]>;
    flatColumns: Array<(flatColumns: Array<Column<D>>, meta: Meta<D>) => Array<Column<D>>>;
    flatColumnsDeps: Array<(deps: any[], meta: Meta<D>) => any[]>;
    headerGroups: Array<(flatColumns: Array<HeaderGroup<D>>, meta: Meta<D>) => Array<HeaderGroup<D>>>;
    headerGroupDeps: Array<(deps: any[], meta: Meta<D>) => any[]>;
    useInstanceBeforeDimensions: Array<(instance: TableInstance<D>) => void>;
    useInstance: Array<(instance: TableInstance<D>) => void>;
    useRows: Array<(rows: Array<Row<D>>, meta: Meta<D>) => Array<Row<D>>>;
    prepareRow: Array<(row: Row<D>, meta: Meta<D>) => void>;
    useControlledState: Array<(state: TableState<D>, meta: Meta<D>) => TableState<D>>;

    getTableProps: Array<TablePropGetter<D>>;
    getTableBodyProps: Array<TableBodyPropGetter<D>>;
    getHeaderGroupProps: Array<HeaderGroupPropGetter<D>>;
    getFooterGroupProps: Array<FooterGroupPropGetter<D>>;
    getHeaderProps: Array<HeaderPropGetter<D>>;
    getFooterProps: Array<FooterPropGetter<D>>;
    getRowProps: Array<RowPropGetter<D>>;
    getCellProps: Array<CellPropGetter<D>>;
    useFinalInstance: Array<(instance: TableInstance<D>) => void>;
}

export interface UseTableColumnOptions<D extends object>
    extends Accessor<D>,
        Partial<{
            columns: Array<Column<D>>;
            show: boolean | ((instance: TableInstance<D>) => boolean);
            Header: Renderer<HeaderProps<D>>;
            Cell: Renderer<CellProps<D>>;
            width?: number | string;
            minWidth?: number;
            maxWidth?: number;
        }> {}

type UpdateHiddenColumns<D extends object> = (oldHidden: Array<IdType<D>>) => Array<IdType<D>>;

export interface TableToggleHideAllColumnProps extends TableToggleCommonProps {}

export interface UseTableInstanceProps<D extends object> {
    state: TableState<D>;
    hooks: Hooks<D>;
    dispatch: TableDispatch;
    columns: Array<ColumnInstance<D>>;
    flatColumns: Array<ColumnInstance<D>>;
    headerGroups: Array<HeaderGroup<D>>;
    footerGroups: Array<HeaderGroup<D>>;
    headers: Array<ColumnInstance<D>>;
    flatHeaders: Array<ColumnInstance<D>>;
    rows: Array<Row<D>>;
    getTableProps: (propGetter?: TablePropGetter<D>) => TableProps;
    getTableBodyProps: (propGetter?: TableBodyPropGetter<D>) => TableBodyProps;
    prepareRow: (row: Row<D>) => void;
    flatRows: Array<Row<D>>;
    totalColumnsWidth: number;
    toggleHideColumn: (columnId: IdType<D>, value?: boolean) => void;
    setHiddenColumns: (param: Array<IdType<D>> | UpdateHiddenColumns<D>) => void;
    toggleHideAllColumns: (value?: boolean) => void;
    getToggleHideAllColumnsProps: (props?: Partial<TableToggleHideAllColumnProps>) => TableToggleHideAllColumnProps;
}

export interface UseTableHeaderGroupProps<D extends object> {
    headers: Array<ColumnInstance<D>>;
    getHeaderGroupProps: (propGetter?: HeaderGroupPropGetter<D>) => TableHeaderProps;
    getFooterGroupProps: (propGetter?: FooterGroupPropGetter<D>) => TableFooterProps;
    totalHeaderCount: number; // not documented
}

export interface UseTableColumnProps<D extends object> {
    id: IdType<D>;
    columns: Array<ColumnInstance<D>>;
    isVisible: boolean;
    render: (type: 'Header' | 'Footer' | string, props?: object) => ReactNode;
    totalLeft: number;
    totalWidth: number;
    getHeaderProps: (propGetter?: HeaderPropGetter<D>) => TableHeaderProps;
    getFooterProps: (propGetter?: FooterPropGetter<D>) => TableFooterProps;
    toggleHidden: (value?: boolean) => void;
    parent: ColumnInstance<D>; // not documented
    getToggleHideColumnsProps: (userProps: any) => any;
    depth: number; // not documented
    index: number; // not documented
}

export interface UseTableRowProps<D extends object> {
    cells: Array<Cell<D>>;
    values: Record<IdType<D>, CellValue>;
    getRowProps: (propGetter?: RowPropGetter<D>) => TableRowProps;
    index: number;
    original: D;
    id: string;
    subRows: Array<Row<D>>;
    state: object;
}

export interface UseTableCellProps<D extends object> {
    column: ColumnInstance<D>;
    row: Row<D>;
    value: CellValue;
    getCellProps: (propGetter?: CellPropGetter<D>) => TableCellProps;
    render: (type: 'Cell' | string, userProps?: object) => ReactNode;
}

export type HeaderProps<D extends object> = TableInstance<D> & {
    column: ColumnInstance<D>;
};

export type CellProps<D extends object> = TableInstance<D> & {
    column: ColumnInstance<D>;
    row: Row<D>;
    cell: Cell<D>;
};

// NOTE: At least one of (id | accessor | Header as string) required
export interface Accessor<D extends object> {
    accessor?:
        | IdType<D>
        | ((
              originalRow: D,
              index: number,
              sub: {
                  subRows: D[];
                  depth: number;
                  data: D[];
              },
          ) => CellValue);
    id?: IdType<D>;
}

//#endregion

// Plugins

//#region useAbsoluteLayout
export function useAbsoluteLayout<D extends object = {}>(hooks: Hooks<D>): void;

export namespace useAbsoluteLayout {
    const pluginName = 'useAbsoluteLayout';
}
//#endregion

//#region useBlockLayout
export function useBlockLayout<D extends object = {}>(hooks: Hooks<D>): void;

export namespace useBlockLayout {
    const pluginName = 'useBlockLayout';
}
//#endregion

//#region useColumnOrder
export function useColumnOrder<D extends object = {}>(hooks: Hooks<D>): void;

export namespace useColumnOrder {
    const pluginName = 'useColumnOrder';
}

export interface UseColumnOrderState<D extends object> {
    columnOrder: Array<IdType<D>>;
}

export interface UseColumnOrderInstanceProps<D extends object> {
    setColumnOrder: (updater: (columnOrder: Array<IdType<D>>) => Array<IdType<D>>) => void;
}

//#endregion

//#region useExpanded
export function useExpanded<D extends object = {}>(hooks: Hooks<D>): void;

export namespace useExpanded {
    const pluginName = 'useExpanded';
}

export interface TableExpandedToggleProps extends TableKeyedProps {}

export type UseExpandedOptions<D extends object> = Partial<{
    manualExpandedKey: IdType<D>;
    paginateExpandedRows: boolean;
    expandSubRows: boolean;
    autoResetExpanded?: boolean;
}>;

export interface UseExpandedHooks<D extends object> {
    getExpandedToggleProps: Array<(row: Row<D>, instance: TableInstance<D>) => object>;
}

export interface UseExpandedState<D extends object> {
    expanded: Record<IdType<D>, boolean>;
}

export interface UseExpandedInstanceProps<D extends object> {
    rows: Array<Row<D>>;
    toggleExpanded: (id: Array<IdType<D>>, isExpanded: boolean) => void;
    expandedDepth: number;
}

export interface UseExpandedRowProps<D extends object> {
    isExpanded: boolean;
    canExpand: boolean;
    subRows: Array<Row<D>>;
    toggleExpanded: (isExpanded?: boolean) => void;
    getExpandedToggleProps: (props?: Partial<TableExpandedToggleProps>) => TableExpandedToggleProps;
}

//#endregion

//#region useFilters
export function useFilters<D extends object = {}>(hooks: Hooks<D>): void;

export namespace useFilters {
    const pluginName = 'useFilters';
}

export type UseFiltersOptions<D extends object> = Partial<{
    manualFilters: boolean;
    disableFilters: boolean;
    defaultCanFilter: boolean;
    filterTypes: FilterTypes<D>;
    autoResetFilters?: boolean;
}>;

export interface UseFiltersState<D extends object> {
    filters: Filters<D>;
}

export type UseFiltersColumnOptions<D extends object> = Partial<{
    Filter: Renderer<FilterProps<D>>;
    disableFilters: boolean;
    defaultCanFilter: boolean;
    filter: FilterType<D> | DefaultFilterTypes | string;
}>;

export interface UseFiltersInstanceProps<D extends object> {
    rows: Array<Row<D>>;
    preFilteredRows: Array<Row<D>>;
    setFilter: (columnId: IdType<D>, updater: ((filterValue: FilterValue) => FilterValue) | FilterValue) => void;
    setAllFilters: (updater: Filters<D> | ((filters: Filters<D>) => Filters<D>)) => void;
}

export interface UseFiltersColumnProps<D extends object> {
    canFilter: boolean;
    setFilter: (updater: ((filterValue: FilterValue) => FilterValue) | FilterValue) => void;
    filterValue: FilterValue;
    preFilteredRows: Array<Row<D>>;
    filteredRows: Array<Row<D>>;
}

export type FilterProps<D extends object> = HeaderProps<D>;
export type FilterValue = any;
export type Filters<D extends object> = Array<{ id: IdType<D>; value: FilterValue }>;
export type FilterTypes<D extends object> = Record<string, FilterValue>;

export type DefaultFilterTypes =
    | 'text'
    | 'exactText'
    | 'exactTextCase'
    | 'includes'
    | 'includesAll'
    | 'exact'
    | 'equals'
    | 'between';

export interface FilterType<D extends object> {
    (rows: Array<Row<D>>, columnIds: Array<IdType<D>>, filterValue: FilterValue): Array<Row<D>>;

    autoRemove?: (filterValue: FilterValue) => boolean;
}

//#endregion

//#region useFlexLayout
export function useFlexLayout<D extends object = {}>(hooks: Hooks<D>): void;

export namespace useFlexLayout {
    const pluginName = 'useFlexLayout';
}
//#endregion

//#region useGlobalFilter
export function useGlobalFilter<D extends object = {}>(hooks: Hooks<D>): void;

export namespace useGlobalFilter {
    const pluginName = 'useGlobalFilter';
}

export type UseGlobalFiltersOptions<D extends object> = Partial<{
    globalFilter: ((rows: Array<Row<D>>, columnIds: Array<IdType<D>>, filterValue: any) => Array<Row<D>>) | string;
    manualGlobalFilter: boolean;
    filterTypes: FilterTypes<D>;
    autoResetGlobalFilter?: boolean;
}>;

export interface UseGlobalFiltersState<D extends object> {
    globalFilter: any;
}

export interface UseGlobalFiltersInstanceProps<D extends object> {
    rows: Array<Row<D>>;
    preGlobalFilteredRows: Array<Row<D>>;
    setGlobalFilter: (filterValue: FilterValue) => void;
}

//#endregion

//#region useGroupBy
export function useGroupBy<D extends object = {}>(hooks: Hooks<D>): void;

export namespace useGroupBy {
    const pluginName = 'useGroupBy';
}

export interface TableGroupByToggleProps {}

export type UseGroupByOptions<D extends object> = Partial<{
    manualGroupBy: boolean;
    disableGroupBy: boolean;
    defaultCanGroupBy: boolean;
    aggregations: Record<string, AggregatorFn<D>>;
    groupByFn: (rows: Array<Row<D>>, columnId: IdType<D>) => Record<string, Row<D>>;
    autoResetGroupBy?: boolean;
}>;

export interface UseGroupByHooks<D extends object> {
    getGroupByToggleProps: Array<(header: HeaderGroup<D>, instance: TableInstance<D>) => object>;
}

export interface UseGroupByState<D extends object> {
    groupBy: Array<IdType<D>>;
}

export type UseGroupByColumnOptions<D extends object> = Partial<{
    aggregate: Aggregator<D> | Array<Aggregator<D>>;
    Aggregated: Renderer<CellProps<D>>;
    disableGroupBy: boolean;
    defaultCanGroupBy: boolean;
    groupByBoundary: boolean;
}>;

export interface UseGroupByInstanceProps<D extends object> {
    rows: Array<Row<D>>;
    preGroupedRows: Array<Row<D>>;
    toggleGroupBy: (columnId: IdType<D>, toggle: boolean) => void;
}

export interface UseGroupByColumnProps<D extends object> {
    canGroupBy: boolean;
    isGrouped: boolean;
    groupedIndex: number;
    toggleGroupBy: () => void;
    getGroupByToggleProps: (props?: Partial<TableGroupByToggleProps>) => TableGroupByToggleProps;
}

export interface UseGroupByRowProps<D extends object> {
    isGrouped: boolean;
    groupById: IdType<D>;
    groupByVal: string;
    values: Record<IdType<D>, AggregatedValue>;
    subRows: Array<Row<D>>;
    depth: number;
    id: string;
    index: number;
}

export interface UseGroupByCellProps<D extends object> {
    isGrouped: boolean;
    isRepeatedValue: boolean;
    isAggregated: boolean;
}

export type DefaultAggregators = 'sum' | 'average' | 'median' | 'uniqueCount' | 'count';

export type AggregatorFn<D extends object> = (
    columnValues: CellValue[],
    rows: Array<Row<D>>,
    isAggregated: boolean,
) => AggregatedValue;
export type Aggregator<D extends object> = AggregatorFn<D> | DefaultAggregators | string;
export type AggregatedValue = any;
//#endregion

//#region usePagination
export function usePagination<D extends object = {}>(hooks: Hooks<D>): void;

export namespace usePagination {
    const pluginName = 'usePagination';
}

export type UsePaginationOptions<D extends object> = Partial<{
    pageCount: number;
    manualPagination: boolean;
    autoResetPage?: boolean;
    paginateExpandedRows: boolean;
}>;

export interface UsePaginationState<D extends object> {
    pageSize: number;
    pageIndex: number;
}

export interface UsePaginationInstanceProps<D extends object> {
    page: Array<Row<D>>;
    pageCount: number;
    pageOptions: number[];
    canPreviousPage: boolean;
    canNextPage: boolean;
    gotoPage: (updater: ((pageIndex: number) => number) | number) => void;
    previousPage: () => void;
    nextPage: () => void;
    setPageSize: (pageSize: number) => void;
}

//#endregion

//#region useResizeColumns
export function useResizeColumns<D extends object = {}>(hooks: Hooks<D>): void;

export namespace useResizeColumns {
    const pluginName = 'useResizeColumns';
}

export interface UseResizeColumnsOptions<D extends object> {
    disableResizing?: boolean;
}

export interface UseResizeColumnsState<D extends object> {
    columnResizing: {
        startX?: number;
        columnWidth: number;
        headerIdWidths: Record<string, number>;
        columnWidths: any;
        isResizingColumn?: string;
    };
}

export interface UseResizeColumnsColumnOptions<D extends object> {
    disableResizing?: boolean;
}

export interface TableResizerProps {}

export interface UseResizeColumnsColumnProps<D extends object> {
    getResizerProps: (props?: Partial<TableResizerProps>) => TableResizerProps;
    canResize: boolean;
    isResizing: boolean;
}

//#endregion

//#region useRowSelect
export function useRowSelect<D extends object = {}>(hooks: Hooks<D>): void;

export namespace useRowSelect {
    const pluginName = 'useRowSelect';
}

export interface TableToggleAllRowsSelectedProps extends TableToggleCommonProps {}

export interface TableToggleRowsSelectedProps extends TableToggleCommonProps {}

export type UseRowSelectOptions<D extends object> = Partial<{
    manualRowSelectedKey: IdType<D>;
    autoResetSelectedRows: boolean;
}>;

export interface UseRowSelectHooks<D extends object> {
    getToggleRowSelectedProps: Array<(row: Row<D>, instance: TableInstance<D>) => object>;
    getToggleAllRowsSelectedProps: Array<(instance: TableInstance<D>) => object>;
}

export interface UseRowSelectState<D extends object> {
    selectedRowIds: Record<IdType<D>, boolean>;
}

export interface UseRowSelectInstanceProps<D extends object> {
    toggleRowSelected: (rowId: IdType<D>, set?: boolean) => void;
    toggleAllRowsSelected: (set?: boolean) => void;
    getToggleAllRowsSelectedProps: (
        props?: Partial<TableToggleAllRowsSelectedProps>,
    ) => TableToggleAllRowsSelectedProps;
    isAllRowsSelected: boolean;
    selectedFlatRows: Array<Row<D>>;
}

export interface UseRowSelectRowProps<D extends object> {
    isSelected: boolean;
    isSomeSelected: boolean;
    toggleRowSelected: (set?: boolean) => void;
    getToggleRowSelectedProps: (props?: Partial<TableToggleRowsSelectedProps>) => TableToggleRowsSelectedProps;
}

//#endregion

//#region useRowState
export function useRowState<D extends object = {}>(hooks: Hooks<D>): void;

export namespace useRowState {
    const pluginName = 'useRowState';
}

export type UseRowStateOptions<D extends object> = Partial<{
    initialRowStateAccessor: (row: Row<D>) => UseRowStateLocalState<D>;
    getResetRowStateDeps: (instance: TableInstance<D>) => any[];
    autoResetRowState?: boolean;
}>;

export interface UseRowStateState<D extends object> {
    rowState: Record<string, { cellState: UseRowStateLocalState<D> }>;
}

export interface UseRowStateInstanceProps<D extends object> {
    setRowState: (rowPath: string[], updater: UseRowUpdater) => void;
    setCellState: (rowPath: string[], columnId: IdType<D>, updater: UseRowUpdater) => void;
}

export interface UseRowStateRowProps<D extends object> {
    state: UseRowStateLocalState<D>;
    setState: (updater: UseRowUpdater) => void;
}

export interface UseRowStateCellProps<D extends object> {
    state: UseRowStateLocalState<D>;
    setState: (updater: UseRowUpdater) => void;
}

export type UseRowUpdater<T = unknown> = T | ((prev: T) => T);
export type UseRowStateLocalState<D extends object, T = unknown> = Record<IdType<D>, T>;
//#endregion

//#region useSortBy
export function useSortBy<D extends object = {}>(hooks: Hooks<D>): void;

export namespace useSortBy {
    const pluginName = 'useSortBy';
}

export interface TableSortByToggleProps {}

export type UseSortByOptions<D extends object> = Partial<{
    manualSortBy: boolean;
    disableSortBy: boolean;
    defaultCanSort: boolean;
    disableMultiSort: boolean;
    isMultiSortEvent: (e: MouseEvent) => boolean;
    maxMultiSortColCount: number;
    disableSortRemove: boolean;
    disabledMultiRemove: boolean;
    orderByFn: (rows: Array<Row<D>>, sortFns: Array<SortByFn<D>>, directions: boolean[]) => Array<Row<D>>;
    sortTypes: Record<string, SortByFn<D>>;
    autoResetSortBy?: boolean;
}>;

export interface UseSortByHooks<D extends object> {
    getSortByToggleProps: Array<(column: Column<D>, instance: TableInstance<D>) => object>;
}

export interface UseSortByState<D extends object> {
    sortBy: Array<SortingRule<D>>;
}

export type UseSortByColumnOptions<D extends object> = Partial<{
    defaultCanSort: boolean;
    disableSortBy: boolean;
    sortDescFirst: boolean;
    sortInverted: boolean;
    sortType: SortByFn<D> | DefaultSortTypes | string;
}>;

export interface UseSortByInstanceProps<D extends object> {
    rows: Array<Row<D>>;
    preSortedRows: Array<Row<D>>;
    toggleSortBy: (columnId: IdType<D>, descending: boolean, isMulti: boolean) => void;
}

export interface UseSortByColumnProps<D extends object> {
    canSort: boolean;
    toggleSortBy: (descending: boolean, multi: boolean) => void;
    getSortByToggleProps: (props?: Partial<TableSortByToggleProps>) => TableSortByToggleProps;
    clearSorting: () => void;
    isSorted: boolean;
    sortedIndex: number;
    isSortedDesc: boolean | undefined;
}

export type SortByFn<D extends object> = (rowA: Row<D>, rowB: Row<D>, columnId: IdType<D>) => 0 | 1 | -1;

export type DefaultSortTypes = 'alphanumeric' | 'datetime' | 'basic';

export interface SortingRule<D> {
    id: IdType<D>;
    desc?: boolean;
}

//#endregion

// Additional API
export const actions: Record<string, string>;
export type ActionType = { type: string } & Record<string, any>;
export const defaultColumn: Partial<Column> & Record<string, any>;

// Helpers
export type StringKey<D> = Extract<keyof D, string>;
export type IdType<D> = StringKey<D> | string;
export type CellValue = any;

export type Renderer<Props> = ComponentType<Props> | ReactNode;

export interface PluginHook<D extends object> {
    (hooks: Hooks<D>): void;
    pluginName?: string;
}

export type TableDispatch<A = any> = (action: A) => void;

// utils
export function defaultOrderByFn<D extends object = {}>(
    arr: Array<Row<D>>,
    funcs: Array<SortByFn<D>>,
    dirs: boolean[],
): Array<Row<D>>;

export function defaultGroupByFn<D extends object = {}>(
    rows: Array<Row<D>>,
    columnId: IdType<D>,
): Record<string, Row<D>>;

export function makePropGetter(hooks: Hooks, ...meta: any[]): any;

export function reduceHooks<T extends object = {}>(hooks: Hooks, initial: T, ...args: any[]): T;

export function loopHooks(hooks: Hooks, ...args: any[]): void;

export function ensurePluginOrder<D extends object = {}>(
    plugins: Array<PluginHook<D>>,
    befores: string[],
    pluginName: string,
    afters: string[],
): void;

export function functionalUpdate<D extends object = {}>(
    updater: any,
    old: Partial<TableState<D>>,
): Partial<TableState<D>>;

export function useGetLatest<T>(obj: T): () => T;

export function safeUseLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;

export function useAsyncDebounce<F extends (...args: any[]) => any>(defaultFn: F, defaultWait?: number): F;

export function useConsumeHookGetter(hooks: Hooks, hookName: string): any;

export function makeRenderer(instance: TableInstance, column: ColumnInstance, meta?: any): ReactElement;
