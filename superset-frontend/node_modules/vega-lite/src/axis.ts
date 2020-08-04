import {
  Align,
  Axis as VgAxis,
  AxisEncode,
  AxisOrient,
  BaseAxis,
  Color,
  FontStyle,
  FontWeight,
  LabelOverlap,
  TextBaseline
} from 'vega';
import {ConditionalPredicate, Value, ValueDef} from './channeldef';
import {DateTime} from './datetime';
import {Guide, GuideEncodingEntry, VlOnlyGuideConfig} from './guide';
import {Flag, keys} from './util';
import {ExcludeMappedValueRef, VgEncodeChannel} from './vega.schema';

export type BaseAxisNoValueRefs = AxisMixins & ExcludeMappedValueRef<BaseAxis>;

interface AxisMixins {
  // Override comments to be Vega-Lite specific
  /**
   * A boolean flag indicating if grid lines should be included as part of the axis
   *
   * __Default value:__ `true` for [continuous scales](https://vega.github.io/vega-lite/docs/scale.html#continuous) that are not binned; otherwise, `false`.
   */
  grid?: boolean;

  /**
   * Indicates if the first and last axis labels should be aligned flush with the scale range. Flush alignment for a horizontal axis will left-align the first label and right-align the last label. For vertical axes, bottom and top text baselines are applied instead. If this property is a number, it also indicates the number of pixels by which to offset the first and last labels; for example, a value of 2 will flush-align the first and last labels and also push them 2 pixels outward from the center of the axis. The additional adjustment can sometimes help the labels better visually group with corresponding axis ticks.
   *
   * __Default value:__ `true` for axis of a continuous x-scale. Otherwise, `false`.
   */
  labelFlush?: boolean | number;

  /**
   * The strategy to use for resolving overlap of axis labels. If `false` (the default), no overlap reduction is attempted. If set to `true` or `"parity"`, a strategy of removing every other label is used (this works well for standard linear axes). If set to `"greedy"`, a linear scan of the labels is performed, removing any labels that overlaps with the last visible label (this often works better for log-scaled axes).
   *
   * __Default value:__ `true` for non-nominal fields with non-log scales; `"greedy"` for log scales; otherwise `false`.
   */
  labelOverlap?: LabelOverlap;

  /**
   * The offset, in pixels, by which to displace the axis from the edge of the enclosing group or data rectangle.
   *
   * __Default value:__ derived from the [axis config](https://vega.github.io/vega-lite/docs/config.html#facet-scale-config)'s `offset` (`0` by default)
   */
  offset?: number;

  /**
   * The orientation of the axis. One of `"top"`, `"bottom"`, `"left"` or `"right"`. The orientation can be used to further specialize the axis type (e.g., a y-axis oriented towards the right edge of the chart).
   *
   * __Default value:__ `"bottom"` for x-axes and `"left"` for y-axes.
   */
  orient?: AxisOrient;
}

export type ConditionalAxisProp =
  | 'labelAlign'
  | 'labelBaseline'
  | 'labelColor'
  | 'labelFont'
  | 'labelFontSize'
  | 'labelFontStyle'
  | 'labelFontWeight'
  | 'labelOpacity'
  | 'labelPadding'
  | 'gridColor'
  | 'gridDash'
  | 'gridDashOffset'
  | 'gridOpacity'
  | 'gridWidth'
  | 'tickColor'
  | 'tickDash'
  | 'tickDashOffset'
  | 'tickOpacity'
  | 'tickSize'
  | 'tickWidth';

export const CONDITIONAL_AXIS_PROP_INDEX: {
  [prop in keyof BaseAxisNoValueRefs | ConditionalAxisProp]?: {
    part: keyof AxisEncode;
    vgProp: VgEncodeChannel;
  } | null; // null if we need to convert condition to signal
} = {
  labelAlign: {
    part: 'labels',
    vgProp: 'align'
  },
  labelBaseline: {
    part: 'labels',
    vgProp: 'baseline'
  },
  labelColor: {
    part: 'labels',
    vgProp: 'fill'
  },
  labelFont: {
    part: 'labels',
    vgProp: 'font'
  },
  labelFontSize: {
    part: 'labels',
    vgProp: 'fontSize'
  },
  labelFontStyle: {
    part: 'labels',
    vgProp: 'fontStyle'
  },
  labelFontWeight: {
    part: 'labels',
    vgProp: 'fontWeight'
  },
  labelOpacity: {
    part: 'labels',
    vgProp: 'opacity'
  },
  labelPadding: null, // There is no fixed vgProp for tickSize, need to use signal.
  gridColor: {
    part: 'grid',
    vgProp: 'stroke'
  },
  gridDash: {
    part: 'grid',
    vgProp: 'strokeDash'
  },
  gridDashOffset: {
    part: 'grid',
    vgProp: 'strokeDash'
  },
  gridOpacity: {
    part: 'grid',
    vgProp: 'opacity'
  },
  gridWidth: {
    part: 'grid',
    vgProp: 'strokeWidth'
  },
  tickColor: {
    part: 'ticks',
    vgProp: 'stroke'
  },
  tickDash: {
    part: 'ticks',
    vgProp: 'strokeDash'
  },
  tickDashOffset: {
    part: 'ticks',
    vgProp: 'strokeDash'
  },
  tickOpacity: {
    part: 'ticks',
    vgProp: 'opacity'
  },
  tickSize: null, // There is no fixed vgProp for tickSize, need to use signal.
  tickWidth: {
    part: 'ticks',
    vgProp: 'strokeWidth'
  }
};

export type ConditionalAxisProperty<V extends Value | number[]> = ValueDef<V> & {
  condition: ConditionalPredicate<ValueDef<V>> | ConditionalPredicate<ValueDef<V>>[];
};

export function isConditionalAxisValue<V extends Value | number[]>(v: any): v is ConditionalAxisProperty<V> {
  return v && v['condition'];
}

export type ConditionalAxisNumber = ConditionalAxisProperty<number | null>;
export type ConditionalAxisLabelAlign = ConditionalAxisProperty<Align | null>;
export type ConditionalAxisLabelBaseline = ConditionalAxisProperty<TextBaseline | null>;
export type ConditionalAxisColor = ConditionalAxisProperty<Color | null>;
export type ConditionalAxisString = ConditionalAxisProperty<string | null>;

export type ConditionalAxisLabelFontStyle = ConditionalAxisProperty<FontStyle | null>;
export type ConditionalAxisLabelFontWeight = ConditionalAxisProperty<FontWeight | null>;

export type ConditionalAxisNumberArray = ConditionalAxisProperty<number[] | null>;

// Vega axis config is the same as Vega axis base. If this is not the case, add specific type.
export type AxisConfigBaseWithConditional = Omit<BaseAxisNoValueRefs, ConditionalAxisProp> & {
  // The manual definition below is basically, but we have to do this manually to generate a nice schema
  // [k in ConditionalAxisProp]?: BaseAxisNoSignals[k] | ConditionalAxisProperty<BaseAxisNoSignals[k] | null>;

  labelAlign?: BaseAxisNoValueRefs['labelAlign'] | ConditionalAxisLabelAlign;
  labelBaseline?: BaseAxisNoValueRefs['labelBaseline'] | ConditionalAxisLabelBaseline;
  labelColor?: BaseAxisNoValueRefs['labelColor'] | ConditionalAxisColor;
  labelFont?: BaseAxisNoValueRefs['labelFont'] | ConditionalAxisString;
  labelFontSize?: BaseAxisNoValueRefs['labelFontSize'] | ConditionalAxisNumber;
  labelFontStyle?: BaseAxisNoValueRefs['labelFontStyle'] | ConditionalAxisLabelFontStyle;
  labelFontWeight?: BaseAxisNoValueRefs['labelFontWeight'] | ConditionalAxisLabelFontWeight;
  labelOpacity?: BaseAxisNoValueRefs['labelOpacity'] | ConditionalAxisNumber;
  labelPadding?: BaseAxisNoValueRefs['labelPadding'] | ConditionalAxisNumber;
  gridColor?: BaseAxisNoValueRefs['gridColor'] | ConditionalAxisColor;
  gridDash?: BaseAxisNoValueRefs['gridDash'] | ConditionalAxisNumberArray;
  gridDashOffset?: BaseAxisNoValueRefs['gridDashOffset'] | ConditionalAxisNumber;
  gridOpacity?: BaseAxisNoValueRefs['gridOpacity'] | ConditionalAxisNumber;
  gridWidth?: BaseAxisNoValueRefs['gridWidth'] | ConditionalAxisNumber;
  tickColor?: BaseAxisNoValueRefs['tickColor'] | ConditionalAxisColor;
  tickDash?: BaseAxisNoValueRefs['tickDash'] | ConditionalAxisNumberArray;
  tickDashOffset?: BaseAxisNoValueRefs['tickDashOffset'] | ConditionalAxisNumber;
  tickOpacity?: BaseAxisNoValueRefs['tickOpacity'] | ConditionalAxisNumber;
  tickSize?: BaseAxisNoValueRefs['tickSize'] | ConditionalAxisNumber;
  tickWidth?: BaseAxisNoValueRefs['tickWidth'] | ConditionalAxisNumber;
};

export type AxisConfig = VlOnlyGuideConfig & AxisConfigBaseWithConditional;

export interface Axis extends AxisConfigBaseWithConditional, Guide {
  // override properties that are Axis only (not Axis Config)

  /**
   * [Vega expression](https://vega.github.io/vega/docs/expressions/) for customizing labels.
   *
   * __Note:__ The label text and value can be assessed via the `label` and `value` properties of the axis's backing `datum` object.
   */
  labelExpr?: string;

  /**
   * The anchor position of the axis in pixels. For x-axes with top or bottom orientation, this sets the axis group x coordinate. For y-axes with left or right orientation, this sets the axis group y coordinate.
   *
   * __Default value__: `0`
   */
  position?: number;

  /**
   * A desired number of ticks, for axes visualizing quantitative scales. The resulting number may be different so that values are "nice" (multiples of 2, 5, 10) and lie within the underlying scale's range.
   *
   * __Default value__: Determine using a formula `ceil(width/40)` for x and `ceil(height/40)` for y.
   *
   * @minimum 0
   */
  tickCount?: number;

  /**
   * The minimum desired step between axis ticks, in terms of scale domain values. For example, a value of `1` indicates that ticks should not be less than 1 unit apart. If `tickMinStep` is specified, the `tickCount` value will be adjusted, if necessary, to enforce the minimum step value.
   *
   * __Default value__: `undefined`
   */
  tickMinStep?: number;

  /**
   * Explicitly set the visible axis tick values.
   */
  values?: number[] | string[] | boolean[] | DateTime[];

  /**
   * A non-negative integer indicating the z-index of the axis.
   * If zindex is 0, axes should be drawn behind all chart elements.
   * To put them in front, set `zindex` to `1` or more.
   *
   * __Default value:__ `0` (behind the marks).
   *
   * @TJS-type integer
   * @minimum 0
   */
  zindex?: number;

  /**
   * Mark definitions for custom axis encoding.
   *
   * @hidden
   */
  encoding?: AxisEncoding;
}

export type AxisPart = keyof AxisEncoding;
export const AXIS_PARTS: AxisPart[] = ['domain', 'grid', 'labels', 'ticks', 'title'];

/**
 * A dictionary listing whether a certain axis property is applicable for only main axes or only grid axes.
 * (Properties not listed are applicable for both)
 */
export const AXIS_PROPERTY_TYPE: {
  // Using Mapped Type to declare type (https://www.typescriptlang.org/docs/handbook/advanced-types.html#mapped-types)
  [k in keyof VgAxis]: 'main' | 'grid' | 'both';
} = {
  grid: 'grid',
  gridColor: 'grid',
  gridDash: 'grid',
  gridOpacity: 'grid',
  gridScale: 'grid',
  gridWidth: 'grid',

  orient: 'main',

  bandPosition: 'both', // Need to be applied to grid axis too, so the grid will align with ticks.
  domain: 'main',
  domainColor: 'main',
  domainOpacity: 'main',
  domainWidth: 'main',
  format: 'main',
  formatType: 'main',
  labelAlign: 'main',
  labelAngle: 'main',
  labelBaseline: 'main',
  labelBound: 'main',
  labelColor: 'main',
  labelFlush: 'main',
  labelFlushOffset: 'main',
  labelFont: 'main',
  labelFontSize: 'main',
  labelFontWeight: 'main',
  labelLimit: 'main',
  labelOpacity: 'main',
  labelOverlap: 'main',
  labelPadding: 'main',
  labels: 'main',
  maxExtent: 'main',
  minExtent: 'main',
  offset: 'both',
  position: 'main',
  tickColor: 'main',
  tickExtra: 'main',
  tickOffset: 'both', // Need to be applied to grid axis too, so the grid will align with ticks.
  tickOpacity: 'main',
  tickRound: 'main',
  ticks: 'main',
  tickSize: 'main',
  title: 'main',
  titleAlign: 'main',
  titleAngle: 'main',
  titleBaseline: 'main',
  titleColor: 'main',
  titleFont: 'main',
  titleFontSize: 'main',
  titleFontWeight: 'main',
  titleLimit: 'main',
  titleLineHeight: 'main',
  titleOpacity: 'main',
  titlePadding: 'main',
  titleX: 'main',
  titleY: 'main',

  tickWidth: 'both',
  tickCount: 'both',
  values: 'both',
  scale: 'both',
  zindex: 'both' // this is actually set afterward, so it doesn't matter
};

export interface AxisEncoding {
  /**
   * Custom encoding for the axis container.
   */
  axis?: GuideEncodingEntry;

  /**
   * Custom encoding for the axis domain rule mark.
   */
  domain?: GuideEncodingEntry;

  /**
   * Custom encoding for axis gridline rule marks.
   */
  grid?: GuideEncodingEntry;

  /**
   * Custom encoding for axis label text marks.
   */
  labels?: GuideEncodingEntry;

  /**
   * Custom encoding for axis tick rule marks.
   */
  ticks?: GuideEncodingEntry;

  /**
   * Custom encoding for the axis title text mark.
   */
  title?: GuideEncodingEntry;
}

export const COMMON_AXIS_PROPERTIES_INDEX: Flag<keyof (VgAxis | Axis)> = {
  orient: 1, // other things can depend on orient

  bandPosition: 1,
  domain: 1,
  domainColor: 1,
  domainDash: 1,
  domainDashOffset: 1,
  domainOpacity: 1,
  domainWidth: 1,
  format: 1,
  formatType: 1,
  grid: 1,
  gridColor: 1,
  gridDash: 1,
  gridDashOffset: 1,
  gridOpacity: 1,
  gridWidth: 1,
  labelAlign: 1,
  labelAngle: 1,
  labelBaseline: 1,
  labelBound: 1,
  labelColor: 1,
  labelFlush: 1,
  labelFlushOffset: 1,
  labelFont: 1,
  labelFontSize: 1,
  labelFontStyle: 1,
  labelFontWeight: 1,
  labelLimit: 1,
  labelOpacity: 1,
  labelOverlap: 1,
  labelPadding: 1,
  labels: 1,
  labelSeparation: 1,
  maxExtent: 1,
  minExtent: 1,
  offset: 1,
  position: 1,
  tickBand: 1,
  tickColor: 1,
  tickCount: 1,
  tickDash: 1,
  tickDashOffset: 1,
  tickExtra: 1,
  tickMinStep: 1,
  tickOffset: 1,
  tickOpacity: 1,
  tickRound: 1,
  ticks: 1,
  tickSize: 1,
  tickWidth: 1,
  title: 1,
  titleAlign: 1,
  titleAnchor: 1,
  titleAngle: 1,
  titleBaseline: 1,
  titleColor: 1,
  titleFont: 1,
  titleFontSize: 1,
  titleFontStyle: 1,
  titleFontWeight: 1,
  titleLimit: 1,
  titleLineHeight: 1,
  titleOpacity: 1,
  titlePadding: 1,
  titleX: 1,
  titleY: 1,
  values: 1,
  translate: 1,
  zindex: 1
};

const AXIS_PROPERTIES_INDEX: Flag<keyof Axis> = {
  ...COMMON_AXIS_PROPERTIES_INDEX,
  labelExpr: 1,
  encoding: 1
};

export function isAxisProperty(prop: string): prop is keyof Axis {
  return !!AXIS_PROPERTIES_INDEX[prop];
}

// Export for dependent projects
export const AXIS_PROPERTIES = keys(AXIS_PROPERTIES_INDEX);

export interface AxisConfigMixins {
  /**
   * Axis configuration, which determines default properties for all `x` and `y` [axes](https://vega.github.io/vega-lite/docs/axis.html). For a full list of axis configuration options, please see the [corresponding section of the axis documentation](https://vega.github.io/vega-lite/docs/axis.html#config).
   */
  axis?: AxisConfig;

  /**
   * X-axis specific config.
   */
  axisX?: AxisConfig;

  /**
   * Y-axis specific config.
   */
  axisY?: AxisConfig;

  /**
   * Specific axis config for y-axis along the left edge of the chart.
   */
  axisLeft?: AxisConfig;

  /**
   * Specific axis config for y-axis along the right edge of the chart.
   */
  axisRight?: AxisConfig;

  /**
   * Specific axis config for x-axis along the top edge of the chart.
   */
  axisTop?: AxisConfig;

  /**
   * Specific axis config for x-axis along the bottom edge of the chart.
   */
  axisBottom?: AxisConfig;

  /**
   * Specific axis config for axes with "band" scales.
   */
  axisBand?: AxisConfig;
}
