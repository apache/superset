import { Value } from '../../types/VegaLite';
import { ScaleConfig, D3Scale } from '../../types/Scale';

export default function applyClamp<Output extends Value>(
  config: ScaleConfig<Output>,
  scale: D3Scale<Output>,
) {
  if ('clamp' in config && config.clamp === true && 'clamp' in scale) {
    scale.clamp(config.clamp);
  }
}
