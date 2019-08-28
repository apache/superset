import { getSequentialSchemeRegistry } from '@superset-ui/color';
import { Value } from '../../types/VegaLite';
import { ScaleConfig, D3Scale } from '../../types/Scale';

export default function applyRange<Output extends Value>(
  config: ScaleConfig<Output>,
  scale: D3Scale<Output>,
) {
  const { range } = config;
  if (typeof range === 'undefined') {
    if ('scheme' in config && typeof config.scheme !== 'undefined') {
      const { scheme } = config;
      const colorScheme = getSequentialSchemeRegistry().get(scheme);
      if (typeof colorScheme !== 'undefined') {
        scale.range(colorScheme.colors as Output[]);
      }
    }
  } else {
    scale.range(range);
  }
}
