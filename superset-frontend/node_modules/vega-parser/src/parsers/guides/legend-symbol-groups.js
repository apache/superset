import {
  GuideLabelStyle, Index, Label, LegendScales, Offset, Size, Skip,
  Value, one, zero
} from './constants';
import guideGroup from './guide-group';
import guideMark from './guide-mark';
import {lookup} from './guide-util';
import {addEncoders, encoder, extendEncode} from '../encode/util';
import {SymbolMark, TextMark} from '../marks/marktypes';
import {LegendLabelRole, LegendSymbolRole, ScopeRole} from '../marks/roles';

// userEncode is top-level, includes entries, symbols, labels
export default function(spec, config, userEncode, dataRef, columns) {
  var _ = lookup(spec, config),
      entries = userEncode.entries,
      interactive = !!(entries && entries.interactive),
      name = entries ? entries.name : undefined,
      height = _('clipHeight'),
      symbolOffset = _('symbolOffset'),
      valueRef = {data: 'value'},
      encode = {},
      xSignal = `(${columns}) ? datum.${Offset} : datum.${Size}`,
      yEncode = height ? encoder(height) : {field: Size},
      index = `datum.${Index}`,
      ncols = `max(1, ${columns})`,
      enter, update, labelOffset, symbols, labels, nrows, sort;

  yEncode.mult = 0.5;

  // -- LEGEND SYMBOLS --
  encode = {
    enter:  enter = {
      opacity: zero,
      x: {signal: xSignal, mult: 0.5, offset: symbolOffset},
      y: yEncode
    },
    update: update = {
      opacity: one,
      x: enter.x,
      y: enter.y
    },
    exit: {
      opacity: zero
    }
  };

  var baseFill = null,
      baseStroke = null;
  if (!spec.fill) {
    baseFill = config.symbolBaseFillColor;
    baseStroke = config.symbolBaseStrokeColor;
  }

  addEncoders(encode, {
    fill:             _('symbolFillColor', baseFill),
    shape:            _('symbolType'),
    size:             _('symbolSize'),
    stroke:           _('symbolStrokeColor', baseStroke),
    strokeDash:       _('symbolDash'),
    strokeDashOffset: _('symbolDashOffset'),
    strokeWidth:      _('symbolStrokeWidth')
  }, { // update
    opacity:          _('symbolOpacity')
  });

  LegendScales.forEach(function(scale) {
    if (spec[scale]) {
      update[scale] = enter[scale] = {scale: spec[scale], field: Value};
    }
  });

  symbols = guideMark({
    type: SymbolMark,
    role: LegendSymbolRole,
    key:  Value,
    from: valueRef,
    clip: height ? true : undefined,
    encode
  }, userEncode.symbols);

  // -- LEGEND LABELS --
  labelOffset = encoder(symbolOffset);
  labelOffset.offset = _('labelOffset');

  encode = {
    enter:  enter = {
      opacity: zero,
      x: {signal: xSignal, offset: labelOffset},
      y: yEncode
    },
    update: update = {
      opacity: one,
      text: {field: Label},
      x: enter.x,
      y: enter.y
    },
    exit: {
      opacity: zero
    }
  };

  addEncoders(encode, {
    align:       _('labelAlign'),
    baseline:    _('labelBaseline'),
    fill:        _('labelColor'),
    fillOpacity: _('labelOpacity'),
    font:        _('labelFont'),
    fontSize:    _('labelFontSize'),
    fontStyle:   _('labelFontStyle'),
    fontWeight:  _('labelFontWeight'),
    limit:       _('labelLimit')
  });

  labels = guideMark({
    type:  TextMark,
    role:  LegendLabelRole,
    style: GuideLabelStyle,
    key:   Value,
    from:  valueRef,
    encode
  }, userEncode.labels);

  // -- LEGEND ENTRY GROUPS --
  encode = {
    enter: {
      noBound: {value: !height}, // ignore width/height in bounds calc
      width: zero,
      height: height ? encoder(height) : zero,
      opacity: zero
    },
    exit: {opacity: zero},
    update: update = {
      opacity: one,
      row: {signal: null},
      column: {signal: null}
    }
  };

  // annotate and sort groups to ensure correct ordering
  if (_.isVertical(true)) {
    nrows = `ceil(item.mark.items.length / ${ncols})`;
    update.row.signal = `${index}%${nrows}`;
    update.column.signal = `floor(${index} / ${nrows})`;
    sort = {field: ['row', index]};
  } else {
    update.row.signal = `floor(${index} / ${ncols})`;
    update.column.signal = `${index} % ${ncols}`;
    sort = {field: index};
  }
  // handle zero column case (implies infinite columns)
  update.column.signal = `(${columns})?${update.column.signal}:${index}`;

  // facet legend entries into sub-groups
  dataRef = {facet: {data: dataRef, name: 'value', groupby: Index}};

  return guideGroup({
    role:   ScopeRole,
    from:   dataRef,
    encode: extendEncode(encode, entries, Skip),
    marks:  [symbols, labels],
    name,
    interactive,
    sort
  });
}

export function legendSymbolLayout(spec, config) {
  const _ = lookup(spec, config);

  // layout parameters for legend entries
  return {
    align:   _('gridAlign'),
    columns: _.entryColumns(),
    center:  {
      row: true,
      column: false
    },
    padding: {
      row:    _('rowPadding'),
      column: _('columnPadding')
    }
  };
}
