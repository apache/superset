import { SignalRef } from '.';
import { Color } from './color';
import { Cursor, StrokeCap, StrokeJoin } from './config.d';
import { TitleAnchor } from './title';

export type Field = string | SignalRef | DatumFieldRef | GroupFieldRef | ParentFieldRef;

export interface DatumFieldRef {
  datum: Field;
}

export interface GroupFieldRef {
  group: Field;
  level?: number;
}

export interface ParentFieldRef {
  parent: Field;
  level?: number;
}

export type BaseValueRef<T> =
  | SignalRef
  | {
      value: T | null;
    }
  | {
      field: Field;
    };

export type ScaledValueRef<T> =
  | BaseValueRef<T>
  | {
      scale: Field;
      value: boolean | number | string | null;
    }
  | {
      scale: Field;
      field: Field;
    }
  | {
      scale: Field;
      band: boolean | number;
    }
  | {
      scale: Field;
      range: number | boolean;
    };

export type NumericValueRef = (ScaledValueRef<number> | {}) & {
  exponent?: number | NumericValueRef;
  mult?: number | NumericValueRef;
  offset?: number | NumericValueRef;
  round?: boolean;
  extra?: boolean;
};

export type StringValueRef = ScaledValueRef<string>;
export type SymbolShapeValueRef = ScaledValueRef<SymbolShape>;
export type FontWeightValueRef = ScaledValueRef<FontWeight>;
export type FontStyleValueRef = ScaledValueRef<FontStyle>;
export type AlignValueRef = ScaledValueRef<Align>;

export type StrokeCapValueRef = ScaledValueRef<StrokeCap>;
export type AnchorValueRef = ScaledValueRef<TitleAnchor>;
export type OrientValueRef = ScaledValueRef<Orient>;
export type TextBaselineValueRef = ScaledValueRef<TextBaseline>;
export type TextValueRef = ScaledValueRef<Text>;
export type BooleanValueRef = ScaledValueRef<boolean>;
export type ArrayValueRef = ScaledValueRef<any[]>;
export type ArbitraryValueRef = NumericValueRef | ColorValueRef | ScaledValueRef<any>;

export interface ColorRGB {
  r: NumericValueRef;
  g: NumericValueRef;
  b: NumericValueRef;
}
export interface ColorHSL {
  h: NumericValueRef;
  s: NumericValueRef;
  l: NumericValueRef;
}
export interface ColorLAB {
  l: NumericValueRef;
  a: NumericValueRef;
  b: NumericValueRef;
}
export interface ColorHCL {
  h: NumericValueRef;
  c: NumericValueRef;
  l: NumericValueRef;
}

export interface BaseGradient {
  /**
   * The type of gradient.
   */
  gradient: 'linear' | 'radial';
}

export interface GradientStop {
  /**
   * The offset fraction for the color stop, indicating its position within the gradient.
   */
  offset: number;
  /**
   * The color value at this point in the gradient.
   */
  color: Color;
}

export type Gradient = LinearGradient | RadialGradient;

export interface LinearGradient extends BaseGradient {
  /**
   * The type of gradient. Use `"linear"` for a linear gradient.
   */
  gradient: 'linear';
  /**
   * An array of gradient stops defining the gradient color sequence.
   */
  stops: GradientStop[];
  id?: string;
  /**
   * The starting x-coordinate, in normalized [0, 1] coordinates, of the linear gradient.
   *
   * __Default value:__ `0`
   */
  x1?: number;
  /**
   * The starting y-coordinate, in normalized [0, 1] coordinates, of the linear gradient.
   *
   * __Default value:__ `0`
   */
  y1?: number;
  /**
   * The ending x-coordinate, in normalized [0, 1] coordinates, of the linear gradient.
   *
   * __Default value:__ `1`
   */
  x2?: number;
  /**
   * The ending y-coordinate, in normalized [0, 1] coordinates, of the linear gradient.
   *
   * __Default value:__ `0`
   */
  y2?: number;
}

export interface RadialGradient extends BaseGradient {
  /**
   * The type of gradient. Use `"radial"` for a radial gradient.
   */
  gradient: 'radial';
  /**
   * An array of gradient stops defining the gradient color sequence.
   */
  stops: GradientStop[];
  id?: string;
  /**
   * The x-coordinate, in normalized [0, 1] coordinates, for the center of the inner circle for the gradient.
   *
   * __Default value:__ `0.5`
   */
  x1?: number;
  /**
   * The y-coordinate, in normalized [0, 1] coordinates, for the center of the inner circle for the gradient.
   *
   * __Default value:__ `0.5`
   */
  y1?: number;
  /**
   * The radius length, in normalized [0, 1] coordinates, of the inner circle for the gradient.
   *
   * __Default value:__ `0`
   */
  r1?: number;
  /**
   * The x-coordinate, in normalized [0, 1] coordinates, for the center of the outer circle for the gradient.
   *
   * __Default value:__ `0.5`
   */
  x2?: number;
  /**
   * The y-coordinate, in normalized [0, 1] coordinates, for the center of the outer circle for the gradient.
   *
   * __Default value:__ `0.5`
   */
  y2?: number;
  /**
   * The radius length, in normalized [0, 1] coordinates, of the outer circle for the gradient.
   *
   * __Default value:__ `0.5`
   */
  r2?: number;
}

export type ColorValueRef =
  | ScaledValueRef<Color>
  | { value: LinearGradient | RadialGradient }
  | {
      gradient: Field;
      start?: number[];
      stop?: number[];
      count?: number;
    }
  | {
      color: ColorRGB | ColorHSL | ColorLAB | ColorHCL;
    };

export type ProductionRule<T> =
  | T
  | ({
      test?: string;
    } & T)[];

export type Blend =
  | null
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface EncodeEntry {
  x?: ProductionRule<NumericValueRef>;
  x2?: ProductionRule<NumericValueRef>;
  xc?: ProductionRule<NumericValueRef>;
  width?: ProductionRule<NumericValueRef>;
  y?: ProductionRule<NumericValueRef>;
  y2?: ProductionRule<NumericValueRef>;
  yc?: ProductionRule<NumericValueRef>;
  height?: ProductionRule<NumericValueRef>;
  opacity?: ProductionRule<NumericValueRef>;
  fill?: ProductionRule<ColorValueRef>;
  fillOpacity?: ProductionRule<NumericValueRef>;
  stroke?: ProductionRule<ColorValueRef>;
  strokeWidth?: ProductionRule<NumericValueRef>;
  strokeOpacity?: ProductionRule<NumericValueRef>;
  strokeDash?: ProductionRule<ScaledValueRef<number[]>>;
  strokeDashOffset?: ProductionRule<NumericValueRef>;
  strokeCap?: ProductionRule<ScaledValueRef<StrokeCap>>;
  strokeJoin?: ProductionRule<ScaledValueRef<StrokeJoin>>;
  strokeMiterLimit?: ProductionRule<NumericValueRef>;
  blend?: ProductionRule<ScaledValueRef<Blend>>;
  cursor?: ProductionRule<ScaledValueRef<Cursor>>;
  tooltip?: ProductionRule<StringValueRef>;
  zindex?: ProductionRule<NumericValueRef>;
  /**
   * A boolean flag indicating if [ARIA attributes](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) should be included (SVG output only).
   * If `false`, the "aria-hidden" attribute will be set on the output SVG element, removing the mark item from the ARIA accessibility tree.
   */
  aria?: ProductionRule<BooleanValueRef>;
  /**
   * Sets the type of user interface element of the mark item for [ARIA accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) (SVG output only).
   * If specified, this property determines the "role" attribute.
   * Warning: this property is experimental and may be changed in the future.
   */
  ariaRole?: ProductionRule<StringValueRef>;
  /**
   * A human-readable, author-localized description for the role of the mark item for [ARIA accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) (SVG output only).
   * If specified, this property determines the "aria-roledescription" attribute.
   * Warning: this property is experimental and may be changed in the future.
   */
  ariaRoleDescription?: ProductionRule<StringValueRef>;
  /**
   * A text description of the mark item for [ARIA accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) (SVG output only).
   * If specified, this property determines the ["aria-label" attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-label_attribute).
   */
  description?: ProductionRule<StringValueRef>;
  [k: string]: ProductionRule<ArbitraryValueRef> | undefined;
}

export type Align = 'left' | 'center' | 'right';
export interface AlignProperty {
  align?: ProductionRule<ScaledValueRef<Align>>;
}

export type Orient = 'left' | 'right' | 'top' | 'bottom';

export interface DefinedProperty {
  defined?: ProductionRule<BooleanValueRef>;
}

export interface ThetaProperty {
  theta?: ProductionRule<NumericValueRef>;
}

export interface ArcEncodeEntry extends EncodeEntry {
  startAngle?: ProductionRule<NumericValueRef>;
  endAngle?: ProductionRule<NumericValueRef>;
  padAngle?: ProductionRule<NumericValueRef>;
  innerRadius?: ProductionRule<NumericValueRef>;
  outerRadius?: ProductionRule<NumericValueRef>;
  cornerRadius?: ProductionRule<NumericValueRef>;
}

export type Orientation = 'horizontal' | 'vertical';

export interface AreaEncodeEntry extends LineEncodeEntry {
  orient?: ProductionRule<ScaledValueRef<Orientation>>;
}

export interface GroupEncodeEntry extends RectEncodeEntry {
  clip?: ProductionRule<BooleanValueRef>;
  strokeForeground?: ProductionRule<BooleanValueRef>;
  strokeOffset?: ProductionRule<NumericValueRef>;
}

export type Baseline = 'top' | 'middle' | 'bottom';

export interface ImageEncodeEntry extends EncodeEntry, AlignProperty {
  url?: ProductionRule<StringValueRef>;
  aspect?: ProductionRule<BooleanValueRef>;
  baseline?: ProductionRule<ScaledValueRef<Baseline>>;
  smooth?: ProductionRule<BooleanValueRef>;
}

/**
 * @TJS-type integer
 * @minimum 100
 * @maximum 900
 */
export type Interpolate =
  | 'basis'
  | 'basis-open'
  | 'basis-closed'
  | 'bundle'
  | 'cardinal'
  | 'cardinal-open'
  | 'cardinal-closed'
  | 'catmull-rom'
  | 'linear'
  | 'linear-closed'
  | 'monotone'
  | 'natural'
  | 'step'
  | 'step-before'
  | 'step-after';

export interface LineEncodeEntry extends EncodeEntry, DefinedProperty {
  interpolate?: ProductionRule<ScaledValueRef<Interpolate>>;
  tension?: ProductionRule<NumericValueRef>;
}

export interface PathEncodeEntry extends EncodeEntry {
  path?: ProductionRule<StringValueRef>;
  angle?: ProductionRule<NumericValueRef>;
  scaleX?: ProductionRule<NumericValueRef>;
  scaleY?: ProductionRule<NumericValueRef>;
}

export interface RectEncodeEntry extends EncodeEntry {
  cornerRadius?: ProductionRule<NumericValueRef>;
  cornerRadiusTopLeft?: ProductionRule<NumericValueRef>;
  cornerRadiusTopRight?: ProductionRule<NumericValueRef>;
  cornerRadiusBottomRight?: ProductionRule<NumericValueRef>;
  cornerRadiusBottomLeft?: ProductionRule<NumericValueRef>;
}

export type RuleEncodeEntry = EncodeEntry;

export interface ShapeEncodeEntry extends EncodeEntry {
  shape?: ProductionRule<StringValueRef>;
}

export type SymbolShape =
  | 'circle'
  | 'square'
  | 'cross'
  | 'diamond'
  | 'triangle-up'
  | 'triangle-down'
  | 'triangle-right'
  | 'triangle-left'
  | 'arrow'
  | 'triangle'
  | 'wedge'
  | 'stroke'
  | string;

export interface SymbolEncodeEntry extends EncodeEntry {
  size?: ProductionRule<NumericValueRef>;
  shape?: ProductionRule<ScaledValueRef<SymbolShape>>;
  angle?: ProductionRule<NumericValueRef>;
}

export type Text = string | string[];

export type TextBaseline = 'alphabetic' | Baseline | 'line-top' | 'line-bottom';

export type TextDirection = 'ltr' | 'rtl';

export type FontWeight =
  | 'normal'
  | 'bold'
  | 'lighter'
  | 'bolder'
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900;

// see https://developer.mozilla.org/en-US/docs/Web/CSS/font-style#Values
export type FontStyle = 'normal' | 'italic' | 'oblique' | string;

export interface TextEncodeEntry extends EncodeEntry, AlignProperty, ThetaProperty {
  text?: ProductionRule<TextValueRef>;
  angle?: ProductionRule<NumericValueRef>;
  baseline?: ProductionRule<TextBaselineValueRef>;
  dir?: ProductionRule<ScaledValueRef<TextDirection>>;
  dx?: ProductionRule<NumericValueRef>;
  dy?: ProductionRule<NumericValueRef>;
  ellipsis?: ProductionRule<StringValueRef>;
  font?: ProductionRule<StringValueRef>;
  fontSize?: ProductionRule<NumericValueRef>;
  fontWeight?: ProductionRule<FontWeightValueRef>;
  fontStyle?: ProductionRule<FontStyleValueRef>;
  limit?: ProductionRule<NumericValueRef>;
  lineBreak?: ProductionRule<StringValueRef>;

  /**
   * The height, in pixels, of each line of text in a multi-line text mark or a text mark with `"line-top"` or `"line-bottom"` baseline.
   */
  lineHeight?: ProductionRule<NumericValueRef>;
  radius?: ProductionRule<NumericValueRef>;
}

export interface TrailEncodeEntry extends EncodeEntry, DefinedProperty {}

export interface Encodable<T> {
  encode?: Encode<T>;
}

export type Encode<T> = Partial<Record<EncodeEntryName, T>>;

export type EncodeEntryName =
  | 'enter'
  | 'update'
  | 'exit'
  | 'hover'
  | 'leave'
  | 'select'
  | 'release';
