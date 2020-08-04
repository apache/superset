import parseStream from './stream';
import {Scope, View} from '../util';
import {selector} from 'vega-event-selector';
import {parseExpression} from 'vega-functions';
import {array, error, extend, isString, stringValue} from 'vega-util';

// bypass expression parser for internal operator references
const OP_VALUE_EXPR = {
  code: '_.$value',
  ast: {type: 'Identifier', value: 'value'}
};

export default function(spec, scope, target) {
  var events = spec.events,
      update = spec.update,
      encode = spec.encode,
      sources = [],
      entry = {target: target};

  if (!events) {
    error('Signal update missing events specification.');
  }

  // interpret as an event selector string
  if (isString(events)) {
    events = selector(events, scope.isSubscope() ? Scope : View);
  }

  // separate event streams from signal updates
  events = array(events)
    .filter(s => s.signal || s.scale ? (sources.push(s), 0) : 1);

  // merge internal operator listeners
  if (sources.length > 1) {
    sources = [mergeSources(sources)];
  }

  // merge event streams, include as source
  if (events.length) {
    sources.push(events.length > 1 ? {merge: events} : events[0]);
  }

  if (encode != null) {
    if (update) error('Signal encode and update are mutually exclusive.');
    update = 'encode(item(),' + stringValue(encode) + ')';
  }

  // resolve update value
  entry.update = isString(update) ? parseExpression(update, scope)
    : update.expr != null ? parseExpression(update.expr, scope)
    : update.value != null ? update.value
    : update.signal != null ? {
        $expr:   OP_VALUE_EXPR,
        $params: {$value: scope.signalRef(update.signal)}
      }
    : error('Invalid signal update specification.');

  if (spec.force) {
    entry.options = {force: true};
  }

  sources.forEach(function(source) {
    scope.addUpdate(extend(streamSource(source, scope), entry));
  });
}

function streamSource(stream, scope) {
  return {
    source: stream.signal ? scope.signalRef(stream.signal)
          : stream.scale ? scope.scaleRef(stream.scale)
          : parseStream(stream, scope)
  };
}

function mergeSources(sources) {
  return {
    signal: '['
      + sources.map(s => s.scale ? 'scale("' + s.scale + '")' : s.signal)
      + ']'
  };
}
