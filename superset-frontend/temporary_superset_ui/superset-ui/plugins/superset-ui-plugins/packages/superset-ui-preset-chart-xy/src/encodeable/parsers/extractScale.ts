import { CategoricalColorNamespace } from '@superset-ui/color';
import { scaleOrdinal } from 'd3-scale';
import { Value } from 'vega-lite/build/src/fielddef';
import isEnabled from '../utils/isEnabled';
import { isScaleFieldDef, ChannelDef, isPositionFieldDef } from '../types/FieldDef';

export default function extractScale<Output extends Value = Value>(
  definition: ChannelDef<Output>,
  namespace?: string,
) {
  if (isScaleFieldDef<Output>(definition)) {
    const { scale, type } = definition;
    if (isEnabled(scale) && !isPositionFieldDef(definition)) {
      if (scale) {
        const { domain, range, scheme } = scale;
        if (type === 'nominal') {
          if (scheme) {
            return CategoricalColorNamespace.getScale(scheme, namespace);
          }

          const scaleFn = scaleOrdinal<any, Output>();
          if (domain) {
            scaleFn.domain(domain);
          }
          if (range) {
            scaleFn.range(range);
          }

          return scaleFn;
        }
      } else if (type === 'nominal') {
        return CategoricalColorNamespace.getScale(undefined, namespace);
      }
    }
  }

  return undefined;
}
