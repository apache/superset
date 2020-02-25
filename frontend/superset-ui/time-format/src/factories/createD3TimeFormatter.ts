import { utcFormat, timeFormat, timeFormatLocale, TimeLocaleDefinition } from 'd3-time-format';
import { isRequired } from '@superset-ui/core';
import TimeFormatter from '../TimeFormatter';
import { LOCAL_PREFIX } from '../TimeFormats';

export default function createD3TimeFormatter(config: {
  description?: string;
  formatString: string;
  label?: string;
  locale?: TimeLocaleDefinition;
  useLocalTime?: boolean;
}) {
  const {
    description,
    formatString = isRequired('formatString'),
    label,
    locale,
    useLocalTime = false,
  } = config;

  const id = useLocalTime ? `${LOCAL_PREFIX}${formatString}` : formatString;
  let formatFunc;

  if (typeof locale === 'undefined') {
    const format = useLocalTime ? timeFormat : utcFormat;
    formatFunc = format(formatString);
  } else {
    const localeObject = timeFormatLocale(locale);
    formatFunc = useLocalTime
      ? localeObject.format(formatString)
      : localeObject.utcFormat(formatString);
  }

  return new TimeFormatter({
    description,
    formatFunc,
    id,
    label,
    useLocalTime,
  });
}
