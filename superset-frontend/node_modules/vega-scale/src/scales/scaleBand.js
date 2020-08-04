import bandSpace from './bandSpace';
import {bisectRight, range as sequence} from 'd3-array';
import {scaleOrdinal as ordinal} from 'd3-scale';

export function band() {
  var scale = ordinal().unknown(undefined),
      domain = scale.domain,
      ordinalRange = scale.range,
      range = [0, 1],
      step,
      bandwidth,
      round = false,
      paddingInner = 0,
      paddingOuter = 0,
      align = 0.5;

  delete scale.unknown;

  function rescale() {
    var n = domain().length,
        reverse = range[1] < range[0],
        start = range[reverse - 0],
        stop = range[1 - reverse],
        space = bandSpace(n, paddingInner, paddingOuter);

    step = (stop - start) / (space || 1);
    if (round) {
      step = Math.floor(step);
    }
    start += (stop - start - step * (n - paddingInner)) * align;
    bandwidth = step * (1 - paddingInner);
    if (round) {
      start = Math.round(start);
      bandwidth = Math.round(bandwidth);
    }
    var values = sequence(n).map(function(i) { return start + step * i; });
    return ordinalRange(reverse ? values.reverse() : values);
  }

  scale.domain = function(_) {
    if (arguments.length) {
      domain(_);
      return rescale();
    } else {
      return domain();
    }
  };

  scale.range = function(_) {
    if (arguments.length) {
      range = [+_[0], +_[1]];
      return rescale();
    } else {
      return range.slice();
    }
  };

  scale.rangeRound = function(_) {
    range = [+_[0], +_[1]];
    round = true;
    return rescale();
  };

  scale.bandwidth = function() {
    return bandwidth;
  };

  scale.step = function() {
    return step;
  };

  scale.round = function(_) {
    if (arguments.length) {
      round = !!_;
      return rescale();
    } else {
      return round;
    }
  };

  scale.padding = function(_) {
    if (arguments.length) {
      paddingOuter = Math.max(0, Math.min(1, _));
      paddingInner = paddingOuter;
      return rescale();
    } else {
      return paddingInner;
    }
  };

  scale.paddingInner = function(_) {
    if (arguments.length) {
      paddingInner = Math.max(0, Math.min(1, _));
      return rescale();
    } else {
      return paddingInner;
    }
  };

  scale.paddingOuter = function(_) {
    if (arguments.length) {
      paddingOuter = Math.max(0, Math.min(1, _));
      return rescale();
    } else {
      return paddingOuter;
    }
  };

  scale.align = function(_) {
    if (arguments.length) {
      align = Math.max(0, Math.min(1, _));
      return rescale();
    } else {
      return align;
    }
  };

  scale.invertRange = function(_) {
    // bail if range has null or undefined values
    if (_[0] == null || _[1] == null) return;

    var lo = +_[0],
        hi = +_[1],
        reverse = range[1] < range[0],
        values = reverse ? ordinalRange().reverse() : ordinalRange(),
        n = values.length - 1, a, b, t;

    // bail if either range endpoint is invalid
    if (lo !== lo || hi !== hi) return;

    // order range inputs, bail if outside of scale range
    if (hi < lo) {
      t = lo;
      lo = hi;
      hi = t;
    }
    if (hi < values[0] || lo > range[1-reverse]) return;

    // binary search to index into scale range
    a = Math.max(0, bisectRight(values, lo) - 1);
    b = lo===hi ? a : bisectRight(values, hi) - 1;

    // increment index a if lo is within padding gap
    if (lo - values[a] > bandwidth + 1e-10) ++a;

    if (reverse) {
      // map + swap
      t = a;
      a = n - b;
      b = n - t;
    }
    return (a > b) ? undefined : domain().slice(a, b+1);
  };

  scale.invert = function(_) {
    var value = scale.invertRange([_, _]);
    return value ? value[0] : value;
  };

  scale.copy = function() {
    return band()
        .domain(domain())
        .range(range)
        .round(round)
        .paddingInner(paddingInner)
        .paddingOuter(paddingOuter)
        .align(align);
  };

  return rescale();
}

function pointish(scale) {
  var copy = scale.copy;

  scale.padding = scale.paddingOuter;
  delete scale.paddingInner;

  scale.copy = function() {
    return pointish(copy());
  };

  return scale;
}

export function point() {
  return pointish(band().paddingInner(1));
}
