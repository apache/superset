import {Perc, Perc2, Value, one, zero} from './constants';
import guideMark from './guide-mark';
import {lookup} from './guide-util';
import {addEncoders, encoder} from '../encode/util';
import {RectMark} from '../marks/marktypes';
import {LegendBandRole} from '../marks/roles';
import {extend} from 'vega-util';

export default function(spec, scale, config, userEncode, dataRef) {
  var _ = lookup(spec, config),
      vertical = _.isVertical(),
      thickness = _.gradientThickness(),
      length = _.gradientLength(),
      encode, enter, u, v, uu, vv, adjust = '';

  vertical
    ? (u = 'y', uu = 'y2', v = 'x', vv = 'width', adjust = '1-')
    : (u = 'x', uu = 'x2', v = 'y', vv = 'height');

  enter = {
    opacity: zero,
    fill: {scale: scale, field: Value}
  };
  enter[u]  = {signal: adjust + 'datum.' + Perc, mult: length};
  enter[v]  = zero;
  enter[uu] = {signal: adjust + 'datum.' + Perc2, mult: length};
  enter[vv] = encoder(thickness);

  encode = {
    enter: enter,
    update: extend({}, enter, {opacity: one}),
    exit: {opacity: zero}
  };

  addEncoders(encode, {
    stroke:      _('gradientStrokeColor'),
    strokeWidth: _('gradientStrokeWidth')
  }, { // update
    opacity:     _('gradientOpacity')
  });

  return guideMark({
    type: RectMark,
    role: LegendBandRole,
    key:  Value,
    from: dataRef,
    encode
  }, userEncode);
}
