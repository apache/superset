import {Transform} from 'vega-dataflow';
import {
  error, inherits, isArray, isFunction, isString, peek, stringValue,
  toSet, zoomLinear, zoomLog, zoomPow, zoomSymlog
} from 'vega-util';

import {
  Band,
  BinOrdinal,
  Diverging,
  Linear,
  Log,
  Ordinal,
  Point,
  Pow,
  Quantile,
  Quantize,
  Sequential,
  Sqrt,
  Symlog,
  Threshold,
  Time,
  UTC,
  bandSpace,
  interpolate as getInterpolate,
  scale as getScale,
  scheme as getScheme,
  interpolateColors,
  interpolateRange,
  isContinuous,
  isInterpolating,
  isLogarithmic,
  quantizeInterpolator,
  scaleImplicit,
  tickCount
} from 'vega-scale';

import {range as sequence} from 'd3-array';

import {
  interpolate,
  interpolateRound
} from 'd3-interpolate';

var DEFAULT_COUNT = 5;

function includeZero(scale) {
  const type = scale.type;
  return !scale.bins && (
    type === Linear || type === Pow || type === Sqrt
  );
}

function includePad(type) {
  return isContinuous(type) && type !== Sequential;
}

var SKIP = toSet([
  'set', 'modified', 'clear', 'type', 'scheme', 'schemeExtent', 'schemeCount',
  'domain', 'domainMin', 'domainMid', 'domainMax',
  'domainRaw', 'domainImplicit', 'nice', 'zero', 'bins',
  'range', 'rangeStep', 'round', 'reverse', 'interpolate', 'interpolateGamma'
]);

/**
 * Maintains a scale function mapping data values to visual channels.
 * @constructor
 * @param {object} params - The parameters for this operator.
 */
export default function Scale(params) {
  Transform.call(this, null, params);
  this.modified(true); // always treat as modified
}

var prototype = inherits(Scale, Transform);

prototype.transform = function(_, pulse) {
  var df = pulse.dataflow,
      scale = this.value,
      key = scaleKey(_);

  if (!scale || key !== scale.type) {
    this.value = scale = getScale(key)();
  }

  for (key in _) if (!SKIP[key]) {
    // padding is a scale property for band/point but not others
    if (key === 'padding' && includePad(scale.type)) continue;
    // invoke scale property setter, raise warning if not found
    isFunction(scale[key])
      ? scale[key](_[key])
      : df.warn('Unsupported scale property: ' + key);
  }

  configureRange(scale, _,
    configureBins(scale, _, configureDomain(scale, _, df))
  );

  return pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS);
};

function scaleKey(_) {
  var t = _.type, d = '', n;

  // backwards compatibility pre Vega 5.
  if (t === Sequential) return Sequential + '-' + Linear;

  if (isContinuousColor(_)) {
    n = _.rawDomain ? _.rawDomain.length
      : _.domain ? _.domain.length + +(_.domainMid != null)
      : 0;
    d = n === 2 ? Sequential + '-'
      : n === 3 ? Diverging + '-'
      : '';
  }

  return ((d + t) || Linear).toLowerCase();
}

function isContinuousColor(_) {
  const t = _.type;
  return isContinuous(t) && t !== Time && t !== UTC && (
    _.scheme || _.range && _.range.length && _.range.every(isString)
  );
}

function configureDomain(scale, _, df) {
  // check raw domain, if provided use that and exit early
  var raw = rawDomain(scale, _.domainRaw, df);
  if (raw > -1) return raw;

  var domain = _.domain,
      type = scale.type,
      zero = _.zero || (_.zero === undefined && includeZero(scale)),
      n, mid;

  if (!domain) return 0;

  // adjust continuous domain for minimum pixel padding
  if (includePad(type) && _.padding && domain[0] !== peek(domain)) {
    domain = padDomain(type, domain, _.range, _.padding, _.exponent, _.constant);
  }

  // adjust domain based on zero, min, max settings
  if (zero || _.domainMin != null || _.domainMax != null || _.domainMid != null) {
    n = ((domain = domain.slice()).length - 1) || 1;
    if (zero) {
      if (domain[0] > 0) domain[0] = 0;
      if (domain[n] < 0) domain[n] = 0;
    }
    if (_.domainMin != null) domain[0] = _.domainMin;
    if (_.domainMax != null) domain[n] = _.domainMax;

    if (_.domainMid != null) {
      mid = _.domainMid;
      const i = mid > domain[n] ? n + 1 : mid < domain[0] ? 0 : n;
      if (i !== n) df.warn('Scale domainMid exceeds domain min or max.', mid);
      domain.splice(i, 0, mid);
    }
  }

  // set the scale domain
  scale.domain(domainCheck(type, domain, df));

  // if ordinal scale domain is defined, prevent implicit
  // domain construction as side-effect of scale lookup
  if (type === Ordinal) {
    scale.unknown(_.domainImplicit ? scaleImplicit : undefined);
  }

  // perform 'nice' adjustment as requested
  if (_.nice && scale.nice) {
    scale.nice((_.nice !== true && tickCount(scale, _.nice)) || null);
  }

  // return the cardinality of the domain
  return domain.length;
}

function rawDomain(scale, raw, df) {
  if (raw) {
    scale.domain(domainCheck(scale.type, raw, df));
    return raw.length;
  } else {
    return -1;
  }
}

function padDomain(type, domain, range, pad, exponent, constant) {
  var span = Math.abs(peek(range) - range[0]),
      frac = span / (span - 2 * pad),
      d = type === Log    ? zoomLog(domain, null, frac)
        : type === Sqrt   ? zoomPow(domain, null, frac, 0.5)
        : type === Pow    ? zoomPow(domain, null, frac, exponent || 1)
        : type === Symlog ? zoomSymlog(domain, null, frac, constant || 1)
        : zoomLinear(domain, null, frac);

  domain = domain.slice();
  domain[0] = d[0];
  domain[domain.length-1] = d[1];
  return domain;
}

function domainCheck(type, domain, df) {
  if (isLogarithmic(type)) {
    // sum signs of domain values
    // if all pos or all neg, abs(sum) === domain.length
    var s = Math.abs(domain.reduce(function(s, v) {
      return s + (v < 0 ? -1 : v > 0 ? 1 : 0);
    }, 0));

    if (s !== domain.length) {
      df.warn('Log scale domain includes zero: ' + stringValue(domain));
    }
  }
  return domain;
}

function configureBins(scale, _, count) {
  let bins = _.bins;

  if (bins && !isArray(bins)) {
    // generate bin boundary array
    let domain = scale.domain(),
        lo = domain[0],
        hi = peek(domain),
        start = bins.start == null ? lo : bins.start,
        stop = bins.stop == null ? hi : bins.stop,
        step = bins.step;

    if (!step) error('Scale bins parameter missing step property.');
    if (start < lo) start = step * Math.ceil(lo / step);
    if (stop > hi) stop = step * Math.floor(hi / step);
    bins = sequence(start, stop + step / 2, step);
  }

  if (bins) {
    // assign bin boundaries to scale instance
    scale.bins = bins;
  } else if (scale.bins) {
    // no current bins, remove bins if previously set
    delete scale.bins;
  }

  // special handling for bin-ordinal scales
  if (scale.type === BinOrdinal) {
    if (!bins) {
      // the domain specifies the bins
      scale.bins = scale.domain();
    } else if (!_.domain && !_.domainRaw) {
      // the bins specify the domain
      scale.domain(bins);
      count = bins.length;
    }
  }

  // return domain cardinality
  return count;
}

function configureRange(scale, _, count) {
  var type = scale.type,
      round = _.round || false,
      range = _.range;

  // if range step specified, calculate full range extent
  if (_.rangeStep != null) {
    range = configureRangeStep(type, _, count);
  }

  // else if a range scheme is defined, use that
  else if (_.scheme) {
    range = configureScheme(type, _, count);
    if (isFunction(range)) {
      if (scale.interpolator) {
        return scale.interpolator(range);
      } else {
        error(`Scale type ${type} does not support interpolating color schemes.`);
      }
    }
  }

  // given a range array for an interpolating scale, convert to interpolator
  if (range && isInterpolating(type)) {
    return scale.interpolator(
      interpolateColors(flip(range, _.reverse), _.interpolate, _.interpolateGamma)
    );
  }

  // configure rounding / interpolation
  if (range && _.interpolate && scale.interpolate) {
    scale.interpolate(getInterpolate(_.interpolate, _.interpolateGamma));
  } else if (isFunction(scale.round)) {
    scale.round(round);
  } else if (isFunction(scale.rangeRound)) {
    scale.interpolate(round ? interpolateRound : interpolate);
  }

  if (range) scale.range(flip(range, _.reverse));
}

function configureRangeStep(type, _, count) {
  if (type !== Band && type !== Point) {
    error('Only band and point scales support rangeStep.');
  }

  // calculate full range based on requested step size and padding
  var outer = (_.paddingOuter != null ? _.paddingOuter : _.padding) || 0,
      inner = type === Point ? 1
            : ((_.paddingInner != null ? _.paddingInner : _.padding) || 0);
  return [0, _.rangeStep * bandSpace(count, inner, outer)];
}

function configureScheme(type, _, count) {
  var extent = _.schemeExtent,
      name, scheme;

  if (isArray(_.scheme)) {
    scheme = interpolateColors(_.scheme, _.interpolate, _.interpolateGamma);
  } else {
    name = _.scheme.toLowerCase();
    scheme = getScheme(name);
    if (!scheme) error(`Unrecognized scheme name: ${_.scheme}`);
  }

  // determine size for potential discrete range
  count = (type === Threshold) ? count + 1
    : (type === BinOrdinal) ? count - 1
    : (type === Quantile || type === Quantize) ? (+_.schemeCount || DEFAULT_COUNT)
    : count;

  // adjust and/or quantize scheme as appropriate
  return isInterpolating(type) ? adjustScheme(scheme, extent, _.reverse)
    : isFunction(scheme) ? quantizeInterpolator(adjustScheme(scheme, extent), count)
    : type === Ordinal ? scheme : scheme.slice(0, count);
}

function adjustScheme(scheme, extent, reverse) {
  return (isFunction(scheme) && (extent || reverse))
    ? interpolateRange(scheme, flip(extent || [0, 1], reverse))
    : scheme;
}

function flip(array, reverse) {
  return reverse ? array.slice().reverse() : array;
}

