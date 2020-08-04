import {getSign, ifX, ifY} from './axis-util';
import {Value, one, zero} from './constants';
import guideMark from './guide-mark';
import {lookup} from './guide-util';
import {addEncoders, encoder} from '../encode/util';
import {RuleMark} from '../marks/marktypes';
import {AxisTickRole} from '../marks/roles';

export default function(spec, config, userEncode, dataRef, size, band) {
  var _ = lookup(spec, config),
      orient = spec.orient,
      sign = getSign(orient, -1, 1),
      encode, enter, exit, update, tickSize, tickPos;

  encode = {
    enter: enter = {opacity: zero},
    update: update = {opacity: one},
    exit: exit = {opacity: zero}
  };

  addEncoders(encode, {
    stroke:           _('tickColor'),
    strokeCap:        _('tickCap'),
    strokeDash:       _('tickDash'),
    strokeDashOffset: _('tickDashOffset'),
    strokeOpacity:    _('tickOpacity'),
    strokeWidth:      _('tickWidth')
  });

  tickSize = encoder(size);
  tickSize.mult = sign;

  tickPos = {
    scale:  spec.scale,
    field:  Value,
    band:   band.band,
    extra:  band.extra,
    offset: band.offset,
    round:  _('tickRound')
  };

  update.y = enter.y = ifX(orient, zero, tickPos);
  update.y2 = enter.y2 = ifX(orient, tickSize);
  exit.x = ifX(orient, tickPos);

  update.x = enter.x = ifY(orient, zero, tickPos);
  update.x2 = enter.x2 = ifY(orient, tickSize);
  exit.y = ifY(orient, tickPos);

  return guideMark({
    type: RuleMark,
    role: AxisTickRole,
    key:  Value,
    from: dataRef,
    encode
  }, userEncode);
}
