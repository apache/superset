import {getSign, ifRight, ifTop, ifX, ifY, patch} from './axis-util';
import {GuideLabelStyle, Label, Value, one, zero} from './constants';
import guideMark from './guide-mark';
import {extendOffset, lookup} from './guide-util';
import {addEncoders, encoder} from '../encode/util';
import {TextMark} from '../marks/marktypes';
import {AxisLabelRole} from '../marks/roles';
import {deref} from '../../util';

function flushExpr(scale, threshold, a, b, c) {
  return {
    signal: 'flush(range("' + scale + '"), '
      + 'scale("' + scale + '", datum.value), '
      + threshold + ',' + a + ',' + b + ',' + c + ')'
  };
}

export default function(spec, config, userEncode, dataRef, size, band) {
  var _ = lookup(spec, config),
      orient = spec.orient,
      scale = spec.scale,
      sign = getSign(orient, -1, 1),
      flush = deref(_('labelFlush')),
      flushOffset = deref(_('labelFlushOffset')),
      flushOn = flush === 0 || !!flush,
      labelAlign = _('labelAlign'),
      labelBaseline = _('labelBaseline'),
      encode, enter, update, tickSize, tickPos,
      align, baseline, bound, overlap, offsetExpr;

  tickSize = encoder(size);
  tickSize.mult = sign;
  tickSize.offset = encoder(_('labelPadding') || 0);
  tickSize.offset.mult = sign;

  tickPos = {
    scale:  scale,
    field:  Value,
    band:   0.5,
    offset: extendOffset(band.offset, _('labelOffset'))
  };

  align = ifX(orient,
    flushOn
      ? flushExpr(scale, flush, '"left"', '"right"', '"center"')
      : {value: 'center'},
    ifRight(orient, 'left', 'right')
  );

  baseline = ifX(orient,
    ifTop(orient, 'bottom', 'top'),
    flushOn
      ? flushExpr(scale, flush, '"top"', '"bottom"', '"middle"')
      : {value: 'middle'}
  );

  offsetExpr = flushExpr(scale, flush, `-(${flushOffset})`, flushOffset, 0);
  flushOn = flushOn && flushOffset;

  enter = {
    opacity: zero,
    x: ifX(orient, tickPos, tickSize),
    y: ifY(orient, tickPos, tickSize)
  };

  encode = {
    enter: enter,
    update: update = {
      opacity: one,
      text: {field: Label},
      x: enter.x,
      y: enter.y,
      align,
      baseline
    },
    exit: {
      opacity: zero,
      x: enter.x,
      y: enter.y
    }
  };

  addEncoders(encode, {
    dx: !labelAlign && flushOn ? ifX(orient, offsetExpr) : null,
    dy: !labelBaseline && flushOn ? ifY(orient, offsetExpr) : null
  });

  addEncoders(encode, {
    angle:       _('labelAngle'),
    fill:        _('labelColor'),
    fillOpacity: _('labelOpacity'),
    font:        _('labelFont'),
    fontSize:    _('labelFontSize'),
    fontWeight:  _('labelFontWeight'),
    fontStyle:   _('labelFontStyle'),
    limit:       _('labelLimit'),
    lineHeight:  _('labelLineHeight')
  }, {
    align:       labelAlign,
    baseline:    labelBaseline
  });

  bound   = _('labelBound');
  overlap = _('labelOverlap');

  // if overlap method or bound defined, request label overlap removal
  overlap = overlap || bound ? {
    separation: _('labelSeparation'),
    method: overlap,
    order: 'datum.index',
    bound: bound ? {scale, orient, tolerance: bound} : null
  } : undefined;

  if (update.align !== align) {
    update.align = patch(update.align, align);
  }
  if (update.baseline !== baseline) {
    update.baseline = patch(update.baseline, baseline);
  }

  return guideMark({
    type:  TextMark,
    role:  AxisLabelRole,
    style: GuideLabelStyle,
    key:   Value,
    from:  dataRef,
    encode,
    overlap
  }, userEncode);
}
