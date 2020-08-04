import {Center, End, Left, Right, Start, Vertical} from './constants';
import {value} from '../../util';
import {isObject, stringValue} from 'vega-util';

export function lookup(spec, config) {
  const _ = (name, dflt) => value(spec[name], value(config[name], dflt));

  _.isVertical = s => Vertical === value(
    spec.direction,
    config.direction || (s ? config.symbolDirection : config.gradientDirection)
  );

  _.gradientLength = () => value(
    spec.gradientLength,
    config.gradientLength || config.gradientWidth
  );

  _.gradientThickness = () => value(
    spec.gradientThickness,
    config.gradientThickness || config.gradientHeight
  );

  _.entryColumns = () => value(
    spec.columns,
    value(config.columns, +_.isVertical(true))
  );

  return _;
}

export function getEncoding(name, encode) {
  var v = encode && (
    (encode.update && encode.update[name]) ||
    (encode.enter && encode.enter[name])
  );
  return v && v.signal ? v : v ? v.value : null;
}

export function getStyle(name, scope, style) {
  var s = scope.config.style[style];
  return s && s[name];
}

export function anchorExpr(s, e, m) {
  return `item.anchor === '${Start}' ? ${s} : item.anchor === '${End}' ? ${e} : ${m}`;
}

export const alignExpr = anchorExpr(
  stringValue(Left),
  stringValue(Right),
  stringValue(Center)
);

export function tickBand(_) {
  let v = _('tickBand'),
      offset = _('tickOffset'),
      band, extra;

  if (!v) {
    // if no tick band entry, fall back on other properties
    band = _('bandPosition');
    extra = _('tickExtra');
  } else if (v.signal) {
    // if signal, augment code to interpret values
    band = {signal: `(${v.signal}) === 'extent' ? 1 : 0.5`};
    extra = {signal: `(${v.signal}) === 'extent'`};
    if (!isObject(offset)) {
      offset = {signal: `(${v.signal}) === 'extent' ? 0 : ${offset}`};
    }
  } else if (v === 'extent') {
    // if constant, simply set values
    band = 1;
    extra = true;
    offset = 0;
  } else {
    band = 0.5;
    extra = false;
  }

  return {extra, band, offset};
}

export function extendOffset(value, offset) {
  return !offset ? value
    : !value ? offset
    : !isObject(value) ? { value, offset }
    : Object.assign({}, value, { offset: extendOffset(value.offset, offset) });
}
