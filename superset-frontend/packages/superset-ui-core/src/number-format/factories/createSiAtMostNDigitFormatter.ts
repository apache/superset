import { format as d3Format } from 'd3-format';
import NumberFormatter from '../NumberFormatter';

export default function createSiAtMostNDigitFormatter(
  config: {
    description?: string;
    n?: number;
    id?: string;
    label?: string;
  } = {},
) {
  const { description, n = 3, id, label } = config;
  const siFormatter = d3Format(`.${n}s`);

  return new NumberFormatter({
    description,
    formatFunc: value => {
      const si = siFormatter(value);

      /* Removing trailing `.00` if any */
      return si.slice(-1) < 'A' ? parseFloat(si).toString() : si;
    },
    id: id ?? `si_at_most_${n}_digit`,
    label: label ?? `SI with at most ${n} significant digits`,
  });
}
