/** See https://vega.github.io/vega-lite/docs/axis.html */

import { DateTime } from 'vega-lite/build/src/datetime';

export type AxisOrient = 'top' | 'bottom' | 'left' | 'right';

export type LabelOverlapStrategy = 'auto' | 'flat' | 'rotate';

export interface CoreAxis {
  format?: string;
  labelAngle: number;
  /**
   * Indicates if the first and last axis labels should be aligned flush with the scale range.
   * Flush alignment for a horizontal axis will left-align the first label and right-align the last label.
   * For vertical axes, bottom and top text baselines are applied instead.
   * If this property is a number, it also indicates the number of pixels by which to offset the first and last labels;
   * for example, a value of 2 will flush-align the first and last labels
   * and also push them 2 pixels outward from the center of the axis.
   * The additional adjustment can sometimes help the labels better visually group with corresponding axis ticks. */
  labelFlush?: boolean | number;
  labelOverlap: LabelOverlapStrategy;
  /** The padding, in pixels, between axis and text labels. */
  labelPadding: number;
  orient: AxisOrient;
  tickCount: number;
  title?: string | boolean;
  /** Explicitly set the visible axis tick values. */
  values?: string[] | number[] | boolean[] | DateTime[];
}

export type Axis = Partial<CoreAxis>;

export interface XAxis extends Axis {
  orient?: 'top' | 'bottom';
  labelAngle?: number;
  labelOverlap?: LabelOverlapStrategy;
}

export interface WithXAxis {
  axis?: XAxis | boolean;
}

export interface YAxis extends Axis {
  orient?: 'left' | 'right';
  labelAngle?: 0;
  labelOverlap?: 'auto' | 'flat';
}

export interface WithYAxis {
  axis?: YAxis;
}

export interface WithAxis {
  axis?: XAxis | YAxis;
}

export function isAxis(axis: Axis | null | undefined | false): axis is Axis {
  return axis !== false && axis !== null && axis !== undefined;
}
