import {
  GroupEncodeEntry,
  GuideEncodeEntry,
  RuleEncodeEntry,
  SignalRef,
  TextEncodeEntry,
  TimeInterval,
} from '.';
import { Text } from './encode';
import { TimeIntervalStep } from './scale';
import {
  AlignValue,
  AnchorValue,
  BooleanValue,
  ColorValue,
  DashArrayValue,
  FontStyleValue,
  FontWeightValue,
  NumberValue,
  StringValue,
  StrokeCapValue,
  TextBaselineValue,
} from './values';

export type AxisOrient = 'top' | 'bottom' | 'left' | 'right';

export type LabelOverlap = boolean | 'parity' | 'greedy';

export type TickCount = number | TimeInterval | TimeIntervalStep | SignalRef;

export type FormatType = 'number' | 'time' | 'utc';

export interface TimeFormatSpecifier {
  year?: string;
  quarter?: string;
  month?: string;
  date?: string;
  week?: string;
  day?: string;
  hours?: string;
  minutes?: string;
  seconds?: string;
  milliseconds?: string;
}

export interface Axis extends BaseAxis {
  /**
   * The orientation of the axis. One of `"top"`, `"bottom"`, `"left"` or `"right"`. The orientation can be used to further specialize the axis type (e.g., a y axis oriented for the right edge of the chart).
   *
   * __Default value:__ `"bottom"` for x-axes and `"left"` for y-axes.
   */
  orient: AxisOrient | SignalRef;

  /**
   * The name of the scale backing the axis component.
   */
  scale: string;

  /**
   * The name of the scale to use for including grid lines. By default grid lines are driven by the same scale as the ticks and labels.
   */
  gridScale?: string;

  /**
   * The format specifier pattern for axis labels. For numerical values, must be a legal [d3-format](https://github.com/d3/d3-format#locale_format) specifier. For date-time values, must be a legal [d3-time-format](https://github.com/d3/d3-time-format#locale_format) specifier or multi-format object.
   */
  format?: string | TimeFormatSpecifier | SignalRef;

  /**
   * The format type for axis labels (number, time, or utc).
   */
  formatType?: FormatType | SignalRef;

  /**
   * A title for the axis (none by default).
   */
  title?: Text | SignalRef;

  /**
   * The orthogonal offset in pixels by which to displace the axis from its position along the edge of the chart.
   */
  offset?: NumberValue;

  /**
   * The anchor position of the axis in pixels. For x-axes with top or bottom orientation, this sets the axis group x coordinate. For y-axes with left or right orientation, this sets the axis group y coordinate.
   *
   * __Default value__: `0`
   */
  position?: NumberValue;

  /**
   * A desired number of ticks, for axes visualizing quantitative scales. The resulting number may be different so that values are "nice" (multiples of `2`, `5`, `10`) and lie within the underlying scale's range.
   *
   * For scales of type `"time"` or `"utc"`, the tick count can instead be a time interval specifier. Legal string values are `"millisecond"`, `"second"`, `"minute"`, `"hour"`, `"day"`, `"week"`, `"month"`, and "year". Alternatively, an object-valued interval specifier of the form `{"interval": "month", "step": 3}` includes a desired number of interval steps. Here, ticks are generated for each quarter (Jan, Apr, Jul, Oct) boundary.
   *
   * @minimum 0
   */
  tickCount?: TickCount;

  /**
   * The minimum desired step between axis ticks, in terms of scale domain values. For example, a value of `1` indicates that ticks should not be less than 1 unit apart. If `tickMinStep` is specified, the `tickCount` value will be adjusted, if necessary, to enforce the minimum step value.
   */
  tickMinStep?: number | SignalRef;

  /**
   * Explicitly set the visible axis tick and label values.
   */
  values?: any[] | SignalRef;

  /**
   * Mark definitions for custom axis encoding.
   */
  encode?: AxisEncode;
}

export interface AxisEncode {
  /**
   * Custom encoding for the axis container.
   */
  axis?: GuideEncodeEntry<GroupEncodeEntry>;
  /**
   * Custom encoding for axis tick rule marks.
   */
  ticks?: GuideEncodeEntry<GroupEncodeEntry>;
  /**
   * Custom encoding for axis label text marks.
   */
  labels?: GuideEncodeEntry<TextEncodeEntry>;
  /**
   * Custom encoding for the axis title text mark.
   */
  title?: GuideEncodeEntry<TextEncodeEntry>;
  /**
   * Custom encoding for axis gridline rule marks.
   */
  grid?: GuideEncodeEntry<RuleEncodeEntry>;
  /**
   * Custom encoding for the axis domain rule mark.
   */
  domain?: GuideEncodeEntry<RuleEncodeEntry>;
}

export interface BaseAxis {
  /**
   * Coordinate space translation offset for axis layout. By default, axes are translated by a 0.5 pixel offset for both the x and y coordinates in order to align stroked lines with the pixel grid. However, for vector graphics output these pixel-specific adjustments may be undesirable, in which case translate can be changed (for example, to zero).
   *
   * __Default value:__ `0.5`
   */
  translate?: NumberValue;

  /**
   * The minimum extent in pixels that axis ticks and labels should use. This determines a minimum offset value for axis titles.
   *
   * __Default value:__ `30` for y-axis; `undefined` for x-axis.
   */
  minExtent?: NumberValue;

  /**
   * The maximum extent in pixels that axis ticks and labels should use. This determines a maximum offset value for axis titles.
   *
   * __Default value:__ `undefined`.
   */
  maxExtent?: NumberValue;

  /**
   * An interpolation fraction indicating where, for `band` scales, axis ticks should be positioned. A value of `0` places ticks at the left edge of their bands. A value of `0.5` places ticks in the middle of their bands.
   *
   *  __Default value:__ `0.5`
   */
  bandPosition?: NumberValue;

  // ---------- ARIA ----------
  /**
   * A boolean flag indicating if [ARIA attributes](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) should be included (SVG output only).
   * If `false`, the "aria-hidden" attribute will be set on the output SVG group, removing the axis from the ARIA accessibility tree.
   *
   * __Default value:__ `true`
   */
  aria?: boolean;

  /**
   * A text description of this axis for [ARIA accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) (SVG output only).
   * If the `aria` property is true, for SVG output the ["aria-label" attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-label_attribute) will be set to this description.
   * If the description is unspecified it will be automatically generated.
   */
  description?: string;

  // ---------- Title ----------
  /**
   * The padding, in pixels, between title and axis.
   */
  titlePadding?: NumberValue;

  /**
   * Horizontal text alignment of axis titles.
   */
  titleAlign?: AlignValue;

  /**
   * Text anchor position for placing axis titles.
   */
  titleAnchor?: AnchorValue;

  /**
   * Angle in degrees of axis titles.
   */
  titleAngle?: NumberValue;

  /**
   * X-coordinate of the axis title relative to the axis group.
   */
  titleX?: NumberValue;

  /**
   * Y-coordinate of the axis title relative to the axis group.
   */
  titleY?: NumberValue;

  /**
   * Vertical text baseline for axis titles. One of `"alphabetic"` (default), `"top"`, `"middle"`, `"bottom"`, `"line-top"`, or `"line-bottom"`. The `"line-top"` and `"line-bottom"` values operate similarly to `"top"` and `"bottom"`, but are calculated relative to the *lineHeight* rather than *fontSize* alone.
   */
  titleBaseline?: TextBaselineValue;

  /**
   * Color of the title, can be in hex color code or regular color name.
   */
  titleColor?: ColorValue;

  /**
   * Font of the title. (e.g., `"Helvetica Neue"`).
   */
  titleFont?: StringValue;

  /**
   * Font size of the title.
   *
   * @minimum 0
   */
  titleFontSize?: NumberValue;

  /**
   * Font style of the title.
   */
  titleFontStyle?: FontStyleValue;

  /**
   * Font weight of the title.
   * This can be either a string (e.g `"bold"`, `"normal"`) or a number (`100`, `200`, `300`, ..., `900` where `"normal"` = `400` and `"bold"` = `700`).
   */
  titleFontWeight?: FontWeightValue;

  /**
   * Maximum allowed pixel width of axis titles.
   *
   * @minimum 0
   */
  titleLimit?: NumberValue;

  /**
   * Line height in pixels for multi-line title text or title text with `"line-top"` or `"line-bottom"` baseline.
   */
  titleLineHeight?: NumberValue;

  /**
   * Opacity of the axis title.
   */
  titleOpacity?: NumberValue;

  // ---------- Domain ----------
  /**
   * A boolean flag indicating if the domain (the axis baseline) should be included as part of the axis.
   *
   * __Default value:__ `true`
   */
  domain?: boolean;

  /**
   * The stroke cap for the domain line's ending style. One of `"butt"`, `"round"` or `"square"`.
   *
   * __Default value:__ `"butt"`
   */
  domainCap?: StrokeCapValue;

  /**
   * An array of alternating [stroke, space] lengths for dashed domain lines.
   */
  domainDash?: DashArrayValue;

  /**
   * The pixel offset at which to start drawing with the domain dash array.
   */
  domainDashOffset?: NumberValue;

  /**
   * Color of axis domain line.
   *
   * __Default value:__ `"gray"`.
   */
  domainColor?: ColorValue;

  /**
   * Opacity of the axis domain line.
   */
  domainOpacity?: NumberValue;

  /**
   * Stroke width of axis domain line
   *
   * __Default value:__ `1`
   */
  domainWidth?: NumberValue;

  // ---------- Ticks ----------
  /**
   * Boolean value that determines whether the axis should include ticks.
   *
   * __Default value:__ `true`
   */
  ticks?: BooleanValue;

  /**
   * For band scales, indicates if ticks and grid lines should be placed at the `"center"` of a band (default) or at the band `"extent"`s to indicate intervals
   */
  tickBand?: 'center' | 'extent' | SignalRef;

  /**
   * The stroke cap for the tick lines' ending style. One of `"butt"`, `"round"` or `"square"`.
   *
   * __Default value:__ `"butt"`
   */

  tickCap?: StrokeCapValue;

  /**
   * The color of the axis's tick.
   *
   * __Default value:__ `"gray"`
   */
  tickColor?: ColorValue;

  /**
   * An array of alternating [stroke, space] lengths for dashed tick mark lines.
   */
  tickDash?: DashArrayValue;

  /**
   * The pixel offset at which to start drawing with the tick mark dash array.
   */
  tickDashOffset?: NumberValue;

  /**
   * Boolean flag indicating if an extra axis tick should be added for the initial position of the axis. This flag is useful for styling axes for `band` scales such that ticks are placed on band boundaries rather in the middle of a band. Use in conjunction with `"bandPosition": 1` and an axis `"padding"` value of `0`.
   */
  tickExtra?: BooleanValue;

  /**
   * Position offset in pixels to apply to ticks, labels, and gridlines.
   */
  tickOffset?: NumberValue;

  /**
   * Opacity of the ticks.
   */
  tickOpacity?: NumberValue;

  /**
   * Boolean flag indicating if pixel position values should be rounded to the nearest integer.
   *
   * __Default value:__ `true`
   */
  tickRound?: BooleanValue;

  /**
   * The size in pixels of axis ticks.
   *
   * __Default value:__ `5`
   * @minimum 0
   */
  tickSize?: NumberValue;

  /**
   * The width, in pixels, of ticks.
   *
   * __Default value:__ `1`
   * @minimum 0
   */
  tickWidth?: NumberValue;

  // ---------- Grid ----------
  /**
   * A boolean flag indicating if grid lines should be included as part of the axis.
   */
  grid?: boolean;

  /**
   * The stroke cap for grid lines' ending style. One of `"butt"`, `"round"` or `"square"`.
   *
   * __Default value:__ `"butt"`
   */
  gridCap?: StrokeCapValue;

  /**
   * Color of gridlines.
   *
   * __Default value:__ `"lightGray"`.
   */
  gridColor?: ColorValue;

  /**
   * An array of alternating [stroke, space] lengths for dashed grid lines.
   */
  gridDash?: DashArrayValue;

  /**
   * The pixel offset at which to start drawing with the grid dash array.
   */
  gridDashOffset?: NumberValue;

  /**
   * The stroke opacity of grid (value between [0,1])
   *
   * __Default value:__ `1`
   * @minimum 0
   * @maximum 1
   */
  gridOpacity?: NumberValue;

  /**
   * The grid width, in pixels.
   *
   * __Default value:__ `1`
   * @minimum 0
   */
  gridWidth?: NumberValue;

  // ---------- Labels ----------
  /**
   * A boolean flag indicating if labels should be included as part of the axis.
   *
   * __Default value:__ `true`.
   */
  labels?: boolean;

  /**
   * Horizontal text alignment of axis tick labels, overriding the default setting for the current axis orientation.
   */
  labelAlign?: AlignValue;

  /**
   * Vertical text baseline of axis tick labels, overriding the default setting for the current axis orientation.
   * One of `"alphabetic"` (default), `"top"`, `"middle"`, `"bottom"`, `"line-top"`, or `"line-bottom"`. The `"line-top"` and `"line-bottom"` values operate similarly to `"top"` and `"bottom"`, but are calculated relative to the *lineHeight* rather than *fontSize* alone.
   */
  labelBaseline?: TextBaselineValue;

  /**
   * Indicates if labels should be hidden if they exceed the axis range. If `false` (the default) no bounds overlap analysis is performed. If `true`, labels will be hidden if they exceed the axis range by more than 1 pixel. If this property is a number, it specifies the pixel tolerance: the maximum amount by which a label bounding box may exceed the axis range.
   *
   * __Default value:__ `false`.
   */
  labelBound?: number | boolean | SignalRef;

  /**
   * Indicates if the first and last axis labels should be aligned flush with the scale range. Flush alignment for a horizontal axis will left-align the first label and right-align the last label. For vertical axes, bottom and top text baselines are applied instead. If this property is a number, it also indicates the number of pixels by which to offset the first and last labels; for example, a value of 2 will flush-align the first and last labels and also push them 2 pixels outward from the center of the axis. The additional adjustment can sometimes help the labels better visually group with corresponding axis ticks.
   */
  labelFlush?: number | boolean | SignalRef;

  /**
   * Indicates the number of pixels by which to offset flush-adjusted labels. For example, a value of `2` will push flush-adjusted labels 2 pixels outward from the center of the axis. Offsets can help the labels better visually group with corresponding axis ticks.
   *
   * __Default value:__ `0`.
   */
  labelFlushOffset?: number | SignalRef;

  /**
   * Line height in pixels for multi-line label text or label text with `"line-top"` or `"line-bottom"` baseline.
   */
  labelLineHeight?: NumberValue;

  /**
   * The strategy to use for resolving overlap of axis labels. If `false` (the default), no overlap reduction is attempted. If set to `true` or `"parity"`, a strategy of removing every other label is used (this works well for standard linear axes). If set to `"greedy"`, a linear scan of the labels is performed, removing any labels that overlaps with the last visible label (this often works better for log-scaled axes).
   */
  labelOverlap?: LabelOverlap | SignalRef;

  /**
   * The minimum separation that must be between label bounding boxes for them to be considered non-overlapping (default `0`). This property is ignored if *labelOverlap* resolution is not enabled.
   */
  labelSeparation?: number | SignalRef;

  /**
   * The rotation angle of the axis labels.
   *
   * __Default value:__ `-90` for nominal and ordinal fields; `0` otherwise.
   *
   * @minimum -360
   * @maximum 360
   */
  labelAngle?: NumberValue;

  /**
   * The color of the tick label, can be in hex color code or regular color name.
   */
  labelColor?: ColorValue;

  /**
   * The font of the tick label.
   */
  labelFont?: StringValue;

  /**
   * The font size of the label, in pixels.
   *
   * @minimum 0
   */
  labelFontSize?: NumberValue;

  /**
   * Font style of the title.
   */
  labelFontStyle?: FontStyleValue;

  /**
   * Font weight of axis tick labels.
   */
  labelFontWeight?: FontWeightValue;

  /**
   * Maximum allowed pixel width of axis tick labels.
   *
   * __Default value:__ `180`
   */
  labelLimit?: NumberValue;

  /**
   * The opacity of the labels.
   */
  labelOpacity?: NumberValue;

  /**
   * Position offset in pixels to apply to labels, in addition to tickOffset.
   *
   * __Default value:__ `0`
   */
  labelOffset?: NumberValue;

  /**
   * The padding in pixels between labels and ticks.
   *
   * __Default value:__ `2`
   */
  labelPadding?: NumberValue;

  /**
   * The integer z-index indicating the layering of the axis group relative to other axis, mark, and legend groups.
   *
   * @TJS-type integer
   * @minimum 0
   */
  zindex?: number;
}
