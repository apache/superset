import {getSign, ifTop, ifX, ifY, mult, patch} from './axis-util';
import {Bottom, GuideTitleStyle, Top, one, zero} from './constants';
import guideMark from './guide-mark';
import {alignExpr, anchorExpr, lookup} from './guide-util';
import {addEncoders, encoder, has} from '../encode/util';
import {TextMark} from '../marks/marktypes';
import {AxisTitleRole} from '../marks/roles';
import {extend} from 'vega-util';

export default function(spec, config, userEncode, dataRef) {
  var _ = lookup(spec, config),
      orient = spec.orient,
      sign = getSign(orient, -1, 1),
      encode, enter, update, titlePos;

  encode = {
    enter: enter = {
      opacity: zero,
      anchor: encoder(_('titleAnchor', null)),
      align: {signal: alignExpr}
    },
    update: update = extend({}, enter, {
      opacity: one,
      text: encoder(spec.title)
    }),
    exit: {
      opacity: zero
    }
  };

  titlePos = {
    signal: `lerp(range("${spec.scale}"), ${anchorExpr(0, 1, 0.5)})`
  };

  update.x = ifX(orient, titlePos);
  update.y = ifY(orient, titlePos);
  enter.angle = ifX(orient, zero, mult(sign, 90));
  enter.baseline = ifX(orient, ifTop(orient, Bottom, Top), {value: Bottom});
  update.angle = enter.angle;
  update.baseline = enter.baseline;

  addEncoders(encode, {
    fill:        _('titleColor'),
    fillOpacity: _('titleOpacity'),
    font:        _('titleFont'),
    fontSize:    _('titleFontSize'),
    fontStyle:   _('titleFontStyle'),
    fontWeight:  _('titleFontWeight'),
    limit:       _('titleLimit'),
    lineHeight:  _('titleLineHeight')
  }, { // require update
    align:       _('titleAlign'),
    angle:       _('titleAngle'),
    baseline:    _('titleBaseline')
  });

  autoLayout(_, orient, encode, userEncode);
  encode.update.align = patch(encode.update.align, enter.align);
  encode.update.angle = patch(encode.update.angle, enter.angle);
  encode.update.baseline = patch(encode.update.baseline, enter.baseline);

  return guideMark({
    type:  TextMark,
    role:  AxisTitleRole,
    style: GuideTitleStyle,
    from:  dataRef,
    encode
  }, userEncode);
}

function autoLayout(_, orient, encode, userEncode) {
  const auto = (value, dim) => value != null
    ? (encode.update[dim] = patch(encoder(value), encode.update[dim]), false)
    : !has(dim, userEncode) ? true : false;

  const autoY = auto(_('titleX'), 'x'),
        autoX = auto(_('titleY'), 'y');

  encode.enter.auto = autoX === autoY
    ? encoder(autoX)
    : ifX(orient, encoder(autoX), encoder(autoY));
}
