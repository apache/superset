import {Color, Orientation} from 'vega';
import {toSet} from 'vega-util';
import {Gradient, Value} from './channeldef';
import {CompositeMark, CompositeMarkDef} from './compositemark';
import {contains, Flag, keys} from './util';
import {BaseMarkConfig} from './vega.schema';

export const AREA: 'area' = 'area';
export const BAR: 'bar' = 'bar';
export const IMAGE: 'image' = 'image';
export const LINE: 'line' = 'line';
export const POINT: 'point' = 'point';
export const RECT: 'rect' = 'rect';
export const RULE: 'rule' = 'rule';
export const TEXT: 'text' = 'text';
export const TICK: 'tick' = 'tick';
export const TRAIL: 'trail' = 'trail';
export const CIRCLE: 'circle' = 'circle';
export const SQUARE: 'square' = 'square';
export const GEOSHAPE: 'geoshape' = 'geoshape';

/**
 * All types of primitive marks.
 */
export type Mark =
  | typeof AREA
  | typeof BAR
  | typeof LINE
  | typeof IMAGE
  | typeof TRAIL
  | typeof POINT
  | typeof TEXT
  | typeof TICK
  | typeof RECT
  | typeof RULE
  | typeof CIRCLE
  | typeof SQUARE
  | typeof GEOSHAPE;

// Using mapped type to declare index, ensuring we always have all marks when we add more.
const MARK_INDEX: Flag<Mark> = {
  area: 1,
  bar: 1,
  image: 1,
  line: 1,
  point: 1,
  text: 1,
  tick: 1,
  trail: 1,
  rect: 1,
  geoshape: 1,
  rule: 1,
  circle: 1,
  square: 1
};

export function isMark(m: string): m is Mark {
  return !!MARK_INDEX[m];
}

export function isPathMark(m: Mark | CompositeMark): m is 'line' | 'area' | 'trail' {
  return contains(['line', 'area', 'trail'], m);
}

export function isRectBasedMark(m: Mark | CompositeMark): m is 'rect' | 'bar' | 'image' {
  return contains(['rect', 'bar', 'image'], m);
}

export const PRIMITIVE_MARKS = keys(MARK_INDEX);

export interface ColorMixins {
  /**
   * Default color.
   *
   * __Default value:__ <span style="color: #4682b4;">&#9632;</span> `"#4682b4"`
   *
   * __Note:__
   * - This property cannot be used in a [style config](https://vega.github.io/vega-lite/docs/mark.html#style-config).
   * - The `fill` and `stroke` properties have higher precedence than `color` and will override `color`.
   */
  color?: Color | Gradient;
}

export interface TooltipContent {
  content: 'encoding' | 'data';
}

/** @hidden */
export type Hide = 'hide';

export interface MarkConfig extends ColorMixins, BaseMarkConfig {
  // ========== VL-Specific ==========

  /**
   * Whether the mark's color should be used as fill color instead of stroke color.
   *
   * __Default value:__ `false` for all `point`, `line`, and `rule` marks as well as `geoshape` marks for [`graticule`](https://vega.github.io/vega-lite/docs/data.html#graticule) data sources; otherwise, `true`.
   *
   * __Note:__ This property cannot be used in a [style config](https://vega.github.io/vega-lite/docs/mark.html#style-config).
   *
   */
  filled?: boolean;

  // ========== Overriding Vega ==========

  /**
   * The tooltip text string to show upon mouse hover or an object defining which fields should the tooltip be derived from.
   *
   * - If `tooltip` is `true` or `{"content": "encoding"}`, then all fields from `encoding` will be used.
   * - If `tooltip` is `{"content": "data"}`, then all fields that appear in the highlighted data point will be used.
   * - If set to `null` or `false`, then no tooltip will be used.
   *
   * See the [`tooltip`](https://vega.github.io/vega-lite/docs/tooltip.html) documentation for a detailed discussion about tooltip  in Vega-Lite.
   *
   * __Default value:__ `null`
   */
  tooltip?: Value | TooltipContent | null;

  /**
   * Default size for marks.
   * - For `point`/`circle`/`square`, this represents the pixel area of the marks. For example: in the case of circles, the radius is determined in part by the square root of the size value.
   * - For `bar`, this represents the band size of the bar, in pixels.
   * - For `text`, this represents the font size, in pixels.
   *
   * __Default value:__
   * - `30` for point, circle, square marks; width/height's `step`
   * - `2` for bar marks with discrete dimensions;
   * - `5` for bar marks with continuous dimensions;
   * - `11` for text marks.
   *
   * @minimum 0
   */
  size?: number;

  /**
   * For line and trail marks, this `order` property can be set to `null` or `false` to make the lines use the original order in the data sources.
   */
  order?: null | boolean;

  /**
   * Defines how Vega-Lite should handle marks for invalid values (`null` and `NaN`).
   * - If set to `"filter"` (default), all data items with null values will be skipped (for line, trail, and area marks) or filtered (for other marks).
   * - If `null`, all data items are included. In this case, invalid values will be interpreted as zeroes.
   */
  invalid?: 'filter' | Hide | null;

  /**
   * Default relative band position for a time unit. If set to `0`, the marks will be positioned at the beginning of the time unit band step.
   * If set to `0.5`, the marks will be positioned in the middle of the time unit band step.
   */
  timeUnitBandPosition?: number;

  /**
   * Default relative band size for a time unit. If set to `1`, the bandwidth of the marks will be equal to the time unit band step.
   * If set to `0.5`, bandwidth of the marks will be half of the time unit band step.
   */
  timeUnitBand?: number;
}

export interface RectBinSpacingMixins {
  /**
   * Offset between bars for binned field. The ideal value for this is either 0 (preferred by statisticians) or 1 (Vega-Lite default, D3 example style).
   *
   * __Default value:__ `1`
   *
   * @minimum 0
   */
  binSpacing?: number;
}

export type AnyMark = CompositeMark | CompositeMarkDef | Mark | MarkDef;

export function isMarkDef(mark: string | GenericMarkDef<any>): mark is GenericMarkDef<any> {
  return mark['type'];
}

const PRIMITIVE_MARK_INDEX = toSet(PRIMITIVE_MARKS);

export function isPrimitiveMark(mark: AnyMark): mark is Mark {
  const markType = isMarkDef(mark) ? mark.type : mark;
  return markType in PRIMITIVE_MARK_INDEX;
}

export const STROKE_CONFIG = [
  'stroke',
  'strokeWidth',
  'strokeDash',
  'strokeDashOffset',
  'strokeOpacity',
  'strokeJoin',
  'strokeMiterLimit'
] as const;

export const FILL_CONFIG = ['fill', 'fillOpacity'] as const;

export const FILL_STROKE_CONFIG = [...STROKE_CONFIG, ...FILL_CONFIG];

export const VL_ONLY_MARK_CONFIG_PROPERTIES: (keyof MarkConfig)[] = [
  'filled',
  'color',
  'tooltip',
  'invalid',
  'timeUnitBandPosition',
  'timeUnitBand'
];

export const VL_ONLY_MARK_SPECIFIC_CONFIG_PROPERTY_INDEX: {
  [k in Mark]?: (keyof Required<MarkConfigMixins>[k])[];
} = {
  area: ['line', 'point'],
  bar: ['binSpacing', 'continuousBandSize', 'discreteBandSize'],
  rect: ['binSpacing', 'continuousBandSize', 'discreteBandSize'],
  line: ['point'],
  tick: ['bandSize', 'thickness']
};

export const defaultMarkConfig: MarkConfig = {
  color: '#4c78a8',
  invalid: 'filter',
  timeUnitBand: 1
};

export type AnyMarkConfig = MarkConfig | AreaConfig | BarConfig | RectConfig | LineConfig | TickConfig;

export interface MarkConfigMixins {
  /** Mark Config */
  mark?: MarkConfig;

  // MARK-SPECIFIC CONFIGS
  /** Area-Specific Config */
  area?: AreaConfig;

  /** Bar-Specific Config */
  bar?: BarConfig;

  /** Circle-Specific Config */
  circle?: MarkConfig;

  /** Image-specific Config */
  image?: RectConfig;

  /** Line-Specific Config */
  line?: LineConfig;

  /** Point-Specific Config */
  point?: MarkConfig;

  /** Rect-Specific Config */
  rect?: RectConfig;

  /** Rule-Specific Config */
  rule?: MarkConfig;

  /** Square-Specific Config */
  square?: MarkConfig;

  /** Text-Specific Config */
  text?: MarkConfig;

  /** Tick-Specific Config */
  tick?: TickConfig;

  /** Trail-Specific Config */
  trail?: LineConfig;

  /** Geoshape-Specific Config */
  geoshape?: MarkConfig;
}

export interface RectConfig extends RectBinSpacingMixins, MarkConfig {
  /**
   * The default size of the bars on continuous scales.
   *
   * __Default value:__ `5`
   *
   * @minimum 0
   */
  continuousBandSize?: number;

  /**
   * The default size of the bars with discrete dimensions. If unspecified, the default size is  `step-2`, which provides 2 pixel offset between bars.
   * @minimum 0
   */
  discreteBandSize?: number;
}

export const BAR_CORNER_RADIUS_INDEX: {
  [orient in Orientation]: (
    | 'cornerRadiusTopLeft'
    | 'cornerRadiusTopRight'
    | 'cornerRadiusBottomLeft'
    | 'cornerRadiusBottomRight'
  )[];
} = {
  horizontal: ['cornerRadiusTopRight', 'cornerRadiusBottomRight'],
  vertical: ['cornerRadiusTopLeft', 'cornerRadiusTopRight']
};

export interface BarCornerRadiusMixins {
  /**
   * - For vertical bars, top-left and top-right corner radius.
   * - For horizontal bars, top-right and bottom-right corner radius.
   */
  cornerRadiusEnd?: number;
}

export type BarConfig = RectConfig & BarCornerRadiusMixins;

export type OverlayMarkDef = MarkConfig & MarkDefMixins;

export interface PointOverlayMixins {
  /**
   * A flag for overlaying points on top of line or area marks, or an object defining the properties of the overlayed points.
   *
   * - If this property is `"transparent"`, transparent points will be used (for enhancing tooltips and selections).
   *
   * - If this property is an empty object (`{}`) or `true`, filled points with default properties will be used.
   *
   * - If this property is `false`, no points would be automatically added to line or area marks.
   *
   * __Default value:__ `false`.
   */
  point?: boolean | OverlayMarkDef | 'transparent';
}

export interface LineConfig extends MarkConfig, PointOverlayMixins {}

export interface LineOverlayMixins {
  /**
   * A flag for overlaying line on top of area marks, or an object defining the properties of the overlayed lines.
   *
   * - If this value is an empty object (`{}`) or `true`, lines with default properties will be used.
   *
   * - If this value is `false`, no lines would be automatically added to area marks.
   *
   * __Default value:__ `false`.
   */
  line?: boolean | OverlayMarkDef;
}

export interface AreaConfig extends MarkConfig, PointOverlayMixins, LineOverlayMixins {}

export interface TickThicknessMixins {
  /**
   * Thickness of the tick mark.
   *
   * __Default value:__  `1`
   *
   * @minimum 0
   */
  thickness?: number;
}

export interface GenericMarkDef<M> {
  /**
   * The mark type. This could a primitive mark type
   * (one of `"bar"`, `"circle"`, `"square"`, `"tick"`, `"line"`,
   * `"area"`, `"point"`, `"geoshape"`, `"rule"`, and `"text"`)
   * or a composite mark type (`"boxplot"`, `"errorband"`, `"errorbar"`).
   */
  type: M;
}

export interface MarkDefMixins {
  /**
   * A string or array of strings indicating the name of custom styles to apply to the mark. A style is a named collection of mark property defaults defined within the [style configuration](https://vega.github.io/vega-lite/docs/mark.html#style-config). If style is an array, later styles will override earlier styles. Any [mark properties](https://vega.github.io/vega-lite/docs/encoding.html#mark-prop) explicitly defined within the `encoding` will override a style default.
   *
   * __Default value:__ The mark's name. For example, a bar mark will have style `"bar"` by default.
   * __Note:__ Any specified style will augment the default style. For example, a bar mark with `"style": "foo"` will receive from `config.style.bar` and `config.style.foo` (the specified style `"foo"` has higher precedence).
   */
  style?: string | string[];

  /**
   * Whether a mark be clipped to the enclosing group’s width and height.
   */
  clip?: boolean;

  // Offset properties should not be a part of config

  /**
   * Offset for x-position.
   */
  xOffset?: number;

  /**
   * Offset for y-position.
   */
  yOffset?: number;

  /**
   * Offset for x2-position.
   */
  x2Offset?: number;

  /**
   * Offset for y2-position.
   */
  y2Offset?: number;
}

// Point/Line OverlayMixins are only for area, line, and trail but we don't want to declare multiple types of MarkDef

// Point/Line OverlayMixins are only for area, line, and trail but we don't want to declare multiple types of MarkDef
export interface MarkDef<M extends string | Mark = Mark>
  extends GenericMarkDef<M>,
    BarCornerRadiusMixins,
    RectBinSpacingMixins,
    MarkConfig,
    PointOverlayMixins,
    LineOverlayMixins,
    TickThicknessMixins,
    MarkDefMixins {}

const DEFAULT_RECT_BAND_SIZE = 5;

export const defaultBarConfig: RectConfig = {
  binSpacing: 1,
  continuousBandSize: DEFAULT_RECT_BAND_SIZE,
  timeUnitBandPosition: 0.5
};

export const defaultRectConfig: RectConfig = {
  binSpacing: 0,
  continuousBandSize: DEFAULT_RECT_BAND_SIZE,
  timeUnitBandPosition: 0.5
};

export interface TickConfig extends MarkConfig, TickThicknessMixins {
  /**
   * The width of the ticks.
   *
   * __Default value:__  3/4 of step (width step for horizontal ticks and height step for vertical ticks).
   * @minimum 0
   */
  bandSize?: number;
}

export const defaultTickConfig: TickConfig = {
  thickness: 1
};

export function getMarkType(m: string | GenericMarkDef<any>) {
  return isMarkDef(m) ? m.type : m;
}
