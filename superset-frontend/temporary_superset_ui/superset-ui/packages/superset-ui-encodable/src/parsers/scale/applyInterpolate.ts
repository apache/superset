import { Value } from '../../types/VegaLite';
import { ScaleConfig, D3Scale } from '../../types/Scale';

export default function applyInterpolate<Output extends Value>(
  config: ScaleConfig<Output>,
  scale: D3Scale<Output>,
) {
  if (
    'interpolate' in config &&
    typeof config.interpolate !== 'undefined' &&
    'interpolate' in scale
  ) {
    // TODO: Need to convert interpolate string into interpolate function
    throw new Error('"scale.interpolate" is not supported yet.');
  }
}
