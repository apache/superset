import {has} from './util';
import {FrameRole, MarkRole} from '../marks/roles';
import {array, extend} from 'vega-util';

export default function(encode, type, role, style, config) {
  const defaults = {}, enter = {};
  let update, key, skip, props;

  // if text mark, apply global lineBreak settings (#2370)
  key = 'lineBreak';
  if (type === 'text' && config[key] != null && !has(key, encode)) {
    applyDefault(defaults, key, config[key]);
  }

  // ignore legend and axis roles
  if (role == 'legend' || String(role).startsWith('axis')) {
    role = null;
  }

  // resolve mark config
  props = role === FrameRole ? config.group
    : (role === MarkRole) ? extend({}, config.mark, config[type])
    : null;

  for (key in props) {
    // do not apply defaults if relevant fields are defined
    skip = has(key, encode)
      || (key === 'fill' || key === 'stroke')
      && (has('fill', encode) || has('stroke', encode));

    if (!skip) applyDefault(defaults, key, props[key]);
  }

  // resolve styles, apply with increasing precedence
  array(style).forEach(name => {
    const props = config.style && config.style[name];
    for (const key in props) {
      if (!has(key, encode)) {
        applyDefault(defaults, key, props[key]);
      }
    }
  });

  encode = extend({}, encode); // defensive copy
  for (key in defaults) {
    props = defaults[key];
    if (props.signal) {
      (update = update || {})[key] = props;
    } else {
      enter[key] = props;
    }
  }

  encode.enter = extend(enter, encode.enter);
  if (update) encode.update = extend(update, encode.update);

  return encode;
}

function applyDefault(defaults, key, value) {
  defaults[key] = value && value.signal
    ? {signal: value.signal}
    : {value: value};
}
