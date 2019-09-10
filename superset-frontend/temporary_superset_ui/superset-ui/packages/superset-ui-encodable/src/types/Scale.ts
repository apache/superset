import {
  ScaleOrdinal,
  ScaleLinear,
  ScaleLogarithmic,
  ScalePower,
  ScaleTime,
  ScaleQuantile,
  ScaleQuantize,
  ScaleThreshold,
  ScalePoint,
  ScaleBand,
} from 'd3-scale';
import { Value, DateTime, NiceTime, ScaleType, Scale as VegaLiteScale } from './VegaLite';
import { HasToString } from './Base';

// Pick properties inherited from vega-lite
// and overrides a few properties.
// Then make the specific scales pick
// from this interface to share property documentation
// (which is useful for auto-complete/intellisense)
// and add `type` property as discriminant of union type.

export interface CombinedScaleConfig<Output extends Value = Value>
  extends Pick<
    VegaLiteScale,
    | 'align'
    | 'base'
    | 'clamp'
    | 'constant'
    | 'exponent'
    | 'interpolate'
    | 'padding'
    | 'paddingInner'
    | 'paddingOuter'
    | 'reverse'
    | 'round'
    | 'zero'
  > {
  // These fields have different types from original vega-lite
  /**
   * domain of the scale
   */
  domain?: number[] | string[] | boolean[] | DateTime[];
  /**
   * range of the scale
   */
  range?: Output[];
  /**
   * name of the color scheme.
   * vega-lite also support SchemeParams object
   * but encodable only accepts string at the moment
   */
  scheme?: string;
  /**
   * color namespace.
   * vega-lite does not have this field
   */
  namespace?: string;
  /**
   * Extending the domain so that it starts and ends on nice round values. This method typically modifies the scale’s domain, and may only extend the bounds to the nearest round value. Nicing is useful if the domain is computed from data and may be irregular. For example, for a domain of _[0.201479…, 0.996679…]_, a nice domain might be _[0.2, 1.0]_.
   *
   * For quantitative scales such as linear, `nice` can be either a boolean flag or a number. If `nice` is a number, it will represent a desired tick count. This allows greater control over the step size used to extend the bounds, guaranteeing that the returned ticks will exactly cover the domain.
   *
   * For temporal fields with time and utc scales, the `nice` value can be a string indicating the desired time interval. Legal values are `"millisecond"`, `"second"`, `"minute"`, `"hour"`, `"day"`, `"week"`, `"month"`, and `"year"`. Alternatively, `time` and `utc` scales can accept an object-valued interval specifier of the form `{"interval": "month", "step": 3}`, which includes a desired number of interval steps. Here, the domain would snap to quarter (Jan, Apr, Jul, Oct) boundaries.
   *
   * __Default value:__ `true` for unbinned _quantitative_ fields; `false` otherwise.
   *
   */
  nice?: boolean | number | NiceTime | { interval: NiceTime; step: number };
}

type PickFromCombinedScaleConfig<
  Output extends Value,
  Fields extends keyof CombinedScaleConfig
> = Pick<CombinedScaleConfig<Output>, 'domain' | 'range' | 'reverse' | Fields>;

export interface LinearScaleConfig<Output extends Value = Value>
  extends PickFromCombinedScaleConfig<
    Output,
    'clamp' | 'interpolate' | 'nice' | 'padding' | 'round' | 'scheme' | 'zero'
  > {
  type: 'linear';
}

export interface LogScaleConfig<Output extends Value = Value>
  extends PickFromCombinedScaleConfig<
    Output,
    'base' | 'clamp' | 'interpolate' | 'nice' | 'padding' | 'round' | 'scheme'
  > {
  type: 'log';
}

export interface PowScaleConfig<Output extends Value = Value>
  extends PickFromCombinedScaleConfig<
    Output,
    'clamp' | 'exponent' | 'interpolate' | 'nice' | 'padding' | 'round' | 'scheme' | 'zero'
  > {
  type: 'pow';
}

export interface SqrtScaleConfig<Output extends Value = Value>
  extends PickFromCombinedScaleConfig<
    Output,
    'clamp' | 'interpolate' | 'nice' | 'padding' | 'round' | 'scheme' | 'zero'
  > {
  type: 'sqrt';
}

export interface SymlogScaleConfig<Output extends Value = Value>
  extends PickFromCombinedScaleConfig<
    Output,
    'clamp' | 'constant' | 'interpolate' | 'nice' | 'padding' | 'round' | 'scheme' | 'zero'
  > {
  type: 'symlog';
}

interface BaseTimeScaleConfig<Output extends Value>
  extends PickFromCombinedScaleConfig<
    Output,
    'clamp' | 'interpolate' | 'nice' | 'padding' | 'round' | 'scheme'
  > {
  domain?: number[] | string[] | DateTime[];
}

export interface TimeScaleConfig<Output extends Value = Value> extends BaseTimeScaleConfig<Output> {
  type: 'time';
}

export interface UtcScaleConfig<Output extends Value = Value> extends BaseTimeScaleConfig<Output> {
  type: 'utc';
}

export interface QuantileScaleConfig<Output extends Value = Value>
  extends PickFromCombinedScaleConfig<Output, 'interpolate' | 'scheme'> {
  type: 'quantile';
}

export interface QuantizeScaleConfig<Output extends Value = Value>
  extends PickFromCombinedScaleConfig<Output, 'interpolate' | 'nice' | 'scheme' | 'zero'> {
  type: 'quantize';
}

export interface ThresholdScaleConfig<Output extends Value = Value>
  extends PickFromCombinedScaleConfig<Output, 'interpolate' | 'nice' | 'scheme'> {
  type: 'threshold';
}

export interface BinOrdinalScaleConfig<Output extends Value = Value>
  extends PickFromCombinedScaleConfig<Output, 'interpolate' | 'scheme'> {
  type: 'bin-ordinal';
}

export interface OrdinalScaleConfig<Output extends Value = Value>
  extends PickFromCombinedScaleConfig<Output, 'interpolate' | 'scheme' | 'namespace'> {
  type: 'ordinal';
}

export interface PointScaleConfig<Output extends Value = Value>
  extends PickFromCombinedScaleConfig<Output, 'align' | 'padding' | 'round'> {
  type: 'point';
}

export interface BandScaleConfig<Output extends Value = Value>
  extends PickFromCombinedScaleConfig<
    Output,
    'align' | 'padding' | 'paddingInner' | 'paddingOuter' | 'round'
  > {
  type: 'band';
}

export type ScaleConfig<Output extends Value = Value> =
  | LinearScaleConfig<Output>
  | LogScaleConfig<Output>
  | PowScaleConfig<Output>
  | SqrtScaleConfig<Output>
  | SymlogScaleConfig<Output>
  | TimeScaleConfig<Output>
  | UtcScaleConfig<Output>
  | QuantileScaleConfig<Output>
  | QuantizeScaleConfig<Output>
  | ThresholdScaleConfig<Output>
  | BinOrdinalScaleConfig<Output>
  | OrdinalScaleConfig<Output>
  | PointScaleConfig<Output>
  | BandScaleConfig<Output>;

export interface WithScale<Output extends Value = Value> {
  scale?: Partial<ScaleConfig<Output>>;
}

/** Each ScaleCategory contains one or more ScaleType */
export type ScaleCategory = 'continuous' | 'discrete' | 'discretizing';

export interface ScaleTypeToD3ScaleType<Output extends Value = Value> {
  [ScaleType.LINEAR]: ScaleLinear<Output, Output>;
  [ScaleType.LOG]: ScaleLogarithmic<Output, Output>;
  [ScaleType.POW]: ScalePower<Output, Output>;
  [ScaleType.SQRT]: ScalePower<Output, Output>;
  [ScaleType.SYMLOG]: ScaleLogarithmic<Output, Output>;
  [ScaleType.TIME]: ScaleTime<Output, Output>;
  [ScaleType.UTC]: ScaleTime<Output, Output>;
  [ScaleType.QUANTILE]: ScaleQuantile<Output>;
  [ScaleType.QUANTIZE]: ScaleQuantize<Output>;
  [ScaleType.THRESHOLD]: ScaleThreshold<number | string | Date, Output>;
  [ScaleType.BIN_ORDINAL]: ScaleOrdinal<HasToString, Output>;
  [ScaleType.ORDINAL]: ScaleOrdinal<HasToString, Output>;
  [ScaleType.POINT]: ScalePoint<HasToString>;
  [ScaleType.BAND]: ScaleBand<HasToString>;
}

export type ContinuousD3Scale<Output extends Value = Value> =
  | ScaleLinear<Output, Output>
  | ScaleLogarithmic<Output, Output>
  | ScalePower<Output, Output>
  | ScaleTime<Output, Output>;

export type D3Scale<Output extends Value = Value> =
  | ContinuousD3Scale<Output>
  | ScaleQuantile<Output>
  | ScaleQuantize<Output>
  | ScaleThreshold<number | string | Date, Output>
  | ScaleOrdinal<HasToString, Output>
  | ScalePoint<HasToString>
  | ScaleBand<HasToString>;
