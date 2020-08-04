import {dsvFormat} from 'd3-dsv';
import {extend, stringValue} from 'vega-util';

export function delimitedFormat(delimiter) {
  const parse = function(data, format) {
    const delim = {delimiter: delimiter};
    return dsv(data, format ? extend(format, delim) : delim);
  };

  parse.responseType = 'text';

  return parse;
}

export default function dsv(data, format) {
  if (format.header) {
    data = format.header
      .map(stringValue)
      .join(format.delimiter) + '\n' + data;
  }
  return dsvFormat(format.delimiter).parse(data + '');
}

dsv.responseType = 'text';
