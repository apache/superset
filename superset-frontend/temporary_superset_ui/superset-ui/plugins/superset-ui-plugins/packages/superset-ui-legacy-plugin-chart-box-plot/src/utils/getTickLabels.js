/* eslint-disable no-magic-numbers */
import identity from '@vx/axis/build/utils/identity';

export default function getTickLabels(scale, axisConfig) {
  const { numTicks = 10, tickValues, tickFormat } = axisConfig;
  let values = scale.ticks ? scale.ticks(numTicks) : scale.domain();
  if (tickValues) values = tickValues;

  let format = scale.tickFormat ? scale.tickFormat() : identity;
  if (tickFormat) format = tickFormat;

  return values.map(format);
}
