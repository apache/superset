import {ifX, ifY} from './axis-util';
import {one, zero} from './constants';
import guideMark from './guide-mark';
import {lookup} from './guide-util';
import {addEncoders} from '../encode/util';
import {RuleMark} from '../marks/marktypes';
import {AxisDomainRole} from '../marks/roles';

export default function(spec, config, userEncode, dataRef) {
  var _ = lookup(spec, config),
      orient = spec.orient,
      encode, enter, update;

  encode = {
    enter: enter = {opacity: zero},
    update: update = {opacity: one},
    exit: {opacity: zero}
  };

  addEncoders(encode, {
    stroke:           _('domainColor'),
    strokeCap:        _('domainCap'),
    strokeDash:       _('domainDash'),
    strokeDashOffset: _('domainDashOffset'),
    strokeWidth:      _('domainWidth'),
    strokeOpacity:    _('domainOpacity')
  });

  const pos0 = position(spec, 0);
  const pos1 = position(spec, 1);

  enter.x = update.x = ifX(orient, pos0, zero);
  enter.x2 = update.x2 = ifX(orient, pos1);

  enter.y = update.y = ifY(orient, pos0, zero);
  enter.y2 = update.y2 = ifY(orient, pos1);

  return guideMark({
    type: RuleMark,
    role: AxisDomainRole,
    from: dataRef,
    encode
  }, userEncode);
}

function position(spec, pos) {
  return {scale: spec.scale, range: pos};
}
