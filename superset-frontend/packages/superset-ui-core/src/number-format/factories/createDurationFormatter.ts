import prettyMsFormatter from 'pretty-ms';
import NumberFormatter from '../NumberFormatter';

export default function createDurationFormatter(
  config: {
    description?: string;
    id?: string;
    label?: string;
    multiplier?: number;
  } & prettyMsFormatter.Options = {},
) {
  const { description, id, label, multiplier = 1, ...prettyMsOptions } = config;

  return new NumberFormatter({
    description,
    formatFunc: value => prettyMsFormatter(value * multiplier, prettyMsOptions),
    id: id ?? 'duration_format',
    label: label ?? `Duration formatter`,
  });
}
