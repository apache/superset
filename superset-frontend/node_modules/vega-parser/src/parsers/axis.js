import {addEncoders, extendEncode} from './encode/util';
import axisConfig from './guides/axis-config';
import axisDomain from './guides/axis-domain';
import axisGrid from './guides/axis-grid';
import axisTicks from './guides/axis-ticks';
import axisLabels from './guides/axis-labels';
import axisTitle from './guides/axis-title';
import {Skip} from './guides/constants';
import guideGroup from './guides/guide-group';
import {lookup, tickBand} from './guides/guide-util';
import {AxisRole} from './marks/roles';
import parseMark from './mark';
import {AxisTicks, Collect} from '../transforms';
import {ref, value} from '../util';

export default function(spec, scope) {
  var config = axisConfig(spec, scope),
      encode = spec.encode || {},
      axisEncode = encode.axis || {},
      name = axisEncode.name || undefined,
      interactive = axisEncode.interactive,
      style = axisEncode.style,
      _ = lookup(spec, config),
      band = tickBand(_),
      datum, dataRef, ticksRef, size, children;

  // single-element data source for axis group
  datum = {
    scale:  spec.scale,
    ticks:  !!_('ticks'),
    labels: !!_('labels'),
    grid:   !!_('grid'),
    domain: !!_('domain'),
    title:  spec.title != null
  };
  dataRef = ref(scope.add(Collect({}, [datum])));

  // encoding properties for axis group item
  axisEncode = extendEncode(
    buildAxisEncode(_, spec), axisEncode, Skip
  );

  // data source for axis ticks
  ticksRef = ref(scope.add(AxisTicks({
    scale:   scope.scaleRef(spec.scale),
    extra:   scope.property(band.extra),
    count:   scope.objectProperty(spec.tickCount),
    values:  scope.objectProperty(spec.values),
    minstep: scope.property(spec.tickMinStep),
    formatType: scope.property(spec.formatType),
    formatSpecifier: scope.property(spec.format)
  })));

  // generate axis marks
  children = [];

  // include axis gridlines if requested
  if (datum.grid) {
    children.push(axisGrid(spec, config, encode.grid, ticksRef, band));
  }

  // include axis ticks if requested
  if (datum.ticks) {
    size = _('tickSize');
    children.push(axisTicks(spec, config, encode.ticks, ticksRef, size, band));
  }

  // include axis labels if requested
  if (datum.labels) {
    size = datum.ticks ? size : 0;
    children.push(axisLabels(spec, config, encode.labels, ticksRef, size, band));
  }

  // include axis domain path if requested
  if (datum.domain) {
    children.push(axisDomain(spec, config, encode.domain, dataRef));
  }

  // include axis title if defined
  if (datum.title) {
    children.push(axisTitle(spec, config, encode.title, dataRef));
  }

  // parse axis specification
  return parseMark(
    guideGroup({
      role:        AxisRole,
      from:        dataRef,
      encode:      axisEncode,
      marks:       children,
      aria:        _('aria'),
      description: _('description'),
      zindex:      _('zindex'),
      name,
      interactive,
      style
    }),
    scope
  );
}

function buildAxisEncode(_, spec) {
  var encode = {enter: {}, update: {}};

  addEncoders(encode, {
    orient:       _('orient'),
    offset:       _('offset') || 0,
    position:     value(spec.position, 0),
    titlePadding: _('titlePadding'),
    minExtent:    _('minExtent'),
    maxExtent:    _('maxExtent'),
    range:        {signal: `abs(span(range("${spec.scale}")))`},
    translate:    _('translate'),

    // accessibility support
    format:       spec.format,
    formatType:   spec.formatType
  });

  return encode;
}
