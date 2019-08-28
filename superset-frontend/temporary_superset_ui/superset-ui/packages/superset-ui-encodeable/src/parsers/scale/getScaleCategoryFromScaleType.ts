import { ScaleType } from '../../types/VegaLite';
import {
  continuousScaleTypesSet,
  discreteScaleTypesSet,
  discretizingScaleTypesSet,
} from './scaleCategories';
import { ScaleCategory } from '../../types/Scale';

export default function getScaleCategoryFromScaleType(
  scaleType: ScaleType,
): ScaleCategory | undefined {
  if (continuousScaleTypesSet.has(scaleType)) {
    return 'continuous';
  }
  if (discreteScaleTypesSet.has(scaleType)) {
    return 'discrete';
  }
  if (discretizingScaleTypesSet.has(scaleType)) {
    return 'discretizing';
  }

  return undefined;
}
