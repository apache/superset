import {delimitedFormat, default as dsv} from './dsv';
import json from './json';
import topojson from './topojson';
import {hasOwnProperty} from 'vega-util';

export const format = {
  dsv: dsv,
  csv: delimitedFormat(','),
  tsv: delimitedFormat('\t'),
  json: json,
  topojson: topojson
};

export function formats(name, reader) {
  if (arguments.length > 1) {
    format[name] = reader;
    return this;
  } else {
    return hasOwnProperty(format, name) ? format[name] : null;
  }
}

export function responseType(type) {
  const f = formats(type);
  return f && f.responseType || 'text';
}
