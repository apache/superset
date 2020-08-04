import {field, identity, isFunction, isObject} from 'vega-util';

function isBuffer(_) {
  return (typeof Buffer === 'function' && isFunction(Buffer.isBuffer))
    ? Buffer.isBuffer(_) : false;
}

export default function json(data, format) {
  const prop = (format && format.property) ? field(format.property) : identity;
  return isObject(data) && !isBuffer(data)
    ? parseJSON(prop(data))
    : prop(JSON.parse(data));
}

json.responseType = 'json';

function parseJSON(data, format) {
  return (format && format.copy)
    ? JSON.parse(JSON.stringify(data))
    : data;
}
