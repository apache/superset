import {hasOwnProperty} from 'vega-util';

import {
  curveBasis,
  curveBasisClosed,
  curveBasisOpen,
  curveBundle,
  curveCardinal,
  curveCardinalClosed,
  curveCardinalOpen,
  curveCatmullRom,
  curveCatmullRomClosed,
  curveCatmullRomOpen,
  curveLinear,
  curveLinearClosed,
  curveMonotoneX,
  curveMonotoneY,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore
} from 'd3-shape';

var lookup = {
  'basis': {
    curve: curveBasis
  },
  'basis-closed': {
    curve: curveBasisClosed
  },
  'basis-open': {
    curve: curveBasisOpen
  },
  'bundle': {
    curve: curveBundle,
    tension: 'beta',
    value: 0.85
  },
  'cardinal': {
    curve: curveCardinal,
    tension: 'tension',
    value: 0
  },
  'cardinal-open': {
    curve: curveCardinalOpen,
    tension: 'tension',
    value: 0
  },
  'cardinal-closed': {
    curve: curveCardinalClosed,
    tension: 'tension',
    value: 0
  },
  'catmull-rom': {
    curve: curveCatmullRom,
    tension: 'alpha',
    value: 0.5
  },
  'catmull-rom-closed': {
    curve: curveCatmullRomClosed,
    tension: 'alpha',
    value: 0.5
  },
  'catmull-rom-open': {
    curve: curveCatmullRomOpen,
    tension: 'alpha',
    value: 0.5
  },
  'linear': {
    curve: curveLinear
  },
  'linear-closed': {
    curve: curveLinearClosed
  },
  'monotone': {
    horizontal: curveMonotoneY,
    vertical:   curveMonotoneX
  },
  'natural': {
    curve: curveNatural
  },
  'step': {
    curve: curveStep
  },
  'step-after': {
    curve: curveStepAfter
  },
  'step-before': {
    curve: curveStepBefore
  }
};

export default function curves(type, orientation, tension) {
  var entry = hasOwnProperty(lookup, type) && lookup[type],
      curve = null;

  if (entry) {
    curve = entry.curve || entry[orientation || 'vertical'];
    if (entry.tension && tension != null) {
      curve = curve[entry.tension](tension);
    }
  }

  return curve;
}
