import { CategoricalColorNamespace } from '@superset-ui/color';
import { ScaleType, Value } from '../../types/VegaLite';
import { ScaleConfig } from '../../types/Scale';
import createScaleFromScaleType from './createScaleFromScaleType';
import applyNice from './applyNice';
import applyZero from './applyZero';
import applyInterpolate from './applyInterpolate';
import applyRound from './applyRound';
import applyDomain from './applyDomain';
import applyRange from './applyRange';
import applyPadding from './applyPadding';
import applyAlign from './applyAlign';
import applyClamp from './applyClamp';

export default function createScaleFromScaleConfig<Output extends Value>(
  config: ScaleConfig<Output>,
) {
  const { domain, range, reverse } = config;

  // Handle categorical color scales
  // An ordinal scale without specified range
  // is assumed to be a color scale.
  if (config.type === ScaleType.ORDINAL && typeof range === 'undefined') {
    const scheme = 'scheme' in config ? config.scheme : undefined;
    const namespace = 'namespace' in config ? config.namespace : undefined;
    const colorScale = CategoricalColorNamespace.getScale(scheme, namespace);

    // If domain is also provided,
    // ensure the nth item is assigned the nth color
    if (typeof domain !== 'undefined') {
      const { colors } = colorScale;
      (reverse ? domain.slice().reverse() : domain).forEach((value: any, index: number) => {
        colorScale.setColor(`${value}`, colors[index % colors.length]);
      });
    }

    // Need to manually cast here to make the unioned output types
    // considered function.
    // Otherwise have to add type guards before using the scale function.
    //
    //   const scaleFn = createScaleFromScaleConfig(...)
    //   if (isAFunction(scaleFn)) const encodedValue = scaleFn(10)
    //
    // CategoricalColorScale is actually a function,
    // but TypeScript is not smart enough to realize that by itself.
    return (colorScale as unknown) as (val?: any) => string;
  }

  const scale = createScaleFromScaleType(config);
  // domain and range apply to all scales
  applyDomain(config, scale);
  applyRange(config, scale);
  // Sort other properties alphabetically.
  applyAlign(config, scale);
  applyClamp(config, scale);
  applyInterpolate(config, scale);
  applyNice(config, scale);
  applyPadding(config, scale);
  applyRound(config, scale);
  applyZero(config, scale);

  return scale;
}
