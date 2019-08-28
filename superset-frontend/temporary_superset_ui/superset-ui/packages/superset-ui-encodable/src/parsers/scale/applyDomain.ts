import { Value } from '../../types/VegaLite';
import { ScaleConfig, D3Scale, TimeScaleConfig } from '../../types/Scale';
import parseDateTime from '../parseDateTime';
import inferElementTypeFromUnionOfArrayTypes from '../../utils/inferElementTypeFromUnionOfArrayTypes';
import { isTimeScale } from '../../typeGuards/Scale';

export default function applyDomain<Output extends Value>(
  config: ScaleConfig<Output>,
  scale: D3Scale<Output>,
) {
  const { domain, reverse, type } = config;
  if (typeof domain !== 'undefined') {
    const processedDomain = reverse ? domain.slice().reverse() : domain;
    if (isTimeScale(scale, type)) {
      const timeDomain = processedDomain as TimeScaleConfig['domain'];
      scale.domain(inferElementTypeFromUnionOfArrayTypes(timeDomain).map(d => parseDateTime(d)));
    } else {
      scale.domain(processedDomain);
    }
  }
}
