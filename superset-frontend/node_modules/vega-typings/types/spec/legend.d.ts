import {
  GroupEncodeEntry,
  Orientation,
  RectEncodeEntry,
  SignalRef,
  SymbolEncodeEntry,
  TextEncodeEntry,
} from '.';
import { FormatType, LabelOverlap, TickCount, TimeFormatSpecifier } from './axis';
import { Text } from './encode';
import { LayoutAlign } from './layout';
import {
  AlignValue,
  AnchorValue,
  BooleanValue,
  ColorValue,
  DashArrayValue,
  FontStyleValue,
  FontWeightValue,
  NumberValue,
  OrientValue,
  StringValue,
  SymbolShapeValue,
  TextBaselineValue,
} from './values';

export interface GuideEncodeEntry<T> {
  name?: string;
  /**
   * A boolean flag indicating if the guide element should respond to input events such as mouse hover.
   */
  interactive?: boolean;

  /**
   * A mark style property to apply to the guide group mark.
   */
  style?: string | string[];
  enter?: T;
  update?: T;
  exit?: T;
  hover?: T;
}

export type LegendType = 'gradient' | 'symbol';

export type LegendOrient =
  | 'none'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface Legend extends BaseLegend {
  size?: string;
  shape?: string;
  fill?: string;
  stroke?: string;
  strokeDash?: string;
  strokeWidth?: string;
  opacity?: string;

  /**
   * The type of legend to include. One of `"symbol"` for discrete symbol legends, or `"gradient"` for a continuous color gradient. If gradient is used only the fill or stroke scale parameters are considered. If unspecified, the type will be inferred based on the scale parameters used and their backing scale types.
   */
  type?: LegendType;

  /**
   * The direction of the legend, one of `"vertical"` (default) or `"horizontal"`.
   *
   * __Default value:__ `"vertical"`
   */
  direction?: Orientation;

  /**
   * The format specifier pattern for legend labels. For numerical values, must be a legal [d3-format](https://github.com/d3/d3-format#locale_format) specifier. For date-time values, must be a legal [d3-time-format](https://github.com/d3/d3-time-format#locale_format) specifier or multi-format object.
   */
  format?: string | TimeFormatSpecifier | SignalRef;

  /**
   * The format type for legend labels (number, time, or utc).
   */
  formatType?: FormatType | SignalRef;

  /**
   * The title for the legend.
   */
  title?: Text | SignalRef;

  /**
   * The minimum desired step between tick values for quantitative legends, in terms of scale domain values. For example, a value of `1` indicates that ticks should not be less than 1 unit apart. If `tickMinStep` is specified, the `tickCount` value will be adjusted, if necessary, to enforce the minimum step value.
   */
  tickMinStep?: number | SignalRef;

  /**
   * Explicitly set the visible legend values.
   */
  values?: any[] | SignalRef;

  /**
   * Mark definitions for custom legend encoding.
   */
  encode?: LegendEncode;
}

export interface LegendEncode {
  title?: GuideEncodeEntry<TextEncodeEntry>;
  labels?: GuideEncodeEntry<TextEncodeEntry>;
  legend?: GuideEncodeEntry<GroupEncodeEntry>;
  entries?: GuideEncodeEntry<GroupEncodeEntry>;
  symbols?: GuideEncodeEntry<SymbolEncodeEntry>;
  gradient?: GuideEncodeEntry<RectEncodeEntry>;
}

/**
 * Properties shared between legends and legend configs.
 */
export interface BaseLegend {
  /**
   * The orientation of the legend, which determines how the legend is positioned within the scene. One of "left", "right", "top-left", "top-right", "bottom-left", "bottom-right", "none".
   *
   * __Default value:__ `"right"`
   */
  orient?: LegendOrient | SignalRef;

  /**
   * The maximum number of allowed entries for a symbol legend. Additional entries will be dropped.
   */
  symbolLimit?: NumberValue;

  /**
   * The desired number of tick values for quantitative legends.
   */
  tickCount?: TickCount;

  // ---------- ARIA ----------
  /**
   * A boolean flag indicating if [ARIA attributes](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) should be included (SVG output only).
   * If `false`, the "aria-hidden" attribute will be set on the output SVG group, removing the legend from the ARIA accessibility tree.
   *
   * __Default value:__ `true`
   */
  aria?: boolean;

  /**
   * A text description of this legend for [ARIA accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) (SVG output only).
   * If the `aria` property is true, for SVG output the ["aria-label" attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-label_attribute) will be set to this description.
   * If the description is unspecified it will be automatically generated.
   */
  description?: string;

  // ---------- Legend Group ----------
  /**
   * Corner radius for the full legend.
   */
  cornerRadius?: NumberValue;

  /**
   * Background fill color for the full legend.
   */
  fillColor?: ColorValue;

  /**
   * The offset in pixels by which to displace the legend from the data rectangle and axes.
   *
   * __Default value:__ `18`.
   */
  offset?: NumberValue;

  /**
   * The padding between the border and content of the legend group.
   *
   * __Default value:__ `0`.
   */
  padding?: NumberValue;

  /**
   * Border stroke color for the full legend.
   */
  strokeColor?: ColorValue;

  /**
   * Custom x-position for legend with orient "none".
   */
  legendX?: NumberValue;

  /**
   * Custom y-position for legend with orient "none".
   */
  legendY?: NumberValue;

  // ---------- Title ----------
  /**
   * Horizontal text alignment for legend titles.
   *
   * __Default value:__ `"left"`.
   */
  titleAlign?: AlignValue;

  /**
   * Text anchor position for placing legend titles.
   */
  titleAnchor?: AnchorValue;

  /**
   * Vertical text baseline for legend titles.  One of `"alphabetic"` (default), `"top"`, `"middle"`, `"bottom"`, `"line-top"`, or `"line-bottom"`. The `"line-top"` and `"line-bottom"` values operate similarly to `"top"` and `"bottom"`, but are calculated relative to the *lineHeight* rather than *fontSize* alone.
   *
   * __Default value:__ `"top"`.
   */
  titleBaseline?: TextBaselineValue;

  /**
   * The color of the legend title, can be in hex color code or regular color name.
   */
  titleColor?: ColorValue;

  /**
   * The font of the legend title.
   */
  titleFont?: StringValue;

  /**
   * The font size of the legend title.
   */
  titleFontSize?: NumberValue;

  /**
   * The font style of the legend title.
   */
  titleFontStyle?: FontStyleValue;

  /**
   * The font weight of the legend title.
   * This can be either a string (e.g `"bold"`, `"normal"`) or a number (`100`, `200`, `300`, ..., `900` where `"normal"` = `400` and `"bold"` = `700`).
   */
  titleFontWeight?: FontWeightValue;

  /**
   * Maximum allowed pixel width of legend titles.
   *
   * __Default value:__ `180`.
   * @minimum 0
   */
  titleLimit?: NumberValue;

  /**
   * Line height in pixels for multi-line title text or title text with `"line-top"` or `"line-bottom"` baseline.
   */
  titleLineHeight?: NumberValue;

  /**
   * Opacity of the legend title.
   */
  titleOpacity?: NumberValue;

  /**
   * Orientation of the legend title.
   */
  titleOrient?: OrientValue;

  /**
   * The padding, in pixels, between title and legend.
   *
   * __Default value:__ `5`.
   */
  titlePadding?: NumberValue;

  // ---------- Gradient ----------

  /**
   * The length in pixels of the primary axis of a color gradient. This value corresponds to the height of a vertical gradient or the width of a horizontal gradient.
   *
   * __Default value:__ `200`.
   * @minimum 0
   */
  gradientLength?: number | SignalRef;

  /**
   * Opacity of the color gradient.
   */
  gradientOpacity?: NumberValue;

  /**
   * The thickness in pixels of the color gradient. This value corresponds to the width of a vertical gradient or the height of a horizontal gradient.
   *
   * __Default value:__ `16`.
   * @minimum 0
   */
  gradientThickness?: number | SignalRef;

  /**
   * The color of the gradient stroke, can be in hex color code or regular color name.
   *
   * __Default value:__ `"lightGray"`.
   */
  gradientStrokeColor?: ColorValue;

  /**
   * The width of the gradient stroke, in pixels.
   *
   * __Default value:__ `0`.
   * @minimum 0
   */
  gradientStrokeWidth?: NumberValue;

  // ---------- Symbol Layout ----------
  /**
   * The height in pixels to clip symbol legend entries and limit their size.
   */
  clipHeight?: number | SignalRef;

  /**
   * The number of columns in which to arrange symbol legend entries. A value of `0` or lower indicates a single row with one column per entry.
   */
  columns?: number | SignalRef;

  /**
   * The horizontal padding in pixels between symbol legend entries.
   *
   * __Default value:__ `10`.
   */
  columnPadding?: number | SignalRef;

  /**
   * The vertical padding in pixels between symbol legend entries.
   *
   * __Default value:__ `2`.
   */
  rowPadding?: number | SignalRef;

  /**
   * The alignment to apply to symbol legends rows and columns. The supported string values are `"all"`, `"each"` (the default), and `none`. For more information, see the [grid layout documentation](https://vega.github.io/vega/docs/layout).
   *
   * __Default value:__ `"each"`.
   */
  gridAlign?: LayoutAlign | SignalRef;

  // ---------- Symbols ----------
  /**
   * An array of alternating [stroke, space] lengths for dashed symbol strokes.
   */
  symbolDash?: DashArrayValue;

  /**
   * The pixel offset at which to start drawing with the symbol stroke dash array.
   */
  symbolDashOffset?: NumberValue;

  /**
   * The color of the legend symbol,
   */
  symbolFillColor?: ColorValue;

  /**
   * Horizontal pixel offset for legend symbols.
   *
   * __Default value:__ `0`.
   */
  symbolOffset?: NumberValue;

  /**
   * Opacity of the legend symbols.
   */
  symbolOpacity?: NumberValue;

  /**
   * The size of the legend symbol, in pixels.
   *
   * __Default value:__ `100`.
   * @minimum 0
   */
  symbolSize?: NumberValue;

  /**
   * Stroke color for legend symbols.
   */
  symbolStrokeColor?: ColorValue;

  /**
   * The width of the symbol's stroke.
   *
   * __Default value:__ `1.5`.
   * @minimum 0
   */
  symbolStrokeWidth?: NumberValue;

  /**
   * The symbol shape. One of the plotting shapes `circle` (default), `square`, `cross`, `diamond`, `triangle-up`, `triangle-down`, `triangle-right`, or `triangle-left`, the line symbol `stroke`, or one of the centered directional shapes `arrow`, `wedge`, or `triangle`. Alternatively, a custom [SVG path string](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths) can be provided. For correct sizing, custom shape paths should be defined within a square bounding box with coordinates ranging from -1 to 1 along both the x and y dimensions.
   *
   * __Default value:__ `"circle"`.
   */
  symbolType?: SymbolShapeValue | SignalRef;

  // ---------- Label ----------
  /**
   * The alignment of the legend label, can be left, center, or right.
   */
  labelAlign?: AlignValue;

  /**
   * The position of the baseline of legend label, can be `"top"`, `"middle"`, `"bottom"`, or `"alphabetic"`.
   *
   * __Default value:__ `"middle"`.
   */
  labelBaseline?: TextBaselineValue;

  /**
   * The color of the legend label, can be in hex color code or regular color name.
   */
  labelColor?: ColorValue;

  /**
   * The font of the legend label.
   */
  labelFont?: StringValue;

  /**
   * The font size of legend label.
   *
   * __Default value:__ `10`.
   *
   * @minimum 0
   */
  labelFontSize?: NumberValue;

  /**
   * The font style of legend label.
   */
  labelFontStyle?: FontStyleValue;

  /**
   * The font weight of legend label.
   */
  labelFontWeight?: FontWeightValue;

  /**
   * Maximum allowed pixel width of legend tick labels.
   *
   * __Default value:__ `160`.
   */
  labelLimit?: NumberValue;

  /**
   * Opacity of labels.
   */
  labelOpacity?: NumberValue;

  /**
   * Padding in pixels between the legend and legend labels.
   */
  labelPadding?: NumberValue;

  /**
   * The offset of the legend label.
   * @minimum 0
   *
   * __Default value:__ `4`.
   */
  labelOffset?: NumberValue;

  /**
   * The strategy to use for resolving overlap of labels in gradient legends. If `false`, no overlap reduction is attempted. If set to `true` (default) or `"parity"`, a strategy of removing every other label is used. If set to `"greedy"`, a linear scan of the labels is performed, removing any label that overlaps with the last visible label (this often works better for log-scaled axes).
   *
   * __Default value:__ `true`.
   */
  labelOverlap?: LabelOverlap | SignalRef;

  /**
   * The minimum separation that must be between label bounding boxes for them to be considered non-overlapping (default `0`). This property is ignored if *labelOverlap* resolution is not enabled.
   */
  labelSeparation?: number | SignalRef;

  /**
   * The integer z-index indicating the layering of the legend group relative to other axis, mark, and legend groups.
   *
   * @TJS-type integer
   * @minimum 0
   */
  zindex?: number;
}
