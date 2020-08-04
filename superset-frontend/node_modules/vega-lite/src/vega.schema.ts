import {
  AggregateOp,
  Align,
  Color,
  ColorValueRef,
  Compare as VgCompare,
  Cursor,
  ExprRef as VgExprRef,
  Field as VgField,
  FontStyle as VgFontStyle,
  FontWeight as VgFontWeight,
  GeoShapeTransform as VgGeoShapeTransform,
  Interpolate,
  LayoutAlign,
  NumericValueRef,
  Orientation,
  ProjectionType,
  RangeBand,
  RangeRaw,
  RangeScheme,
  ScaleData,
  ScaledValueRef,
  SignalRef,
  SortField as VgSortField,
  Text,
  TextBaseline as VgTextBaseline,
  Title as VgTitle,
  Transforms as VgTransform,
  UnionSortField as VgUnionSortField
} from 'vega';
import {isArray} from 'vega-util';
import {Gradient, ValueOrGradientOrText} from './channeldef';
import {NiceTime, ScaleType} from './scale';
import {SortOrder} from './sort';
import {Flag, keys} from './util';

export {VgSortField, VgUnionSortField, VgCompare, VgTitle, LayoutAlign, ProjectionType, VgExprRef};

// TODO: make recursive
type ExcludeMapped<T, E> = {
  [P in keyof T]: Exclude<T[P], E>;
};

// Remove ValueRefs from mapped types
export type ExcludeMappedValueRef<T> = ExcludeMapped<T, ScaledValueRef<any> | NumericValueRef | ColorValueRef>;
export type ExcludeMappedSignalRefs<T> = ExcludeMapped<T, SignalRef>;

export interface VgData {
  name: string;
  source?: string;
  values?: any;
  format?: {
    type?: string;
    parse?: string | object;
    property?: string;
    feature?: string;
    mesh?: string;
  };
  url?: string;
  transform?: VgTransform[];
}

export interface VgDataRef {
  data: string;
  field: VgField;
  sort?: VgSortField;
}

export function isSignalRef(o: any): o is SignalRef {
  return !!o['signal'];
}

// TODO: add type of value (Make it VgValueRef<V extends ValueOrGradient> {value?:V ...})
export interface VgValueRef {
  value?: ValueOrGradientOrText | number[];
  field?:
    | string
    | {
        datum?: string;
        group?: string;
        parent?: string;
      };
  signal?: string;
  scale?: string; // TODO: object
  mult?: number;
  offset?: number | VgValueRef;
  band?: boolean | number | VgValueRef;
  test?: string;
}

// TODO: add vg prefix
export interface DataRefUnionDomain {
  fields: (any[] | VgDataRef | SignalRef)[];
  sort?: VgUnionSortField;
}

export interface VgFieldRefUnionDomain {
  data: string;
  fields: VgField[];
  sort?: VgUnionSortField;
}

export type VgRange = RangeScheme | ScaleData | RangeBand | RangeRaw;

export function isVgRangeStep(range: VgRange): range is VgRangeStep {
  return !!range['step'];
}

export interface VgRangeStep {
  step: number | SignalRef;
}
// Domains that are not a union of domains
export type VgNonUnionDomain = any[] | VgDataRef | SignalRef;
export type VgDomain = VgNonUnionDomain | DataRefUnionDomain | VgFieldRefUnionDomain;

export type VgMarkGroup = any;

// TODO: Eventually migrate to Vega-typings and make Vega typings take generic SR that can allow us to replace SignalRef with SignalComponent
export interface VgScale {
  name: string;
  type: ScaleType;
  align?: number;
  domain?: VgDomain;
  domainMid?: number;
  domainRaw?: SignalRef;
  bins?: number[] | SignalRef;
  range: VgRange;
  clamp?: boolean;
  base?: number;
  exponent?: number;
  constant?: number;
  interpolate?: ScaleInterpolate | ScaleInterpolateParams;
  nice?: boolean | number | NiceTime | {interval: string; step: number};
  padding?: number;
  paddingInner?: number;
  paddingOuter?: number;
  reverse?: boolean;
  round?: boolean;
  zero?: boolean;
}

export type ScaleInterpolate = 'rgb' | 'lab' | 'hcl' | 'hsl' | 'hsl-long' | 'hcl-long' | 'cubehelix' | 'cubehelix-long';

export interface ScaleInterpolateParams {
  type: 'rgb' | 'cubehelix' | 'cubehelix-long';
  gamma?: number;
}

export interface RowCol<T> {
  row?: T;
  column?: T;
}

export interface VgLayout {
  center?: boolean | RowCol<boolean>;
  padding?: number | RowCol<number>;
  headerBand?: number | RowCol<number>;
  footerBand?: number | RowCol<number>;

  titleAnchor?: 'start' | 'end' | RowCol<'start' | 'end'>;
  offset?:
    | number
    | {
        rowHeader?: number;
        rowFooter?: number;
        rowTitle?: number;
        columnHeader?: number;
        columnFooter?: number;
        columnTitle?: number;
      };
  bounds?: 'full' | 'flush';
  columns?: number | {signal: string};
  align?: LayoutAlign | RowCol<LayoutAlign>;
}

export function isDataRefUnionedDomain(domain: VgDomain): domain is DataRefUnionDomain {
  if (!isArray(domain)) {
    return 'fields' in domain && !('data' in domain);
  }
  return false;
}

export function isFieldRefUnionDomain(domain: VgDomain): domain is VgFieldRefUnionDomain {
  if (!isArray(domain)) {
    return 'fields' in domain && 'data' in domain;
  }
  return false;
}

export function isDataRefDomain(domain: VgDomain): domain is VgDataRef {
  if (!isArray(domain)) {
    return 'field' in domain && 'data' in domain;
  }
  return false;
}

export type VgEncodeChannel =
  | 'x'
  | 'x2'
  | 'xc'
  | 'width'
  | 'y'
  | 'y2'
  | 'yc'
  | 'height'
  | 'opacity'
  | 'fill'
  | 'fillOpacity'
  | 'stroke'
  | 'strokeWidth'
  | 'strokeCap'
  | 'strokeOpacity'
  | 'strokeDash'
  | 'strokeDashOffset'
  | 'strokeMiterLimit'
  | 'strokeJoin'
  | 'strokeOffset'
  | 'strokeForeground'
  | 'cursor'
  | 'clip'
  | 'size'
  | 'shape'
  | 'path'
  | 'innerRadius'
  | 'outerRadius'
  | 'startAngle'
  | 'endAngle'
  | 'interpolate'
  | 'tension'
  | 'orient'
  | 'url'
  | 'align'
  | 'baseline'
  | 'text'
  | 'dir'
  | 'ellipsis'
  | 'limit'
  | 'dx'
  | 'dy'
  | 'radius'
  | 'theta'
  | 'angle'
  | 'font'
  | 'fontSize'
  | 'fontWeight'
  | 'fontStyle'
  | 'tooltip'
  | 'href'
  | 'cursor'
  | 'defined'
  | 'cornerRadius'
  | 'cornerRadiusTopLeft'
  | 'cornerRadiusTopRight'
  | 'cornerRadiusBottomRight'
  | 'cornerRadiusBottomLeft'
  | 'scaleX'
  | 'scaleY';

export type VgEncodeEntry = {[k in VgEncodeChannel]?: VgValueRef | (VgValueRef & {test?: string})[]};

// TODO: make export interface VgEncodeEntry {
//   x?: VgValueRef<number>
//   y?: VgValueRef<number>
//  ...
//   color?: VgValueRef<string>
//  ...
// }

export type VgPostEncodingTransform = VgGeoShapeTransform;

export type VgGuideEncode = any; // TODO: replace this (See guideEncode in Vega Schema)

export type StrokeCap = 'butt' | 'round' | 'square';
export type StrokeJoin = 'miter' | 'round' | 'bevel';
export type Dir = 'ltr' | 'rtl';

export interface BaseMarkConfig {
  /**
   * X coordinates of the marks, or width of horizontal `"bar"` and `"area"` without specified `x2` or `width`.
   *
   * The `value` of this channel can be a number or a string `"width"` for the width of the plot.
   */
  x?: number | 'width';

  /**
   * Y coordinates of the marks, or height of vertical `"bar"` and `"area"` without specified `y2` or `height`.
   *
   * The `value` of this channel can be a number or a string `"height"` for the height of the plot.
   */
  y?: number | 'height';

  /**
   * Width of the marks.
   */
  width?: number;

  /**
   * Height of the marks.
   */
  height?: number;

  /**
   * X2 coordinates for ranged `"area"`, `"bar"`, `"rect"`, and  `"rule"`.
   *
   * The `value` of this channel can be a number or a string `"width"` for the width of the plot.
   */
  x2?: number | 'width';

  /**
   * Y2 coordinates for ranged `"area"`, `"bar"`, `"rect"`, and  `"rule"`.
   *
   * The `value` of this channel can be a number or a string `"height"` for the height of the plot.
   */
  y2?: number | 'height';

  /**
   * Whether to keep aspect ratio of image marks.
   */
  aspect?: boolean;

  /**
   * Default Fill Color. This has higher precedence than `config.color`.
   *
   * __Default value:__ (None)
   *
   */
  fill?: Color | Gradient | null;

  /**
   * Default Stroke Color. This has higher precedence than `config.color`.
   *
   * __Default value:__ (None)
   *
   */
  stroke?: Color | Gradient | null;

  // ---------- Opacity ----------
  /**
   * The overall opacity (value between [0,1]).
   *
   * __Default value:__ `0.7` for non-aggregate plots with `point`, `tick`, `circle`, or `square` marks or layered `bar` charts and `1` otherwise.
   *
   * @minimum 0
   * @maximum 1
   */
  opacity?: number;

  /**
   * The fill opacity (value between [0,1]).
   *
   * __Default value:__ `1`
   *
   * @minimum 0
   * @maximum 1
   */
  fillOpacity?: number;

  /**
   * The stroke opacity (value between [0,1]).
   *
   * __Default value:__ `1`
   *
   * @minimum 0
   * @maximum 1
   */
  strokeOpacity?: number;

  // ---------- Stroke Style ----------
  /**
   * The stroke width, in pixels.
   *
   * @minimum 0
   */
  strokeWidth?: number;

  /**
   * The stroke cap for line ending style. One of `"butt"`, `"round"`, or `"square"`.
   *
   * __Default value:__ `"square"`
   */
  strokeCap?: StrokeCap;

  /**
   * An array of alternating stroke, space lengths for creating dashed or dotted lines.
   */
  strokeDash?: number[];

  /**
   * The offset (in pixels) into which to begin drawing with the stroke dash array.
   */
  strokeDashOffset?: number;

  /**
   * The stroke line join method. One of `"miter"`, `"round"` or `"bevel"`.
   *
   * __Default value:__ `"miter"`
   */
  strokeJoin?: StrokeJoin;

  /**
   * The miter limit at which to bevel a line join.
   */
  strokeMiterLimit?: number;

  // ---------- Orientation: Bar, Tick, Line, Area ----------
  /**
   * The orientation of a non-stacked bar, tick, area, and line charts.
   * The value is either horizontal (default) or vertical.
   * - For bar, rule and tick, this determines whether the size of the bar and tick
   * should be applied to x or y dimension.
   * - For area, this property determines the orient property of the Vega output.
   * - For line and trail marks, this property determines the sort order of the points in the line
   * if `config.sortLineBy` is not specified.
   * For stacked charts, this is always determined by the orientation of the stack;
   * therefore explicitly specified value will be ignored.
   */
  orient?: Orientation;

  // ---------- Interpolation: Line / area ----------
  /**
   * The line interpolation method to use for line and area marks. One of the following:
   * - `"linear"`: piecewise linear segments, as in a polyline.
   * - `"linear-closed"`: close the linear segments to form a polygon.
   * - `"step"`: alternate between horizontal and vertical segments, as in a step function.
   * - `"step-before"`: alternate between vertical and horizontal segments, as in a step function.
   * - `"step-after"`: alternate between horizontal and vertical segments, as in a step function.
   * - `"basis"`: a B-spline, with control point duplication on the ends.
   * - `"basis-open"`: an open B-spline; may not intersect the start or end.
   * - `"basis-closed"`: a closed B-spline, as in a loop.
   * - `"cardinal"`: a Cardinal spline, with control point duplication on the ends.
   * - `"cardinal-open"`: an open Cardinal spline; may not intersect the start or end, but will intersect other control points.
   * - `"cardinal-closed"`: a closed Cardinal spline, as in a loop.
   * - `"bundle"`: equivalent to basis, except the tension parameter is used to straighten the spline.
   * - `"monotone"`: cubic interpolation that preserves monotonicity in y.
   */
  interpolate?: Interpolate;
  /**
   * Depending on the interpolation type, sets the tension parameter (for line and area marks).
   */
  tension?: number;

  /**
   * Shape of the point marks. Supported values include:
   * - plotting shapes: `"circle"`, `"square"`, `"cross"`, `"diamond"`, `"triangle-up"`, `"triangle-down"`, `"triangle-right"`, or `"triangle-left"`.
   * - the line symbol `"stroke"`
   * - centered directional shapes `"arrow"`, `"wedge"`, or `"triangle"`
   * - a custom [SVG path string](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths) (For correct sizing, custom shape paths should be defined within a square bounding box with coordinates ranging from -1 to 1 along both the x and y dimensions.)
   *
   * __Default value:__ `"circle"`
   */
  shape?: string;

  /**
   * The pixel area each the point/circle/square.
   * For example: in the case of circles, the radius is determined in part by the square root of the size value.
   *
   * __Default value:__ `30`
   *
   * @minimum 0
   */
  size?: number;

  // Text / Label Mark Config

  /**
   * The horizontal alignment of the text or ranged marks (area, bar, image, rect, rule). One of `"left"`, `"right"`, `"center"`.
   */
  align?: Align;

  /**
   * The rotation angle of the text, in degrees.
   * @minimum 0
   * @maximum 360
   */
  angle?: number;

  /**
   * The vertical alignment of the text or ranged marks (area, bar, image, rect, rule). One of `"top"`, `"middle"`, `"bottom"`.
   *
   * __Default value:__ `"middle"`
   */
  baseline?: VgTextBaseline;

  /**
   * The direction of the text. One of `"ltr"` (left-to-right) or `"rtl"` (right-to-left). This property determines on which side is truncated in response to the limit parameter.
   *
   * __Default value:__ `"ltr"`
   */
  dir?: Dir;

  /**
   * The horizontal offset, in pixels, between the text label and its anchor point. The offset is applied after rotation by the _angle_ property.
   */
  dx?: number;

  /**
   * The vertical offset, in pixels, between the text label and its anchor point. The offset is applied after rotation by the _angle_ property.
   */
  dy?: number;

  /**
   * Polar coordinate radial offset, in pixels, of the text label from the origin determined by the `x` and `y` properties.
   * @minimum 0
   */
  radius?: number;

  /**
   * The maximum length of the text mark in pixels. The text value will be automatically truncated if the rendered size exceeds the limit.
   *
   * __Default value:__ `0`, indicating no limit
   */
  limit?: number;

  /**
   * The ellipsis string for text truncated in response to the limit parameter.
   *
   * __Default value:__ `"…"`
   */
  ellipsis?: string;

  /**
   * Polar coordinate angle, in radians, of the text label from the origin determined by the `x` and `y` properties. Values for `theta` follow the same convention of `arc` mark `startAngle` and `endAngle` properties: angles are measured in radians, with `0` indicating "north".
   */
  theta?: number;

  /**
   * The typeface to set the text in (e.g., `"Helvetica Neue"`).
   */
  font?: string;

  /**
   * The font size, in pixels.
   * @minimum 0
   *
   * __Default value:__ `11`
   */
  fontSize?: number;

  /**
   * The font style (e.g., `"italic"`).
   */
  fontStyle?: VgFontStyle;

  /**
   * A delimiter, such as a newline character, upon which to break text strings into multiple lines. This property will be ignored if the text property is array-valued.
   */
  lineBreak?: string;

  /**
   * The height, in pixels, of each line of text in a multi-line text mark.
   */
  lineHeight?: number;

  /**
   * The font weight.
   * This can be either a string (e.g `"bold"`, `"normal"`) or a number (`100`, `200`, `300`, ..., `900` where `"normal"` = `400` and `"bold"` = `700`).
   */
  fontWeight?: VgFontWeight;

  /**
   * Placeholder text if the `text` channel is not specified
   */
  text?: Text;

  /**
   * A URL to load upon mouse click. If defined, the mark acts as a hyperlink.
   *
   * @format uri
   */
  href?: string;

  /**
   * The mouse cursor used over the mark. Any valid [CSS cursor type](https://developer.mozilla.org/en-US/docs/Web/CSS/cursor#Values) can be used.
   */
  cursor?: Cursor;

  /**
   * The tooltip text to show upon mouse hover.
   */
  tooltip?: any;

  // ---------- Corner Radius: Bar, Tick, Rect ----------

  /**
   * The radius in pixels of rounded rectangle corners.
   *
   * __Default value:__ `0`
   */
  cornerRadius?: number;

  /**
   * The radius in pixels of rounded rectangle top right corner.
   *
   * __Default value:__ `0`
   */
  cornerRadiusTopLeft?: number;

  /**
   * The radius in pixels of rounded rectangle top left corner.
   *
   * __Default value:__ `0`
   */
  cornerRadiusTopRight?: number;

  /**
   * The radius in pixels of rounded rectangle bottom right corner.
   *
   * __Default value:__ `0`
   */
  cornerRadiusBottomRight?: number;

  /**
   * The radius in pixels of rounded rectangle bottom left corner.
   *
   * __Default value:__ `0`
   */
  cornerRadiusBottomLeft?: number;
}

const VG_MARK_CONFIG_INDEX: Flag<keyof BaseMarkConfig> = {
  opacity: 1,
  fill: 1,
  fillOpacity: 1,
  stroke: 1,
  strokeCap: 1,
  strokeWidth: 1,
  strokeOpacity: 1,
  strokeDash: 1,
  strokeDashOffset: 1,
  strokeJoin: 1,
  strokeMiterLimit: 1,
  size: 1,
  shape: 1,
  interpolate: 1,
  tension: 1,
  orient: 1,
  align: 1,
  baseline: 1,
  text: 1,
  dir: 1,
  dx: 1,
  dy: 1,
  ellipsis: 1,
  limit: 1,
  radius: 1,
  theta: 1,
  angle: 1,
  font: 1,
  fontSize: 1,
  fontWeight: 1,
  fontStyle: 1,
  lineBreak: 1,
  lineHeight: 1,
  cursor: 1,
  href: 1,
  tooltip: 1,
  cornerRadius: 1,
  cornerRadiusTopLeft: 1,
  cornerRadiusTopRight: 1,
  cornerRadiusBottomLeft: 1,
  cornerRadiusBottomRight: 1,
  x: 1,
  y: 1,
  x2: 1,
  y2: 1,
  width: 1,
  height: 1,
  aspect: 1

  // commented below are vg channel that do not have mark config.
  // xc'|'yc'
  // clip: 1,
  // endAngle: 1,
  // innerRadius: 1,
  // outerRadius: 1,
  // path: 1,
  // startAngle: 1,
  // url: 1,
};

export const VG_MARK_CONFIGS = keys(VG_MARK_CONFIG_INDEX);

// Vega's cornerRadius channels.
export const VG_CORNERRADIUS_CHANNELS = [
  'cornerRadius',
  'cornerRadiusTopLeft',
  'cornerRadiusTopRight',
  'cornerRadiusBottomLeft',
  'cornerRadiusBottomRight'
] as const;

export interface VgComparator {
  field?: string | string[];
  order?: SortOrder | SortOrder[];
}

export interface VgJoinAggregateTransform {
  type: 'joinaggregate';
  as?: string[];
  ops?: AggregateOp[];
  fields?: string[];
  groupby?: string[];
}
