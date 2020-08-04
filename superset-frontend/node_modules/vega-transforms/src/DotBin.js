import {partition} from './util/util';
import {Transform, stableCompare} from 'vega-dataflow';
import {dotbin} from 'vega-statistics';
import {extent, identity, inherits, span} from 'vega-util';

const Output = 'bin';

/**
 * Dot density binning for dot plot construction.
 * Based on Leland Wilkinson, Dot Plots, The American Statistician, 1999.
 * https://www.cs.uic.edu/~wilkinson/Publications/dotplots.pdf
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.field - The value field to bin.
 * @param {Array<function(object): *>} [params.groupby] - An array of accessors to groupby.
 * @param {number} [params.step] - The step size (bin width) within which dots should be
 *   stacked. Defaults to 1/30 of the extent of the data *field*.
 * @param {boolean} [params.smooth=false] - A boolean flag indicating if dot density
 *   stacks should be smoothed to reduce variance.
 */
export default function DotBin(params) {
  Transform.call(this, null, params);
}

DotBin.Definition = {
  'type': 'DotBin',
  'metadata': {'modifies': true},
  'params': [
    { 'name': 'field', 'type': 'field', 'required': true },
    { 'name': 'groupby', 'type': 'field', 'array': true },
    { 'name': 'step', 'type': 'number' },
    { 'name': 'smooth', 'type': 'boolean', 'default': false },
    { 'name': 'as', 'type': 'string', 'default': Output }
  ]
};

const prototype = inherits(DotBin, Transform);

prototype.transform = function(_, pulse) {
  if (this.value && !(_.modified() || pulse.changed())) {
    return pulse; // early exit
  }

  const source = pulse.materialize(pulse.SOURCE).source,
        groups = partition(pulse.source, _.groupby, identity),
        smooth = _.smooth || false,
        field = _.field,
        step = _.step || autostep(source, field),
        sort = stableCompare((a, b) => field(a) - field(b)),
        as = _.as || Output,
        n = groups.length;

  // compute dotplot bins per group
  let min = Infinity, max = -Infinity, i = 0, j;
  for (; i<n; ++i) {
    const g = groups[i].sort(sort);
    j = -1;
    for (const v of dotbin(g, step, smooth, field)) {
      if (v < min) min = v;
      if (v > max) max = v;
      g[++j][as] = v;
    }
  }

  this.value = {
    start: min,
    stop: max,
    step: step
  };
  return pulse.reflow(true).modifies(as);
};

function autostep(data, field) {
  return span(extent(data, field)) / 30;
}
