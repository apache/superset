import { Value } from '../../types/VegaLite';
import { ScaleConfig, D3Scale, ContinuousD3Scale } from '../../types/Scale';

export default function applyZero<Output extends Value>(
  config: ScaleConfig<Output>,
  scale: D3Scale<Output>,
) {
  if ('zero' in config && config.zero === true) {
    const [min, max] = (scale as ContinuousD3Scale<Output>).domain() as number[];
    scale.domain([Math.min(0, min), Math.max(0, max)]);
  }
}
