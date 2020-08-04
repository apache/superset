import {isArray, isDate, isObject} from 'vega-util';

export default function(handler, event, item, value) {
  var el = handler.element();
  if (el) el.setAttribute('title', formatTooltip(value));
}

function formatTooltip(value) {
  return value == null ? ''
    : isArray(value) ? formatArray(value)
    : isObject(value) && !isDate(value) ? formatObject(value)
    : value + '';
}

function formatObject(obj) {
  return Object.keys(obj).map(function(key) {
    var v = obj[key];
    return key + ': ' + (isArray(v) ? formatArray(v) : formatValue(v));
  }).join('\n');
}

function formatArray(value) {
  return '[' + value.map(formatValue).join(', ') + ']';
}

function formatValue(value) {
  return isArray(value) ? '[\u2026]'
    : isObject(value) && !isDate(value) ? '{\u2026}'
    : value;
}
