import {getScale} from '../scales';
import {scale as get, scaleFraction} from 'vega-scale';
import {Gradient} from 'vega-scenegraph';
import {identity, peek} from 'vega-util';

export default function(scale, p0, p1, count, group) {
  scale = getScale(scale, (group || this).context);

  const gradient = Gradient(p0, p1);

  let stops = scale.domain(),
      min = stops[0],
      max = peek(stops),
      fraction = identity;

  if (!(max - min)) {
    // expand scale if domain has zero span, fix #1479
    scale = (scale.interpolator
      ? get('sequential')().interpolator(scale.interpolator())
      : get('linear')().interpolate(scale.interpolate()).range(scale.range())
    ).domain([min=0, max=1]);
  } else {
    fraction = scaleFraction(scale, min, max);
  }

  if (scale.ticks) {
    stops = scale.ticks(+count || 15);
    if (min !== stops[0]) stops.unshift(min);
    if (max !== peek(stops)) stops.push(max);
  }

  stops.forEach(_ => gradient.stop(fraction(_), scale(_)));

  return gradient;
}
