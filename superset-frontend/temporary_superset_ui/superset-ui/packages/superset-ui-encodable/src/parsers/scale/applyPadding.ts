import { Value } from '../../types/VegaLite';
import { ScaleConfig, D3Scale } from '../../types/Scale';

export default function applyPadding<Output extends Value>(
  config: ScaleConfig<Output>,
  scale: D3Scale<Output>,
) {
  if ('padding' in config && typeof config.padding !== 'undefined' && 'padding' in scale) {
    scale.padding(config.padding);
  }

  if (
    'paddingInner' in config &&
    typeof config.paddingInner !== 'undefined' &&
    'paddingInner' in scale
  ) {
    scale.paddingInner(config.paddingInner);
  }

  if (
    'paddingOuter' in config &&
    typeof config.paddingOuter !== 'undefined' &&
    'paddingOuter' in scale
  ) {
    scale.paddingOuter(config.paddingOuter);
  }
}
