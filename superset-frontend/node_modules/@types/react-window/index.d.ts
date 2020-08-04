// Type definitions for react-window 1.8
// Project: https://github.com/bvaughn/react-window/, http://react-window.now.sh
// Definitions by: Martynas Kadiša <https://github.com/martynaskadisa>
//                 Alex Guerra <https://github.com/heyimalex>
//                 John Gozde <https://github.com/jgoz>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.8

import {
    Component,
    ComponentType,
    CSSProperties,
    Ref,
    Key,
    FunctionComponent,
    ComponentClass
} from "react";

export type CSSDirection = "ltr" | "rtl";
export type Direction = "vertical" | "horizontal"; // TODO: deprecate in favour of Layout
export type Layout = "vertical" | "horizontal";
export type ScrollDirection = "forward" | "backward";
export type Align = "auto" | "smart" | "center" | "end" | "start";

export interface ListChildComponentProps {
    index: number;
    style: CSSProperties;
    data: any;
    isScrolling?: boolean;
}

export interface GridChildComponentProps {
    columnIndex: number;
    rowIndex: number;
    style: CSSProperties;
    data: any;
    isScrolling?: boolean;
}

// This is supposed to represent the type of the first parameter to
// React.createElement.
export type ReactElementType =
    | FunctionComponent<any>
    | ComponentClass<any>
    | string;

export interface CommonProps {
    /**
     * Optional CSS class to attach to outermost <div> element.
     */
    className?: string;
    /**
     * Tag name passed to document.createElement to create the inner container element. This is an advanced property; in most cases, the default ("div") should be used.
     */
    innerElementType?: ReactElementType;
    /**
     * Ref to attach to the inner container element. This is an advanced property.
     */
    innerRef?: Ref<any>;
    /**
     * Tag name passed to document.createElement to create the inner container element. This is an advanced property; in most cases, the default ("div") should be used.
     *
     * @deprecated since 1.4.0
     */
    innerTagName?: string;
    /**
     * Contextual data to be passed to the item renderer as a data prop. This is a light-weight alternative to React's built-in context API.
     *
     * Item data is useful for item renderers that are class components.
     */
    itemData?: any;
    /**
     * Tag name passed to document.createElement to create the outer container element. This is an advanced property; in most cases, the default ("div") should be used.
     */
    outerElementType?: ReactElementType;
    /**
     * Ref to attach to the outer container element. This is an advanced property.
     */
    outerRef?: Ref<any>;
    /**
     * Tag name passed to document.createElement to create the outer container element. This is an advanced property; in most cases, the default ("div") should be used.
     *
     * @deprecated since 1.4.0
     */
    outerTagName?: string;
    /**
     * Optional inline style to attach to outermost <div> element.
     */
    style?: CSSProperties;
    /**
     * Adds an additional isScrolling parameter to the children render function. This parameter can be used to show a placeholder row or column while the list is being scrolled.
     *
     * Note that using this parameter will result in an additional render call after scrolling has stopped (when isScrolling changes from true to false).
     */
    useIsScrolling?: boolean;
}

export type ListItemKeySelector = (index: number, data: any) => Key;

export interface ListOnItemsRenderedProps {
    overscanStartIndex: number;
    overscanStopIndex: number;
    visibleStartIndex: number;
    visibleStopIndex: number;
}

export interface ListOnScrollProps {
    scrollDirection: ScrollDirection;
    scrollOffset: number;
    scrollUpdateWasRequested: boolean;
}

export interface ListProps extends CommonProps {
    /**
     * React component responsible for rendering the individual item specified by an index prop. This component also receives a style prop (used for positioning).
     *
     * If useIsScrolling is enabled for the list, the component also receives an additional isScrolling boolean prop.
     */
    children: ComponentType<ListChildComponentProps>;
    /**
     * Height of the list.
     *
     * For vertical lists, this must be a number. It affects the number of rows that will be rendered (and displayed) at any given time.
     *
     * For horizontal lists, this can be a number or a string (e.g. "50%").
     */
    height: number | string;
    /**
     * Total number of items in the list. Note that only a few items will be rendered and displayed at a time.
     */
    itemCount: number;
    /**
     * Width of the list.
     *
     * For horizontal lists, this must be a number. It affects the number of columns that will be rendered (and displayed) at any given time.
     *
     * For vertical lists, this can be a number or a string (e.g. "50%").
     */
    width: number | string;
    /**
     * Determines the direction of text and horizontal scrolling.
     *
     * This property also automatically sets the CSS direction style for the list component.
     *
     * Specifying "horizontal" or "vertical" for this value is deprecated. Use "layout" prop instead.
     *
     * @default "ltr"
     */
    direction?: CSSDirection | Direction;
    /**
     * Layout/orientation of the list.
     *
     * Acceptable values are:
     * - "vertical" (default) - Up/down scrolling.
     * - "horizontal" - Left/right scrolling.
     *
     * Note that lists may scroll in both directions (depending on CSS) but content will only be windowed in the layout direction specified.
     */
    layout?: Layout;
    /**
     * Scroll offset for initial render.
     *
     * For vertical lists, this affects scrollTop. For horizontal lists, this affects scrollLeft.
     */
    initialScrollOffset?: number;
    /**
     * By default, lists will use an item's index as its key. This is okay if:
     *
     * - Your collections of items is never sorted or modified
     * - Your item renderer is not stateful and does not extend PureComponent
     *
     * If your list does not satisfy the above constraints, use the itemKey property to specify your own keys for items
     */
    itemKey?: ListItemKeySelector;
    /**
     * The number of items (rows or columns) to render outside of the visible area. This property can be important for two reasons:
     *
     * - Overscanning by one row or column allows the tab key to focus on the next (not yet visible) item.
     * - Overscanning slightly can reduce or prevent a flash of empty space when a user first starts scrolling.
     *
     * Note that overscanning too much can negatively impact performance. By default, List overscans by one item.
     */
    overscanCount?: number;
    /**
     * Called when the items rendered by the list change.
     */
    onItemsRendered?: (props: ListOnItemsRenderedProps) => any;
    /**
     * Called when the list scroll positions changes, as a result of user scrolling or scroll-to method calls.
     */
    onScroll?: (props: ListOnScrollProps) => any;
}

export type GridItemKeySelector = (params: {
    columnIndex: number;
    rowIndex: number;
    data: any;
}) => Key;

export interface GridOnItemsRenderedProps {
    overscanColumnStartIndex: number;
    overscanColumnStopIndex: number;
    overscanRowStartIndex: number;
    overscanRowStopIndex: number;
    visibleColumnStartIndex: number;
    visibleColumnStopIndex: number;
    visibleRowStartIndex: number;
    visibleRowStopIndex: number;
}

export interface GridOnScrollProps {
    horizontalScrollDirection: ScrollDirection;
    scrollLeft: number;
    scrollTop: number;
    scrollUpdateWasRequested: boolean;
    verticalScrollDirection: ScrollDirection;
}

export interface GridProps extends CommonProps {
    /**
     * React component responsible for rendering the individual item specified by an index prop. This component also receives a style prop (used for positioning).
     *
     * If useIsScrolling is enabled for the list, the component also receives an additional isScrolling boolean prop.
     */
    children: ComponentType<GridChildComponentProps>;
    /**
     * Number of columns in the grid. Note that only a few columns will be rendered and displayed at a time.
     */
    columnCount: number;
    /**
     * Determines the direction of text and horizontal scrolling.
     *
     * This property also automatically sets the CSS direction style for the grid component.
     *
     * @default "ltr"
     */
    direction?: CSSDirection;
    /**
     * Height of the grid. This affects the number of rows that will be rendered (and displayed) at any given time.
     */
    height: number;
    /**
     * Horizontal scroll offset for initial render.
     */
    initialScrollLeft?: number;
    /**
     * Vertical scroll offset for initial render.
     */
    initialScrollTop?: number;
    /**
     * By default, grids will use an item's indices as its key. This is okay if:
     *
     * - Your collections of items is never sorted or modified
     * - Your item renderer is not stateful and does not extend PureComponent
     *
     * If your grid does not satisfy the above constraints, use the itemKey property to specify your own keys for items.
     */
    itemKey?: GridItemKeySelector;
    /**
     * Called when the items rendered by the grid change.
     */
    onItemsRendered?: (props: GridOnItemsRenderedProps) => any;
    /**
     * Called when the grid scroll positions changes, as a result of user scrolling or scroll-to method calls.
     */
    onScroll?: (props: GridOnScrollProps) => any;
    /**
     * @deprecated since version 1.8.2, please use overscanColumnCount
     */
    overscanColumnsCount?: number;
    /**
     * The number of columns to render outside of the visible area. This property can be important for two reasons:
     *
     * - Overscanning by one row or column allows the tab key to focus on the next (not yet visible) item.
     * - Overscanning slightly can reduce or prevent a flash of empty space when a user first starts scrolling.
     *
     * Note that overscanning too much can negatively impact performance. By default, grid overscans by one item.
     */
    overscanColumnCount?: number;
    /**
     * @deprecated since version 1.8.2, please use overscanRowCount
     */
    overscanRowsCount?: number;
    /**
     * The number of rows to render outside of the visible area. This property can be important for two reasons:
     *
     * - Overscanning by one row or column allows the tab key to focus on the next (not yet visible) item.
     * - Overscanning slightly can reduce or prevent a flash of empty space when a user first starts scrolling.
     *
     * Note that overscanning too much can negatively impact performance. By default, grid overscans by one item.
     */
    overscanRowCount?: number;
    /**
     * The number of items (rows or columns) to render outside of the visible area. This property can be important for two reasons:
     *
     * - Overscanning by one row or column allows the tab key to focus on the next (not yet visible) item.
     * - Overscanning slightly can reduce or prevent a flash of empty space when a user first starts scrolling.
     *
     * Note that overscanning too much can negatively impact performance. By default, grid overscans by one item.
     *
     * @deprecated since version 1.4.0
     */
    overscanCount?: number;
    /**
     * Number of rows in the grid. Note that only a few rows will be rendered and displayed at a time.
     */
    rowCount: number;
    /**
     * Width of the grid. This affects the number of columns that will be rendered (and displayed) at any given time.
     */
    width: number;
}

export interface FixedSizeListProps extends ListProps {
    /**
     * Size of a item in the direction being windowed. For vertical lists, this is the row height. For horizontal lists, this is the column width.
     */
    itemSize: number;
}

export interface VariableSizeListProps extends ListProps {
    /**
     * Estimated size of a item in the direction being windowed. For vertical lists, this is the row height. For horizontal lists, this is the column width.
     *
     * This value is used to calculated the estimated total size of a list before its items have all been measured. The total size impacts user scrolling behavior.
     * It is updated whenever new items are measured.
     */
    estimatedItemSize?: number;
    /**
     * Returns the size of a item in the direction being windowed. For vertical lists, this is the row height. For horizontal lists, this is the column width.
     */
    itemSize: (index: number) => number;
}

export interface FixedSizeGridProps extends GridProps {
    /**
     * Width of an individual column within the grid.
     */
    columnWidth: number;
    /**
     * Height of an individual row within the grid.
     */
    rowHeight: number;
}

export interface VariableSizeGridProps extends GridProps {
    /**
     * Returns the width of the specified column.
     */
    columnWidth: (index: number) => number;
    /**
     * Average (or estimated) column width for unrendered columns.
     *
     * This value is used to calculated the estimated total width of a Grid before its columns have all been measured.
     * The estimated width impacts user scrolling behavior. It is updated whenever new columns are measured.
     */
    estimatedColumnWidth?: number;
    /**
     * Average (or estimated) row height for unrendered rows.
     *
     * This value is used to calculated the estimated total height of a Grid before its rows have all been measured.
     * The estimated height impacts user scrolling behavior. It is updated whenever new rows are measured.
     */
    estimatedRowHeight?: number;
    /**
     * Returns the height of the specified row.
     */
    rowHeight: (index: number) => number;
}

export class FixedSizeList extends Component<FixedSizeListProps> {
    /**
     * Scroll to the specified offset (scrollTop or scrollLeft, depending on the direction prop).
     */
    scrollTo(scrollOffset: number): void;
    /**
     * Scroll to the specified item.
     *
     * By default, the List will scroll as little as possible to ensure the item is visible.
     * You can control the alignment of the item though by specifying a second alignment parameter. Acceptable values are:
     *
     * - auto (default) - Scroll as little as possible to ensure the item is visible. (If the item is already visible, it won't scroll at all.)
     * - smart
     *   - If the item is already visible, don't scroll at all.
     *   - If it is less than one viewport away, scroll as little as possible so that it becomes visible.
     *   - If it is more than one viewport away, scroll so that it is centered within the list.
     * - center - Center align the item within the list.
     * - end - Align the item to the end of the list (the bottom for vertical lists or the right for horizontal lists).
     * - start - Align the item to the beginning of the list (the top for vertical lists or the left for horizontal lists).
     */
    scrollToItem(index: number, align?: Align): void;
}

export class VariableSizeList extends Component<VariableSizeListProps> {
    /**
     * Scroll to the specified offset (scrollTop or scrollLeft, depending on the direction prop).
     */
    scrollTo(scrollOffset: number): void;
    /**
     * Scroll to the specified item.
     *
     * By default, the List will scroll as little as possible to ensure the item is visible.
     * You can control the alignment of the item though by specifying a second alignment parameter. Acceptable values are:
     *
     * - auto (default) - Scroll as little as possible to ensure the item is visible. (If the item is already visible, it won't scroll at all.)
     * - smart
     *   - If the item is already visible, don't scroll at all.
     *   - If it is less than one viewport away, scroll as little as possible so that it becomes visible.
     *   - If it is more than one viewport away, scroll so that it is centered within the list.
     * - center - Center align the item within the list.
     * - end - Align the item to the end of the list (the bottom for vertical lists or the right for horizontal lists).
     * - start - Align the item to the beginning of the list (the top for vertical lists or the left for horizontal lists).
     */
    scrollToItem(index: number, align?: Align): void;
    /**
     * VariableSizeList caches offsets and measurements for each index for performance purposes.
     * This method clears that cached data for all items after (and including) the specified index.
     * It should be called whenever a item's size changes. (Note that this is not a typical occurrence.)
     *
     * By default the list will automatically re-render after the index is reset.
     * If you would like to delay this re-render until e.g. a state update has completed in the parent component,
     * specify a value of false for the second, optional parameter.
     */
    resetAfterIndex(index: number, shouldForceUpdate?: boolean): void;
}

export class FixedSizeGrid extends Component<FixedSizeGridProps> {
    /**
     * Scroll to the specified offsets.
     */
    scrollTo(params: { scrollLeft: number; scrollTop: number }): void;
    /**
     * Scroll to the specified item.
     *
     * By default, the Grid will scroll as little as possible to ensure the item is visible.
     * You can control the alignment of the item though by specifying an `align` property. Acceptable values are:
     *
     * - auto (default) - Scroll as little as possible to ensure the item is visible. (If the item is already visible, it won't scroll at all.)
     * - smart
     *   - If the item is already visible, don't scroll at all.
     *   - If it is less than one viewport away, scroll as little as possible so that it becomes visible.
     *   - If it is more than one viewport away, scroll so that it is centered within the grid.
     * - center - Center align the item within the grid.
     * - end - Align the item to the bottom, right hand side of the grid.
     * - start - Align the item to the top, left hand of the grid.
     *
     * If either `columnIndex` or `rowIndex` are omitted, `scrollLeft` or `scrollTop` will be unchanged (respectively).
     */
    scrollToItem(params: {
        align?: Align;
        columnIndex?: number;
        rowIndex?: number;
    }): void;
}

export class VariableSizeGrid extends Component<VariableSizeGridProps> {
    /**
     * Scroll to the specified offsets.
     */
    scrollTo(params: { scrollLeft: number; scrollTop: number }): void;
    /**
     * Scroll to the specified item.
     *
     * By default, the Grid will scroll as little as possible to ensure the item is visible.
     * You can control the alignment of the item though by specifying an `align` property. Acceptable values are:
     *
     * - auto (default) - Scroll as little as possible to ensure the item is visible. (If the item is already visible, it won't scroll at all.)
     * - smart
     *   - If the item is already visible, don't scroll at all.
     *   - If it is less than one viewport away, scroll as little as possible so that it becomes visible.
     *   - If it is more than one viewport away, scroll so that it is centered within the grid.
     * - center - Center align the item within the grid.
     * - end - Align the item to the bottom, right hand side of the grid.
     * - start - Align the item to the top, left hand of the grid.
     *
     * If either `columnIndex` or `rowIndex` are omitted, `scrollLeft` or `scrollTop` will be unchanged (respectively).
     */
    scrollToItem(params: {
        align?: Align;
        columnIndex?: number;
        rowIndex?: number;
    }): void;
    /**
     * VariableSizeGrid caches offsets and measurements for each column index for performance purposes.
     * This method clears that cached data for all columns after (and including) the specified index.
     * It should be called whenever a column's width changes. (Note that this is not a typical occurrence.)
     *
     * By default the grid will automatically re-render after the index is reset.
     * If you would like to delay this re-render until e.g. a state update has completed in the parent component,
     * specify a value of false for the second, optional parameter.
     */
    resetAfterColumnIndex(index: number, shouldForceUpdate?: boolean): void;
    /**
     * VariableSizeGrid caches offsets and measurements for each item for performance purposes.
     * This method clears that cached data for all items after (and including) the specified indices.
     * It should be called whenever an items size changes. (Note that this is not a typical occurrence.)
     *
     * By default the grid will automatically re-render after the index is reset.
     * If you would like to delay this re-render until e.g. a state update has completed in the parent component,
     * specify a value of false for the optional shouldForceUpdate parameter.
     */
    resetAfterIndices(params: {
        columnIndex: number;
        rowIndex: number;
        shouldForceUpdate?: boolean;
    }): void;
    /**
     * VariableSizeGrid caches offsets and measurements for each row index for performance purposes.
     * This method clears that cached data for all rows after (and including) the specified index.
     * It should be called whenever a row's height changes. (Note that this is not a typical occurrence.)
     *
     * By default the grid will automatically re-render after the index is reset.
     * If you would like to delay this re-render until e.g. a state update has completed in the parent component,
     * specify a value of false for the second, optional parameter.
     */
    resetAfterRowIndex(index: number, shouldForceUpdate?: boolean): void;
}

/**
 * Custom comparison function for React.memo().
 * It knows to compare individual style props and ignore the wrapper object.
 *
 * @see https://reactjs.org/docs/react-api.html#reactmemo
 */
export function areEqual(
    prevProps: Readonly<object>,
    nextProps: Readonly<object>
): boolean;

/**
 * Custom shouldComponentUpdate for class components.
 * It knows to compare individual style props and ignore the wrapper object.
 *
 * @see https://reactjs.org/docs/react-component.html#shouldcomponentupdate
 */
export function shouldComponentUpdate<P = {}, S = {}>(
    this: { props: P; state: S },
    nextProps: Readonly<P>,
    nextState: Readonly<S>
): boolean;
