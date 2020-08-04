import {
  Align,
  AutoSize,
  EventType,
  FontStyle,
  FontWeight,
  Interpolate,
  Mark,
  Orientation,
  Padding,
  RangeScheme,
  SymbolShape,
  TextBaseline,
} from '.';
import { BaseAxis } from './axis';
import { Color } from './color';
import {
  Blend,
  ColorValueRef,
  Gradient,
  NumericValueRef,
  ScaledValueRef,
  Text,
  TextDirection,
} from './encode.d';
import { LayoutBounds } from './layout';
import { BaseLegend } from './legend';
import { Locale } from './locale';
import { BaseProjection } from './projection';
import { InitSignal, NewSignal, SignalRef } from './signal';
import { BaseTitle, TitleAnchor } from './title';

export type KeepSignal<T> = T extends SignalRef ? SignalRef : never;

/**
 * Config properties cannot be scaled or reference fields but they can reference signals.
 */
export type ExcludeMappedValueRef<T> = {
  [P in keyof T]:
    | Exclude<T[P], ScaledValueRef<any> | NumericValueRef | ColorValueRef>
    | KeepSignal<T[P]>;
};

export interface Config
  extends Partial<Record<MarkConfigKeys, MarkConfig>>,
    Partial<Record<AxisConfigKeys, AxisConfig>> {
  autosize?: AutoSize | SignalRef;
  background?: null | Color | SignalRef;
  padding?: Padding | SignalRef;
  group?: any; // TODO
  events?: {
    bind?: 'any' | 'container' | 'none';
    defaults?: DefaultsConfig;
    globalCursor?: boolean;
    selector?: boolean | string[];
    timer?: boolean;
    view?: boolean | string[];
    window?: boolean | string[];
  };
  locale?: Locale;

  /**
   * A delimiter, such as a newline character, upon which to break text strings into multiple lines. This property provides a global default for text marks, which is overridden by mark or style config settings, and by the "lineBreak" mark encoding channel. If signal-valued, either string or regular expression (regexp) values are valid.
   */
  lineBreak?: string | SignalRef;
  style?: {
    [style: string]: MarkConfig;
  };
  legend?: LegendConfig;
  title?: TitleConfig;
  projection?: ProjectionConfig;
  range?: RangeConfig;
  signals?: (InitSignal | NewSignal)[];
}

/**
 *  The defaults object should have a single property: either "prevent" (to indicate which events should have default behavior suppressed) or "allow" (to indicate only those events whose default behavior should be allowed).
 */
export type DefaultsConfig =
  | Record<'prevent', boolean | EventType[]>
  | Record<'allow', boolean | EventType[]>;

export type MarkConfigKeys = 'mark' | Mark['type'];

export type StrokeCap = 'butt' | 'round' | 'square';
export type StrokeJoin = 'miter' | 'round' | 'bevel';

export interface MarkConfig {
  /**
   * A boolean flag indicating if [ARIA attributes](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) should be included (SVG output only).
   * If `false`, the "aria-hidden" attribute will be set on the output SVG element, removing the mark item from the ARIA accessibility tree.
   */
  aria?: boolean | SignalRef;

  /**
   * Sets the type of user interface element of the mark item for [ARIA accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) (SVG output only).
   * If specified, this property determines the "role" attribute.
   * Warning: this property is experimental and may be changed in the future.
   */
  ariaRole?: string | SignalRef;

  /**
   * A human-readable, author-localized description for the role of the mark item for [ARIA accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) (SVG output only).
   * If specified, this property determines the "aria-roledescription" attribute.
   * Warning: this property is experimental and may be changed in the future.
   */
  ariaRoleDescription?: string | SignalRef;

  /**
   * A text description of the mark item for [ARIA accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) (SVG output only).
   * If specified, this property determines the ["aria-label" attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-label_attribute).
   */
  description?: string | SignalRef;

  /**
   * Width of the marks.
   */
  width?: number | SignalRef;

  /**
   * Height of the marks.
   */
  height?: number | SignalRef;

  /**
   * Whether to keep aspect ratio of image marks.
   */
  aspect?: boolean;

  /**
   * Default fill color.
   *
   * __Default value:__ (None)
   *
   */
  fill?: Color | Gradient | null | SignalRef;

  /**
   * Default stroke color.
   *
   * __Default value:__ (None)
   *
   */
  stroke?: Color | Gradient | null | SignalRef;

  // ---------- Opacity ----------
  /**
   * The overall opacity (value between [0,1]).
   *
   * @minimum 0
   * @maximum 1
   */
  opacity?: number | SignalRef;

  /**
   * The fill opacity (value between [0,1]).
   *
   * __Default value:__ `1`
   *
   * @minimum 0
   * @maximum 1
   */
  fillOpacity?: number | SignalRef;

  /**
   * The stroke opacity (value between [0,1]).
   *
   * __Default value:__ `1`
   *
   * @minimum 0
   * @maximum 1
   */
  strokeOpacity?: number | SignalRef;

  /**
   * The color blend mode for drawing an item on its current background. Any valid [CSS mix-blend-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode) value can be used.
   *
   * __Default value: `"source-over"`
   */
  blend?: Blend;

  // ---------- Stroke Style ----------
  /**
   * The stroke width, in pixels.
   *
   * @minimum 0
   */
  strokeWidth?: number | SignalRef;

  /**
   * An array of alternating stroke, space lengths for creating dashed or dotted lines.
   */
  strokeDash?: number[] | SignalRef;

  /**
   * The offset (in pixels) into which to begin drawing with the stroke dash array.
   */
  strokeDashOffset?: number | SignalRef;

  /**
   * The offset in pixels at which to draw the group stroke and fill. If unspecified, the default behavior is to dynamically offset stroked groups such that 1 pixel stroke widths align with the pixel grid.
   */
  strokeOffset?: number | SignalRef;

  /**
   * The stroke cap for line ending style. One of `"butt"`, `"round"`, or `"square"`.
   *
   * __Default value:__ `"butt"`
   *
   */
  strokeCap?: StrokeCap | SignalRef;

  /**
   * The stroke line join method. One of `"miter"`, `"round"` or `"bevel"`.
   *
   * __Default value:__ `"miter"`
   *
   */
  strokeJoin?: StrokeJoin | SignalRef;

  /**
   * The miter limit at which to bevel a line join.
   */
  strokeMiterLimit?: number | SignalRef;

  /**
   * The orientation of the area mark. One of `horizontal` or `vertical` (the default). With a vertical orientation, an area mark is defined by the `x`, `y`, and (`y2` or `height`) properties; with a horizontal orientation, the `y`, `x` and (`x2` or `width`) properties must be specified instead.
   */
  orient?: Orientation | SignalRef;

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
  interpolate?: Interpolate | SignalRef;

  /**
   * Depending on the interpolation type, sets the tension parameter (for line and area marks).
   */
  tension?: number | SignalRef;

  /**
   * Shape of the point marks. Supported values include:
   * - plotting shapes: `"circle"`, `"square"`, `"cross"`, `"diamond"`, `"triangle-up"`, `"triangle-down"`, `"triangle-right"`, or `"triangle-left"`.
   * - the line symbol `"stroke"`
   * - centered directional shapes `"arrow"`, `"wedge"`, or `"triangle"`
   * - a custom [SVG path string](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths) (For correct sizing, custom shape paths should be defined within a square bounding box with coordinates ranging from -1 to 1 along both the x and y dimensions.)
   *
   * __Default value:__ `"circle"`
   */
  shape?: SymbolShape | string | SignalRef;

  /**
   * The area in pixels of the symbols bounding box. Note that this value sets the area of the symbol; the side lengths will increase with the square root of this value.
   *
   * __Default value:__ `30`
   *
   * @minimum 0
   */
  size?: number | SignalRef;

  // Text / Label Mark Config
  /**
   * The horizontal alignment of the text. One of `"left"`, `"right"`, `"center"`.
   */
  align?: Align | SignalRef;

  /**
   * The rotation angle of the text, in degrees.
   *
   * @minimum 0
   * @maximum 360
   */
  angle?: number | SignalRef;

  /**
   * The start angle in radians for arc marks.
   * A value of `0` indicates up (north), increasing values proceed clockwise.
   */
  startAngle?: number | SignalRef;

  /**
   * The end angle in radians for arc marks.
   * A value of `0` indicates up (north), increasing values proceed clockwise.
   */
  endAngle?: number | SignalRef;

  /**
   * The angular padding applied to sides of the arc, in radians.
   */
  padAngle?: number | SignalRef;

  /**
   * The inner radius in pixels of arc marks.
   *
   * @minimum 0
   * __Default value:__ `0`
   */
  innerRadius?: number | SignalRef;

  /**
   * The outer radius in pixels of arc marks.
   *
   * @minimum 0
   * __Default value:__ `0`
   */
  outerRadius?: number | SignalRef;

  /**
   * The vertical alignment of the text. One of `"top"`, `"bottom"`, `"middle"`, `"alphabetic"`.
   *
   * __Default value:__ `"middle"`
   *
   */
  baseline?: TextBaseline | SignalRef;

  /**
   * The direction of the text. One of `"ltr"` (left-to-right) or `"rtl"` (right-to-left). This property determines on which side is truncated in response to the limit parameter.
   *
   * __Default value:__ `"ltr"`
   */
  dir?: TextDirection | SignalRef;

  /**
   * The horizontal offset, in pixels, between the text label and its anchor point. The offset is applied after rotation by the _angle_ property.
   */
  dx?: number | SignalRef;

  /**
   * The vertical offset, in pixels, between the text label and its anchor point. The offset is applied after rotation by the _angle_ property.
   */
  dy?: number | SignalRef;

  /**
   * The ellipsis string for text truncated in response to the limit parameter.
   *
   * __Default value:__ `"…"`
   */
  ellipsis?: string;

  /**
   * Polar coordinate radial offset, in pixels, of the text label from the origin determined by the `x` and `y` properties.
   *
   * @minimum 0
   */
  radius?: number | SignalRef;

  /**
   * The maximum length of the text mark in pixels. The text value will be automatically truncated if the rendered size exceeds the limit.
   *
   * __Default value:__ `0` -- indicating no limit
   */
  limit?: number | SignalRef;

  /**
   * A delimiter, such as a newline character, upon which to break text strings into multiple lines. This property is ignored if the text is array-valued.
   */
  lineBreak?: string | SignalRef;

  /**
   * The line height in pixels (the spacing between subsequent lines of text) for multi-line text marks.
   */
  lineHeight?: number | SignalRef;

  /**
   * Polar coordinate angle, in radians, of the text label from the origin determined by the `x` and `y` properties. Values for `theta` follow the same convention of `arc` mark `startAngle` and `endAngle` properties: angles are measured in radians, with `0` indicating "north".
   */
  theta?: number | SignalRef;

  /**
   * The typeface to set the text in (e.g., `"Helvetica Neue"`).
   */
  font?: string | SignalRef;

  /**
   * The font size, in pixels.
   *
   * __Default value:__ `11`
   *
   *  @minimum 0
   */
  fontSize?: number | SignalRef;

  /**
   * The font style (e.g., `"italic"`).
   */
  fontStyle?: FontStyle | SignalRef;
  /**
   * The font weight.
   * This can be either a string (e.g `"bold"`, `"normal"`) or a number (`100`, `200`, `300`, ..., `900` where `"normal"` = `400` and `"bold"` = `700`).
   */
  fontWeight?: FontWeight | SignalRef;

  /**
   * Placeholder text if the `text` channel is not specified
   */
  text?: Text | SignalRef;

  /**
   * A URL to load upon mouse click. If defined, the mark acts as a hyperlink.
   *
   * @format uri
   */
  href?: string | SignalRef;

  /**
   * The tooltip text to show upon mouse hover.
   */
  tooltip?: string | SignalRef;

  /**
   * The mouse cursor used over the mark. Any valid [CSS cursor type](https://developer.mozilla.org/en-US/docs/Web/CSS/cursor#Values) can be used.
   */
  cursor?: Cursor | SignalRef;

  // ---------- Corner Radius: Bar, Tick, Rect ----------

  /**
   * The radius in pixels of rounded rectangles or arcs' corners.
   *
   * __Default value:__ `0`
   */
  cornerRadius?: number | SignalRef;

  /**
   * The radius in pixels of rounded rectangles' top right corner.
   *
   * __Default value:__ `0`
   */
  cornerRadiusTopLeft?: number | SignalRef;

  /**
   * The radius in pixels of rounded rectangles' top left corner.
   *
   * __Default value:__ `0`
   */
  cornerRadiusTopRight?: number | SignalRef;

  /**
   * The radius in pixels of rounded rectangles' bottom right corner.
   *
   * __Default value:__ `0`
   */
  cornerRadiusBottomRight?: number | SignalRef;

  /**
   * The radius in pixels of rounded rectangles' bottom left corner.
   *
   * __Default value:__ `0`
   */
  cornerRadiusBottomLeft?: number | SignalRef;
}

export type Cursor =
  | 'auto'
  | 'default'
  | 'none'
  | 'context-menu'
  | 'help'
  | 'pointer'
  | 'progress'
  | 'wait'
  | 'cell'
  | 'crosshair'
  | 'text'
  | 'vertical-text'
  | 'alias'
  | 'copy'
  | 'move'
  | 'no-drop'
  | 'not-allowed'
  | 'e-resize'
  | 'n-resize'
  | 'ne-resize'
  | 'nw-resize'
  | 's-resize'
  | 'se-resize'
  | 'sw-resize'
  | 'w-resize'
  | 'ew-resize'
  | 'ns-resize'
  | 'nesw-resize'
  | 'nwse-resize'
  | 'col-resize'
  | 'row-resize'
  | 'all-scroll'
  | 'zoom-in'
  | 'zoom-out'
  | 'grab'
  | 'grabbing';

export type AxisConfigKeys =
  | 'axis'
  | 'axisX'
  | 'axisY'
  | 'axisTop'
  | 'axisRight'
  | 'axisBottom'
  | 'axisLeft'
  | 'axisBand';

export type AxisConfig = ExcludeMappedValueRef<BaseAxis>;

/**
 * Legend config without signals so we can use it in Vega-Lite.
 */
export interface LegendConfig extends ExcludeMappedValueRef<BaseLegend> {
  /**
   * The default direction (`"horizontal"` or `"vertical"`) for gradient legends.
   *
   * __Default value:__ `"vertical"`.
   */
  gradientDirection?: Orientation;

  /**
   * The maximum allowed length in pixels of color ramp gradient labels.
   */
  gradientLabelLimit?: number | SignalRef;

  /**
   * Vertical offset in pixels for color ramp gradient labels.
   *
   * __Default value:__ `2`.
   */
  gradientLabelOffset?: number | SignalRef;

  /**
   * Default fill color for legend symbols. Only applied if there is no `"fill"` scale color encoding for the legend.
   *
   * __Default value:__ `"transparent"`.
   */
  symbolBaseFillColor?: null | Color | SignalRef;

  /**
   * Default stroke color for legend symbols. Only applied if there is no `"fill"` scale color encoding for the legend.
   *
   * __Default value:__ `"gray"`.
   */
  symbolBaseStrokeColor?: null | Color | SignalRef;

  /**
   * The default direction (`"horizontal"` or `"vertical"`) for symbol legends.
   *
   * __Default value:__ `"vertical"`.
   */
  symbolDirection?: Orientation;

  /**
   * Border stroke dash pattern for the full legend.
   */
  strokeDash?: number[] | SignalRef;

  /**
   * Border stroke width for the full legend.
   */
  strokeWidth?: number | SignalRef;

  /**
   * Legend orient group layout parameters.
   */
  layout?: LegendLayout;
}

export interface BaseLegendLayout {
  /**
   * The anchor point for legend orient group layout.
   */
  anchor?: TitleAnchor | SignalRef;

  /**
   * The bounds calculation to use for legend orient group layout.
   */
  bounds?: LayoutBounds;

  /**
   * A flag to center legends within a shared orient group.
   */
  center?: boolean | SignalRef;

  /**
   * The layout direction for legend orient group layout.
   */
  direction?: Orientation | SignalRef;

  /**
   * The pixel margin between legends within a orient group.
   */
  margin?: number | SignalRef;

  /**
   * The pixel offset from the chart body for a legend orient group.
   */
  offset?: number | SignalRef;
}

export interface LegendLayout extends BaseLegendLayout {
  left?: BaseLegendLayout;
  right?: BaseLegendLayout;
  top?: BaseLegendLayout;
  bottom?: BaseLegendLayout;
  'top-left'?: BaseLegendLayout;
  'top-right'?: BaseLegendLayout;
  'bottom-left'?: BaseLegendLayout;
  'bottom-right'?: BaseLegendLayout;
}

export type TitleConfig = ExcludeMappedValueRef<BaseTitle>;

export type ProjectionConfig = ExcludeMappedValueRef<BaseProjection>;

export type RangeConfig = {
  /**
   * Default [color scheme](https://vega.github.io/vega/docs/schemes/) for categorical data.
   */
  category?: RangeScheme | string[];
  /**
   * Default [color scheme](https://vega.github.io/vega/docs/schemes/) for diverging quantitative ramps.
   */
  diverging?: RangeScheme | string[];
  /**
   * Default [color scheme](https://vega.github.io/vega/docs/schemes/) for quantitative heatmaps.
   */
  heatmap?: RangeScheme | string[];
  /**
   * Default [color scheme](https://vega.github.io/vega/docs/schemes/) for rank-ordered data.
   */
  ordinal?: RangeScheme | string[];
  /**
   * Default [color scheme](https://vega.github.io/vega/docs/schemes/) for sequential quantitative ramps.
   */
  ramp?: RangeScheme | string[];
  /**
   * Array of [symbol](https://vega.github.io/vega/docs/marks/symbol/) names or paths for the default shape palette.
   */
  symbol?: SymbolShape[];
} & {
  [name: string]: RangeScheme | number[] | boolean[] | string[] | SymbolShape[];
};
