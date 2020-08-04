// Type definitions for react-virtualized 9.21
// Project: https://github.com/bvaughn/react-virtualized
// Definitions by: Kalle Ott <https://github.com/kaoDev>
//                 John Gunther <https://github.com/guntherjh>
//                 Konstantin Nesterov <https://github.com/wasd171>
//                 Szőke Szabolcs <https://github.com/szabolcsx>
//                 Steve Zhang <https://github.com/Stevearzh>
//                 Maciej Goszczycki <https://github.com/mgoszcz2>
//                 Brandon Hall <https://github.com/brandonhall>
//                 Sebastian Busch <https://github.com/sbusch>
//                 Adam Zmenak <https://github.com/azmenak>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.8

export {
    ArrowKeyStepper,
    ArrowKeyStepperProps,
    ChildProps as ArrowKeyStepperChildProps,
    ScrollIndices,
} from './dist/es/ArrowKeyStepper';
export { AutoSizer, AutoSizerProps, Dimensions, Size } from './dist/es/AutoSizer';
export {
    CellMeasurer,
    CellMeasurerCache,
    CellMeasurerCacheParams,
    CellMeasurerProps,
    KeyMapper,
} from './dist/es/CellMeasurer';
export {
    Collection,
    CollectionCellGroupRenderer,
    CollectionCellGroupRendererParams,
    CollectionCellRenderer,
    CollectionCellRendererParams,
    CollectionCellSizeAndPosition,
    CollectionCellSizeAndPositionGetter,
    CollectionProps,
} from './dist/es/Collection';
export { ColumnSizer, ColumnSizerProps, SizedColumnProps } from './dist/es/ColumnSizer';
export {
    accessibilityOverscanIndicesGetter,
    defaultOverscanIndicesGetter,
    defaultCellRangeRenderer,
    Grid,
    CellSizeAndPositionManager,
    ConfigureParams,
    ContainerSizeAndOffset,
    GetVisibleCellRangeParams,
    GridCellProps,
    GridCellRangeProps,
    GridCellRangeRenderer,
    GridCellRenderer,
    GridProps,
    GridState,
    OverscanIndices,
    OverscanIndicesGetterParams,
    ScrollDirection,
    ScrollParams,
    SectionRenderedParams,
    SizeAndPositionData,
    VisibleCellRange,
    ScrollbarPresenceParams,
} from './dist/es/Grid';
export { InfiniteLoader, InfiniteLoaderChildProps, InfiniteLoaderProps } from './dist/es/InfiniteLoader';
export { List, ListProps, ListRowProps, ListRowRenderer } from './dist/es/List';
export {
    createCellPositioner as createMasonryCellPositioner,
    Masonry,
    CellRenderer,
    MasonryCellProps,
    MasonryProps,
    MasonryState,
    OnCellsRenderedCallback,
    OnScrollCallback,
    Position,
    Positioner,
} from './dist/es/Masonry';
export { MultiGrid, MultiGridProps, MultiGridState } from './dist/es/MultiGrid';
export {
    ScrollSync,
    OnScrollParams,
    ScrollSyncChildProps,
    ScrollSyncProps,
    ScrollSyncState,
} from './dist/es/ScrollSync';
export {
    createMultiSort as createTableMultiSort,
    defaultCellDataGetter as defaultTableCellDataGetter,
    defaultCellRenderer as defaultTableCellRenderer,
    defaultHeaderRenderer as defaultTableHeaderRenderer,
    defaultHeaderRowRenderer as defaultTableHeaderRowRenderer,
    defaultRowRenderer as defaultTableRowRenderer,
    Table,
    Column,
    SortDirection,
    SortIndicator,
    ColumnProps,
    HeaderMouseEventHandlerParams,
    RowMouseEventHandlerParams,
    SortDirectionType,
    TableCellDataGetter,
    TableCellDataGetterParams,
    TableCellProps,
    TableCellRenderer,
    TableHeaderProps,
    TableHeaderRenderer,
    TableHeaderRowProps,
    TableHeaderRowRenderer,
    TableProps,
    TableRowProps,
    TableRowRenderer,
    SortParams,
} from './dist/es/Table';
export {
    WindowScroller,
    WindowScrollerChildProps,
    WindowScrollerProps,
    WindowScrollerState,
    IS_SCROLLING_TIMEOUT,
} from './dist/es/WindowScroller';

export type Index = {
    index: number;
};

export type PositionInfo = {
    x: number;
    y: number;
};

export type ScrollPosition = {
    scrollLeft: number;
    scrollTop: number;
};

export type SizeInfo = {
    height: number;
    width: number;
};

export type SizeAndPositionInfo = SizeInfo & PositionInfo;

export type Map<T> = { [key: string]: T };

export type Alignment = 'auto' | 'end' | 'start' | 'center';

export type IndexRange = {
    startIndex: number;
    stopIndex: number;
};

export type OverscanIndexRange = {
    overscanStartIndex: number;
    overscanStopIndex: number;
};

export type ScrollEventData = {
    clientHeight: number;
    scrollHeight: number;
    scrollTop: number;
};
