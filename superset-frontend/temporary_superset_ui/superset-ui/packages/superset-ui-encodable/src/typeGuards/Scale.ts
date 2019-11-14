import { CategoricalColorScale } from '@superset-ui/color';
import { ScaleTime } from 'd3-scale';
import {
  D3Scale,
  ScaleConfig,
  LinearScaleConfig,
  LogScaleConfig,
  PowScaleConfig,
  SqrtScaleConfig,
  SymlogScaleConfig,
  TimeScaleConfig,
  UtcScaleConfig,
  ContinuousD3Scale,
} from '../types/Scale';
import { Value, ScaleType } from '../types/VegaLite';
import { timeScaleTypesSet, continuousScaleTypesSet } from '../parsers/scale/scaleCategories';
import isPropertySupportedByScaleType from '../parsers/scale/isPropertySupportedByScaleType';

export function isContinuousScaleConfig<Output extends Value = Value>(
  config: ScaleConfig,
): config is
  | LinearScaleConfig<Output>
  | LogScaleConfig<Output>
  | PowScaleConfig<Output>
  | SqrtScaleConfig<Output>
  | SymlogScaleConfig<Output>
  | TimeScaleConfig<Output>
  | UtcScaleConfig<Output> {
  return continuousScaleTypesSet.has(config.type);
}

export function isScaleConfigWithZero<Output extends Value = Value>(
  config: ScaleConfig,
): config is
  | LinearScaleConfig<Output>
  | PowScaleConfig<Output>
  | SqrtScaleConfig<Output>
  | SymlogScaleConfig<Output> {
  return isPropertySupportedByScaleType('zero', config.type);
}

export function isCategoricalColorScale<Output extends Value = Value>(
  scale: D3Scale<Output> | CategoricalColorScale,
): scale is CategoricalColorScale {
  return scale instanceof CategoricalColorScale;
}

export function isD3Scale<Output extends Value = Value>(
  scale: D3Scale<Output> | CategoricalColorScale,
): scale is D3Scale<Output> {
  return !isCategoricalColorScale(scale);
}

export function isContinuousScale<Output extends Value = Value>(
  scale: D3Scale<Output> | CategoricalColorScale,
  scaleType: ScaleType,
): scale is ContinuousD3Scale<Output> {
  return scale && continuousScaleTypesSet.has(scaleType);
}

export function isTimeScale<Output extends Value = Value>(
  scale: D3Scale<Output> | CategoricalColorScale,
  scaleType: ScaleType,
): scale is ScaleTime<Output, Output> {
  return scale && timeScaleTypesSet.has(scaleType);
}
