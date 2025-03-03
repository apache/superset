// DODO was here

/**
 * Merge typing interfaces for UseTable hooks.
 *
 * Ref: https://gist.github.com/ggascoigne/646e14c9d54258e40588a13aabf0102d
 */
import {
  UseGlobalFiltersState,
  UseGlobalFiltersOptions,
  UseGlobalFiltersInstanceProps,
  UsePaginationInstanceProps,
  UsePaginationOptions,
  UsePaginationState,
  UseSortByColumnOptions,
  UseSortByColumnProps,
  UseSortByInstanceProps,
  UseSortByOptions,
  UseSortByState,
  UseTableHooks,
  UseSortByHooks,
  UseColumnOrderState,
  UseColumnOrderInstanceProps,
  Renderer,
  HeaderProps,
  TableFooterProps,
} from 'react-table';
import { DragEvent } from 'react';

import {
  UseStickyState,
  UseStickyTableOptions,
  UseStickyInstanceProps,
} from '../hooks/useSticky';

declare module 'react-table' {
  export interface TableOptions<D extends object>
    extends UseExpandedOptions<D>,
      UseGlobalFiltersOptions<D>,
      UsePaginationOptions<D>,
      UseRowSelectOptions<D>,
      UseSortByOptions<D>,
      UseStickyTableOptions {}

  export interface TableInstance<D extends object>
    extends UseColumnOrderInstanceProps<D>,
      UseExpandedInstanceProps<D>,
      UseGlobalFiltersInstanceProps<D>,
      UsePaginationInstanceProps<D>,
      UseRowSelectInstanceProps<D>,
      UseRowStateInstanceProps<D>,
      UseSortByInstanceProps<D>,
      UseColumnOrderInstanceProps<D>,
      UseStickyInstanceProps {}

  export interface TableState<D extends object>
    extends UseColumnOrderState<D>,
      UseExpandedState<D>,
      UseGlobalFiltersState<D>,
      UsePaginationState<D>,
      UseRowSelectState<D>,
      UseSortByState<D>,
      UseColumnOrderState<D>,
      UseStickyState {}

  // Typing from @types/react-table is incomplete
  interface TableSortByToggleProps {
    style?: CSSProperties;
    title?: string;
    onClick?: MouseEventHandler;
  }

  interface TableRearrangeColumnsProps {
    onDragStart: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
  }

  // DODO added 45525377
  interface ColumnDodoProps {
    colWidths: number[];
  }

  export interface ColumnInterface<D extends object>
    extends UseGlobalFiltersColumnOptions<D>,
      UseSortByColumnOptions<D> {
    // must define as a new property because it's not possible to override
    // the existing `Header` renderer option
    Header?: Renderer<
      TableSortByToggleProps &
        HeaderProps<D> &
        TableRearrangeColumnsProps &
        ColumnDodoProps // DODO added 45525377
    >;
    Footer?: Renderer<TableFooterProps<D>>;
  }

  export interface ColumnInstance<D extends object>
    extends UseGlobalFiltersColumnOptions<D>,
      UseSortByColumnProps<D> {
    getSortByToggleProps: (
      props?: Partial<TableSortByToggleProps>,
    ) => TableSortByToggleProps;
  }

  export interface Hooks<D extends object>
    extends UseTableHooks<D>,
      UseSortByHooks<D> {}
}
