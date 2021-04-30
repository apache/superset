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
  Renderer,
  HeaderProps,
  TableFooterProps,
} from 'react-table';

import { UseStickyState, UseStickyTableOptions, UseStickyInstanceProps } from '../hooks/useSticky';

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
      UseStickyInstanceProps {}

  export interface TableState<D extends object>
    extends UseColumnOrderState<D>,
      UseExpandedState<D>,
      UseGlobalFiltersState<D>,
      UsePaginationState<D>,
      UseRowSelectState<D>,
      UseSortByState<D>,
      UseStickyState {}

  // Typing from @types/react-table is incomplete
  interface TableSortByToggleProps {
    style?: React.CSSProperties;
    title?: string;
    onClick?: React.MouseEventHandler;
  }

  export interface ColumnInterface<D extends object>
    extends UseGlobalFiltersColumnOptions<D>,
      UseSortByColumnOptions<D> {
    // must define as a new property because it's not possible to override
    // the existing `Header` renderer option
    Header?: Renderer<TableSortByToggleProps & HeaderProps<D>>;
    Footer?: Renderer<TableFooterProps<D>>;
  }

  export interface ColumnInstance<D extends object>
    extends UseGlobalFiltersColumnOptions<D>,
      UseSortByColumnProps<D> {
    getSortByToggleProps: (props?: Partial<TableSortByToggleProps>) => TableSortByToggleProps;
  }

  export interface Hooks<D extends object> extends UseTableHooks<D>, UseSortByHooks<D> {}
}
