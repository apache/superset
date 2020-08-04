import {getSign, ifX, ifY} from './axis-util';
import {Value, one, zero} from './constants';
import guideMark from './guide-mark';
import {lookup} from './guide-util';
import {addEncoders} from '../encode/util';
import {RuleMark} from '../marks/marktypes';
import {AxisGridRole} from '../marks/roles';
import {isSignal} from '../../util';
import {extend, isObject} from 'vega-util';

export default function(spec, config, userEncode, dataRef, band) {
  var _ = lookup(spec, config),
      orient = spec.orient,
      vscale = spec.gridScale,
      sign = getSign(orient, 1, -1),
      offset = offsetValue(spec.offset, sign),
      encode, enter, exit, update,
      tickPos, gridStart, gridEnd, sz;

  encode = {
    enter: enter = {opacity: zero},
    update: update = {opacity: one},
    exit: exit = {opacity: zero}
  };

  addEncoders(encode, {
    stroke:           _('gridColor'),
    strokeCap:        _('gridCap'),
    strokeDash:       _('gridDash'),
    strokeDashOffset: _('gridDashOffset'),
    strokeOpacity:    _('gridOpacity'),
    strokeWidth:      _('gridWidth')
  });

  tickPos = {
    scale:  spec.scale,
    field:  Value,
    band:   band.band,
    extra:  band.extra,
    offset: band.offset,
    round:  _('tickRound')
  };

  sz = ifX(orient, {signal: 'height'}, {signal: 'width'});

  gridStart = vscale
    ? {scale: vscale, range: 0, mult: sign, offset: offset}
    : {value: 0, offset: offset};

  gridEnd = vscale
    ? {scale: vscale, range: 1, mult: sign, offset: offset}
    : extend(sz, {mult: sign, offset: offset});

  enter.x = update.x = ifX(orient, tickPos, gridStart);
  enter.y = update.y = ifY(orient, tickPos, gridStart);
  enter.x2 = update.x2 = ifY(orient, gridEnd);
  enter.y2 = update.y2 = ifX(orient, gridEnd);
  exit.x = ifX(orient, tickPos);
  exit.y = ifY(orient, tickPos);

  return guideMark({
    type: RuleMark,
    role: AxisGridRole,
    key:  Value,
    from: dataRef,
    encode
   }, userEncode);
}

function offsetValue(offset, sign)  {
  if (sign === 1) {
    // no further adjustment needed, just return offset
  } else if (!isObject(offset)) {
    offset = isSignal(sign)
      ? {signal: `(${sign.signal}) * (${offset || 0})`}
      : sign * (offset || 0);
  } else {
    let entry = offset = extend({}, offset);
    while (entry.mult != null) {
      if (!isObject(entry.mult)) {
        entry.mult = isSignal(sign) // no offset if sign === 1
          ? {signal: `(${entry.mult}) * (${sign.signal})`}
          : entry.mult * sign;
        return offset;
      } else {
        entry = entry.mult = extend({}, entry.mult);
      }
    }
    entry.mult = sign;
  }

  return offset;
}
