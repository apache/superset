import { utcFormat, timeFormat } from 'd3-time-format';
import { isRequired } from '@superset-ui/core';
import TimeFormatter from '../TimeFormatter';
import { LOCAL_PREFIX } from '../TimeFormats';

export default function createD3TimeFormatter({
  description,
  formatString = isRequired('formatString'),
  label,
  useLocalTime = false,
}) {
  const id = useLocalTime ? `${LOCAL_PREFIX}${formatString}` : formatString;
  const format = useLocalTime ? timeFormat : utcFormat;
  const formatFunc = format(formatString);

  return new TimeFormatter({
    description,
    formatFunc,
    id,
    label,
    useLocalTime,
  });
}
