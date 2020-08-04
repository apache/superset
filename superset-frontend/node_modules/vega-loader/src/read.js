import {inferTypes, typeParsers} from './type';
import {formats} from './formats/index';
import {timeFormatDefaultLocale} from 'vega-format';
import {error, hasOwnProperty} from 'vega-util';

export default function(data, schema, timeParser, utcParser) {
  schema = schema || {};

  const reader = formats(schema.type || 'json');
  if (!reader) error('Unknown data format type: ' + schema.type);

  data = reader(data, schema);
  if (schema.parse) parse(data, schema.parse, timeParser, utcParser);

  if (hasOwnProperty(data, 'columns')) delete data.columns;
  return data;
}

function parse(data, types, timeParser, utcParser) {
  if (!data.length) return; // early exit for empty data

  const locale = timeFormatDefaultLocale();
  timeParser = timeParser || locale.timeParse;
  utcParser = utcParser || locale.utcParse;

  var fields = data.columns || Object.keys(data[0]),
      parsers, datum, field, i, j, n, m;

  if (types === 'auto') types = inferTypes(data, fields);

  fields = Object.keys(types);
  parsers = fields.map(function(field) {
    var type = types[field],
        parts, pattern;

    if (type && (type.startsWith('date:') || type.startsWith('utc:'))) {
      parts = type.split(/:(.+)?/, 2);  // split on first :
      pattern = parts[1];

      if ((pattern[0] === '\'' && pattern[pattern.length-1] === '\'') ||
          (pattern[0] === '"'  && pattern[pattern.length-1] === '"')) {
        pattern = pattern.slice(1, -1);
      }

      const parse = parts[0] === 'utc' ? utcParser : timeParser;
      return parse(pattern);
    }

    if (!typeParsers[type]) {
      throw Error('Illegal format pattern: ' + field + ':' + type);
    }

    return typeParsers[type];
  });

  for (i=0, n=data.length, m=fields.length; i<n; ++i) {
    datum = data[i];
    for (j=0; j<m; ++j) {
      field = fields[j];
      datum[field] = parsers[j](datum[field]);
    }
  }
}
