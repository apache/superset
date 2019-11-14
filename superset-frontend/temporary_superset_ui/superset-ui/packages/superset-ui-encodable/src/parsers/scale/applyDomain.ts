import { isDateTime } from 'vega-lite/build/src/datetime';
import { Value } from '../../types/VegaLite';
import { ScaleConfig, D3Scale } from '../../types/Scale';
import parseDateTime from '../parseDateTime';
import inferElementTypeFromUnionOfArrayTypes from '../../utils/inferElementTypeFromUnionOfArrayTypes';
import { isEveryElementDefined } from '../../typeGuards/Base';

export default function applyDomain<Output extends Value>(
  config: ScaleConfig<Output>,
  scale: D3Scale<Output>,
) {
  const { domain, reverse } = config;
  if (typeof domain !== 'undefined' && domain.length > 0) {
    const processedDomain = inferElementTypeFromUnionOfArrayTypes(domain);

    // Only set domain if all items are defined
    if (isEveryElementDefined(processedDomain)) {
      scale.domain(
        (reverse ? processedDomain.slice().reverse() : processedDomain).map(d =>
          isDateTime(d) ? parseDateTime(d) : d,
        ),
      );
    }
  }
}
