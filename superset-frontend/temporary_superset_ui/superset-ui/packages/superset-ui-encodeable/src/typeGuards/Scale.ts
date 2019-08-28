import { CategoricalColorScale } from '@superset-ui/color';
import { ScaleTime } from 'd3-scale';
import { D3Scale } from '../types/Scale';
import { Value, ScaleType } from '../types/VegaLite';
import { timeScaleTypesSet } from '../parsers/scale/scaleCategories';

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

export function isTimeScale<Output extends Value = Value>(
  scale: D3Scale<Output> | CategoricalColorScale,
  scaleType: ScaleType,
): scale is ScaleTime<Output, Output> {
  return scale && timeScaleTypesSet.has(scaleType);
}
