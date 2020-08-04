import {array, hasOwnProperty, toSet} from 'vega-util';
import invertRange from './scales/invertRange';
import invertRangeExtent from './scales/invertRangeExtent';

import {
  Band,
  BinOrdinal, Continuous as C, Discrete as D, Diverging, Interpolating as I,
  Identity, Linear, Log, Ordinal,
  Point, Pow, Quantile,
  Quantize, Sequential, Sqrt, Symlog,
  Temporal as T,
  Threshold,
  Time,
  UTC,
  Discretizing as Z
} from './scales/types';

import {
  band as scaleBand,
  point as scalePoint
} from './scales/scaleBand';

import {
  scaleBinOrdinal
} from './scales/scaleBinOrdinal';

import * as $ from 'd3-scale';

// scale registry
const scales = {};

/**
 * Augment scales with their type and needed inverse methods.
 */
function create(type, constructor, metadata) {
  const ctr = function scale() {
    var s = constructor();

    if (!s.invertRange) {
      s.invertRange = s.invert ? invertRange(s)
        : s.invertExtent ? invertRangeExtent(s)
        : undefined;
    }

    s.type = type;
    return s;
  };

  ctr.metadata = toSet(array(metadata));

  return ctr;
}

export function scale(type, scale, metadata) {
  if (arguments.length > 1) {
    scales[type] = create(type, scale, metadata);
    return this;
  } else {
    return isValidScaleType(type) ? scales[type] : undefined;
  }
}

// identity scale
scale(Identity, $.scaleIdentity);

// continuous scales
scale(Linear, $.scaleLinear, C);
scale(Log, $.scaleLog, [C, Log]);
scale(Pow, $.scalePow, C);
scale(Sqrt, $.scaleSqrt, C);
scale(Symlog, $.scaleSymlog, C);
scale(Time, $.scaleTime, [C, T]);
scale(UTC, $.scaleUtc, [C, T]);

// sequential scales
scale(Sequential, $.scaleSequential, [C, I]); // backwards compat
scale(`${Sequential}-${Linear}`, $.scaleSequential, [C, I]);
scale(`${Sequential}-${Log}`, $.scaleSequentialLog, [C, I, Log]);
scale(`${Sequential}-${Pow}`, $.scaleSequentialPow, [C, I]);
scale(`${Sequential}-${Sqrt}`, $.scaleSequentialSqrt, [C, I]);
scale(`${Sequential}-${Symlog}`, $.scaleSequentialSymlog, [C, I]);

// diverging scales
scale(`${Diverging}-${Linear}`, $.scaleDiverging, [C, I]);
scale(`${Diverging}-${Log}`, $.scaleDivergingLog, [C, I, Log]);
scale(`${Diverging}-${Pow}`, $.scaleDivergingPow, [C, I]);
scale(`${Diverging}-${Sqrt}`, $.scaleDivergingSqrt, [C, I]);
scale(`${Diverging}-${Symlog}`, $.scaleDivergingSymlog, [C, I]);

// discretizing scales
scale(Quantile, $.scaleQuantile, [Z, Quantile]);
scale(Quantize, $.scaleQuantize, Z);
scale(Threshold, $.scaleThreshold, Z);

// discrete scales
scale(BinOrdinal, scaleBinOrdinal, [D, Z]);
scale(Ordinal, $.scaleOrdinal, D);
scale(Band, scaleBand, D);
scale(Point, scalePoint, D);

export function isValidScaleType(type) {
  return hasOwnProperty(scales, type);
}

function hasType(key, type) {
  const s = scales[key];
  return s && s.metadata[type];
}

export function isContinuous(key) {
  return hasType(key, C);
}

export function isDiscrete(key) {
  return hasType(key, D);
}

export function isDiscretizing(key) {
  return hasType(key, Z);
}

export function isLogarithmic(key) {
  return hasType(key, Log);
}

export function isTemporal(key) {
  return hasType(key, T);
}

export function isInterpolating(key) {
  return hasType(key, I);
}

export function isQuantile(key) {
  return hasType(key, Quantile);
}
