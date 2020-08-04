import { SignalRef } from '.';

export type LayoutAlign = 'all' | 'each' | 'none';
export type LayoutTitleAnchor = 'start' | 'end';
export type LayoutBounds = 'full' | 'flush' | SignalRef;
export type LayoutOffset =
  | number
  | SignalRef
  | {
      rowHeader?: number | SignalRef;
      rowFooter?: number | SignalRef;
      rowTitle?: number | SignalRef;
      columnHeader?: number | SignalRef;
      columnFooter?: number | SignalRef;
      columnTitle?: number | SignalRef;
    };

export interface RowColumn<T> {
  row?: T | SignalRef;
  column?: T | SignalRef;
}

export interface LayoutParams {
  align?: LayoutAlign | SignalRef | RowColumn<LayoutAlign>;
  bounds?: LayoutBounds;
  columns?: number | SignalRef;
  padding?: number | SignalRef | RowColumn<number>;
  offset?: LayoutOffset;

  headerBand?: number | SignalRef | RowColumn<number>;
  footerBand?: number | SignalRef | RowColumn<number>;

  titleAnchor?: LayoutTitleAnchor | SignalRef | RowColumn<LayoutTitleAnchor>;
  titleBand?: number | SignalRef | RowColumn<number>;
}

export type Layout = SignalRef | LayoutParams;
