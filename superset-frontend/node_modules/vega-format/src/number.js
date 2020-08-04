import memoize from './memoize';
import {tickStep} from 'd3-array';
import {
  format as d3_format,
  formatLocale as d3_formatLocale,
  formatPrefix as d3_formatPrefix,
  formatSpecifier,
  precisionFixed,
  precisionPrefix,
  precisionRound
} from 'd3-format';

function trimZeroes(numberFormat, decimalChar) {
  return x => {
    var str = numberFormat(x),
        dec = str.indexOf(decimalChar),
        idx, end;

    if (dec < 0) return str;

    idx = rightmostDigit(str, dec);
    end = idx < str.length ? str.slice(idx) : '';
    while (--idx > dec) if (str[idx] !== '0') { ++idx; break; }

    return str.slice(0, idx) + end;
  };
}

function rightmostDigit(str, dec) {
  var i = str.lastIndexOf('e'), c;
  if (i > 0) return i;
  for (i=str.length; --i > dec;) {
    c = str.charCodeAt(i);
    if (c >= 48 && c <= 57) return i + 1; // is digit
  }
}

function numberLocale(locale) {
  const format = memoize(locale.format),
        formatPrefix = locale.formatPrefix;

  return {
    format,
    formatPrefix,
    formatFloat(spec) {
      var s = formatSpecifier(spec || ',');
      if (s.precision == null) {
        s.precision = 12;
        switch (s.type) {
          case '%': s.precision -= 2; break;
          case 'e': s.precision -= 1; break;
        }
        return trimZeroes(
          format(s),          // number format
          format('.1f')(1)[1] // decimal point character
        );
      } else {
        return format(s);
      }
    },
    formatSpan(start, stop, count, specifier) {
      specifier = formatSpecifier(specifier == null ? ',f' : specifier);
      const step = tickStep(start, stop, count),
            value = Math.max(Math.abs(start), Math.abs(stop));
      let precision;

      if (specifier.precision == null) {
        switch (specifier.type) {
          case 's': {
            if (!isNaN(precision = precisionPrefix(step, value))) {
              specifier.precision = precision;
            }
            return formatPrefix(specifier, value);
          }
          case '':
          case 'e':
          case 'g':
          case 'p':
          case 'r': {
            if (!isNaN(precision = precisionRound(step, value))) {
              specifier.precision = precision - (specifier.type === 'e');
            }
            break;
          }
          case 'f':
          case '%': {
            if (!isNaN(precision = precisionFixed(step))) {
              specifier.precision = precision - (specifier.type === '%') * 2;
            }
            break;
          }
        }
      }
      return format(specifier);
    }
  };
}

let defaultNumberLocale;
resetNumberFormatDefaultLocale();

export function resetNumberFormatDefaultLocale() {
  return defaultNumberLocale = numberLocale({
    format: d3_format,
    formatPrefix: d3_formatPrefix
  });
}

export function numberFormatLocale(definition) {
  return numberLocale(d3_formatLocale(definition));
}

export function numberFormatDefaultLocale(definition) {
  return arguments.length
    ? (defaultNumberLocale = numberFormatLocale(definition))
    : defaultNumberLocale;
}
