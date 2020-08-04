import {error, isObject, isString, peek, splitAccessPath, stringValue} from 'vega-util';

const scaleRef = scale => isString(scale) ? stringValue(scale)
  : scale.signal ? `(${scale.signal})`
  : field(scale);

export default function entry(enc) {
  if (enc.gradient != null) {
    return gradient(enc);
  }

  let value = enc.signal ? `(${enc.signal})`
    : enc.color ? color(enc.color)
    : enc.field != null ? field(enc.field)
    : enc.value !== undefined ? stringValue(enc.value)
    : undefined;

  if (enc.scale != null) {
    value = scale(enc, value);
  }

  if (value === undefined) {
    value = null;
  }

  if (enc.exponent != null) {
    value = `pow(${value},${property(enc.exponent)})`;
  }

  if (enc.mult != null) {
    value += `*${property(enc.mult)}`;
  }

  if (enc.offset != null) {
    value += `+${property(enc.offset)}`;
  }

  if (enc.round) {
    value = `round(${value})`;
  }

  return value;
}

const _color = (type, x, y, z) =>
  `(${type}(${[x, y, z].map(entry).join(',')})+'')`;

function color(enc) {
  return (enc.c) ? _color('hcl', enc.h, enc.c, enc.l)
    : (enc.h || enc.s) ? _color('hsl', enc.h, enc.s, enc.l)
    : (enc.l || enc.a) ? _color('lab', enc.l, enc.a, enc.b)
    : (enc.r || enc.g || enc.b) ? _color('rgb', enc.r, enc.g, enc.b)
    : null;
}

function gradient(enc) {
  // map undefined to null; expression lang does not allow undefined
  const args = [enc.start, enc.stop, enc.count]
    .map(_ => _ == null ? null : stringValue(_));

  // trim null inputs from the end
  while (args.length && peek(args) == null) args.pop();

  args.unshift(scaleRef(enc.gradient));
  return `gradient(${args.join(',')})`;
}

function property(property) {
  return isObject(property) ? '(' + entry(property) + ')' : property;
}

function field(ref) {
  return resolveField(isObject(ref) ? ref : {datum: ref});
}

function resolveField(ref) {
  let object, level, field;

  if (ref.signal) {
    object = 'datum';
    field = ref.signal;
  } else if (ref.group || ref.parent) {
    level = Math.max(1, ref.level || 1);
    object = 'item';

    while (level-- > 0) {
      object += '.mark.group';
    }

    if (ref.parent) {
      field = ref.parent;
      object += '.datum';
    } else {
      field = ref.group;
    }
  } else if (ref.datum) {
    object = 'datum';
    field = ref.datum;
  } else {
    error('Invalid field reference: ' + stringValue(ref));
  }

  if (!ref.signal) {
    field = isString(field)
      ? splitAccessPath(field).map(stringValue).join('][')
      : resolveField(field);
  }

  return object + '[' + field + ']';
}

function scale(enc, value) {
  const scale = scaleRef(enc.scale);

  if (enc.range != null) {
    // pull value from scale range
    value = `lerp(_range(${scale}), ${+enc.range})`;
  } else {
    // run value through scale and/or pull scale bandwidth
    if (value !== undefined) value = `_scale(${scale}, ${value})`;

    if (enc.band) {
      value = (value ? value + '+' : '')
        + `_bandwidth(${scale})`
        + (+enc.band === 1 ? '' : '*' + property(enc.band));

      if (enc.extra) {
        // include logic to handle extraneous elements
        value = `(datum.extra ? _scale(${scale}, datum.extra.value) : ${value})`;
      }
    }

    if (value == null) value = '0';
  }

  return value;
}
