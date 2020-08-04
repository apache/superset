import {extend, identity} from 'vega-util';

export function measureName(op, field, as) {
  return as || (op + (!field ? '' : '_' + field));
}

const noop = () => {};

const base_op = {
  init: noop,
  add:  noop,
  rem:  noop,
  idx:  0
};

export const AggregateOps = {
  values: {
    init:  m => m.cell.store = true,
    value: m => m.cell.data.values(),
    idx:  -1
  },
  count: {
    value: m => m.cell.num
  },
  __count__: {
    value: m => m.missing + m.valid
  },
  missing: {
    value: m => m.missing
  },
  valid: {
    value: m => m.valid
  },
  sum: {
    init:  m => m.sum = 0,
    value: m => m.sum,
    add:  (m, v) => m.sum += +v,
    rem:  (m, v) => m.sum -= v
  },
  product: {
    init:  m => m.product = 1,
    value: m => m.valid ? m.product : undefined,
    add:  (m, v) => m.product *= v,
    rem:  (m, v) => m.product /= v
  },
  mean: {
    init:  m => m.mean = 0,
    value: m => m.valid ? m.mean : undefined,
    add:  (m, v) => (m.mean_d = v - m.mean, m.mean += m.mean_d / m.valid),
    rem:  (m, v) => (m.mean_d = v - m.mean, m.mean -= m.valid ? m.mean_d / m.valid : m.mean)
  },
  average: {
    value: m => m.valid ? m.mean : undefined,
    req:  ['mean'], idx: 1
  },
  variance: {
    init:  m => m.dev = 0,
    value: m => m.valid > 1 ? m.dev / (m.valid - 1) : undefined,
    add:  (m, v) => m.dev += m.mean_d * (v - m.mean),
    rem:  (m, v) => m.dev -= m.mean_d * (v - m.mean),
    req:  ['mean'], idx: 1
  },
  variancep: {
    value: m => m.valid > 1 ? m.dev / m.valid : undefined,
    req:  ['variance'], idx: 2
  },
  stdev: {
    value: m => m.valid > 1 ? Math.sqrt(m.dev / (m.valid - 1)) : undefined,
    req:  ['variance'], idx: 2
  },
  stdevp: {
    value: m => m.valid > 1 ? Math.sqrt(m.dev / m.valid) : undefined,
    req:  ['variance'], idx: 2
  },
  stderr: {
    value: m => m.valid > 1 ? Math.sqrt(m.dev / (m.valid * (m.valid - 1))) : undefined,
    req:  ['variance'], idx: 2
  },
  distinct: {
    value: m => m.cell.data.distinct(m.get),
    req:  ['values'], idx: 3
  },
  ci0: {
    value: m => m.cell.data.ci0(m.get),
    req:  ['values'], idx: 3
  },
  ci1: {
    value: m => m.cell.data.ci1(m.get),
    req:  ['values'], idx: 3
  },
  median: {
    value: m => m.cell.data.q2(m.get),
    req:  ['values'], idx: 3
  },
  q1: {
    value: m => m.cell.data.q1(m.get),
    req: ['values'], idx: 3
  },
  q3: {
    value: m => m.cell.data.q3(m.get),
    req:  ['values'], idx: 3
  },
  min: {
    init:  m => m.min = undefined,
    value: m => m.min = (Number.isNaN(m.min) ? m.cell.data.min(m.get) : m.min),
    add:  (m, v) => { if (v < m.min || m.min === undefined) m.min = v; },
    rem:  (m, v) => { if (v <= m.min) m.min = NaN; },
    req:  ['values'], idx: 4
  },
  max: {
    init:  m => m.max = undefined,
    value: m => m.max = (Number.isNaN(m.max) ? m.cell.data.max(m.get) : m.max),
    add:  (m, v) => { if (v > m.max || m.max === undefined) m.max = v; },
    rem:  (m, v) => { if (v >= m.max) m.max = NaN; },
    req:  ['values'], idx: 4
  },
  argmin: {
    init:  m => m.argmin = undefined,
    value: m => m.argmin || m.cell.data.argmin(m.get),
    add:  (m, v, t) => { if (v < m.min) m.argmin = t; },
    rem:  (m, v) => { if (v <= m.min) m.argmin = undefined; },
    req:  ['min', 'values'], idx: 3
  },
  argmax: {
    init:  m => m.argmax = undefined,
    value: m => m.argmax || m.cell.data.argmax(m.get),
    add:  (m, v, t) => { if (v > m.max) m.argmax = t; },
    rem:  (m, v) => { if (v >= m.max) m.argmax = undefined; },
    req:  ['max', 'values'], idx: 3
  }
};

export const ValidAggregateOps = Object.keys(AggregateOps);

function measure(key, value) {
  return out => extend({
    name: key,
    out: out || key
  }, base_op, value);
}

ValidAggregateOps.forEach(key => {
  AggregateOps[key] = measure(key, AggregateOps[key]);
});

export function createMeasure(op, name) {
  return AggregateOps[op](name);
}

function compareIndex(a, b) {
  return a.idx - b.idx;
}

function resolve(agg) {
  const map = {};
  agg.forEach(a => map[a.name] = a);

  const getreqs = a => {
    if (!a.req) return;
    a.req.forEach(key => {
      if (!map[key]) getreqs(map[key] = AggregateOps[key]());
    });
  };
  agg.forEach(getreqs);

  return Object.values(map).sort(compareIndex);
}

function init() {
  this.valid = 0;
  this.missing = 0;
  this._ops.forEach(op => op.init(this));
}

function add(v, t) {
  if (v == null || v === '') { ++this.missing; return; }
  if (v !== v) return;
  ++this.valid;
  this._ops.forEach(op => op.add(this, v, t));
}

function rem(v, t) {
  if (v == null || v === '') { --this.missing; return; }
  if (v !== v) return;
  --this.valid;
  this._ops.forEach(op => op.rem(this, v, t));
}

function set(t) {
  this._out.forEach(op => t[op.out] = op.value(this));
  return t;
}

export function compileMeasures(agg, field) {
  var get = field || identity,
      ops = resolve(agg),
      out = agg.slice().sort(compareIndex);

  function ctr(cell) {
    this._ops = ops;
    this._out = out;
    this.cell = cell;
    this.init();
  }

  ctr.prototype.init = init;
  ctr.prototype.add = add;
  ctr.prototype.rem = rem;
  ctr.prototype.set = set;
  ctr.prototype.get = get;
  ctr.fields = agg.map(op => op.out);

  return ctr;
}
