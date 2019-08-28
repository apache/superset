import { interpolateRound } from 'd3-interpolate';
import { ScalePoint, ScaleBand } from 'd3-scale';
import { Value } from '../../types/VegaLite';
import { ScaleConfig, D3Scale, ContinuousD3Scale } from '../../types/Scale';
import { HasToString } from '../../types/Base';

export default function applyRound<Output extends Value>(
  config: ScaleConfig<Output>,
  scale: D3Scale<Output>,
) {
  if ('round' in config && typeof config.round !== 'undefined') {
    const roundableScale = scale as
      | ContinuousD3Scale<number>
      | ScalePoint<HasToString>
      | ScaleBand<HasToString>;
    if ('round' in roundableScale) {
      roundableScale.round(config.round);
    } else {
      roundableScale.interpolate(interpolateRound);
    }
  }
}
