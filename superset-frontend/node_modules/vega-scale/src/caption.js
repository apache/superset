import {labelFormat, labelValues} from './labels';
import {Time, UTC} from './scales/types';
import {isDiscrete, isDiscretizing, isTemporal} from './scales';
import {isString, peek} from 'vega-util';

function format(locale, scale, specifier, formatType) {
  const type = formatType || scale.type;

  // replace abbreviated time specifiers to improve screen reader experience
  if (isString(specifier) && isTemporal(type)) {
    specifier = specifier.replace(/%a/g, '%A').replace(/%b/g, '%B');
  }

  return !specifier && type === Time  ? locale.timeFormat('%A, %d %B %Y, %X')
    : !specifier && type === UTC ? locale.utcFormat('%A, %d %B %Y, %X UTC')
    : labelFormat(locale, scale, 5, null, specifier, formatType, true);
}

export function domainCaption(locale, scale, opt) {
  opt = opt || {};
  const max = Math.max(3, opt.maxlen || 7),
        fmt = format(locale, scale, opt.format, opt.formatType);

  // if scale breaks domain into bins, describe boundaries
  if (isDiscretizing(scale.type)) {
    const v = labelValues(scale).slice(1).map(fmt),
          n = v.length;
    return `${n} boundar${n === 1 ? 'y' : 'ies'}: ${v.join(', ')}`;
  }

  // if scale domain is discrete, list values
  else if (isDiscrete(scale.type)) {
    const d = scale.domain(),
          n = d.length,
          v = n > max
            ? d.slice(0, max - 2).map(fmt).join(', ')
              + ', ending with ' + d.slice(-1).map(fmt)
            : d.map(fmt).join(', ');
    return `${n} value${n === 1 ? '' : 's'}: ${v}`;
  }

  // if scale domain is continuous, describe value range
  else {
    const d = scale.domain();
    return `values from ${fmt(d[0])} to ${fmt(peek(d))}`;
  }
}
