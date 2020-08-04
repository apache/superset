import {groupkey} from './util/AggregateKeys';
import {ValidAggregateOps, compileMeasures, createMeasure, measureName} from './util/AggregateOps';
import TupleStore from './util/TupleStore';
import {Transform, ingest, replace} from 'vega-dataflow';
import {accessorFields, accessorName, array, error, inherits} from 'vega-util';

/**
 * Group-by aggregation operator.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Array<function(object): *>} [params.groupby] - An array of accessors to groupby.
 * @param {Array<function(object): *>} [params.fields] - An array of accessors to aggregate.
 * @param {Array<string>} [params.ops] - An array of strings indicating aggregation operations.
 * @param {Array<string>} [params.as] - An array of output field names for aggregated values.
 * @param {boolean} [params.cross=false] - A flag indicating that the full
 *   cross-product of groupby values should be generated, including empty cells.
 *   If true, the drop parameter is ignored and empty cells are retained.
 * @param {boolean} [params.drop=true] - A flag indicating if empty cells should be removed.
 */
export default function Aggregate(params) {
  Transform.call(this, null, params);

  this._adds = []; // array of added output tuples
  this._mods = []; // array of modified output tuples
  this._alen = 0;  // number of active added tuples
  this._mlen = 0;  // number of active modified tuples
  this._drop = true;   // should empty aggregation cells be removed
  this._cross = false; // produce full cross-product of group-by values

  this._dims = [];   // group-by dimension accessors
  this._dnames = []; // group-by dimension names

  this._measures = []; // collection of aggregation monoids
  this._countOnly = false; // flag indicating only count aggregation
  this._counts = null; // collection of count fields
  this._prev = null;   // previous aggregation cells

  this._inputs = null;  // array of dependent input tuple field names
  this._outputs = null; // array of output tuple field names
}

Aggregate.Definition = {
  'type': 'Aggregate',
  'metadata': {'generates': true, 'changes': true},
  'params': [
    { 'name': 'groupby', 'type': 'field', 'array': true },
    { 'name': 'ops', 'type': 'enum', 'array': true, 'values': ValidAggregateOps },
    { 'name': 'fields', 'type': 'field', 'null': true, 'array': true },
    { 'name': 'as', 'type': 'string', 'null': true, 'array': true },
    { 'name': 'drop', 'type': 'boolean', 'default': true },
    { 'name': 'cross', 'type': 'boolean', 'default': false },
    { 'name': 'key', 'type': 'field' }
  ]
};

var prototype = inherits(Aggregate, Transform);

prototype.transform = function(_, pulse) {
  var aggr = this,
      out = pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS),
      mod = _.modified();

  aggr.stamp = out.stamp;

  if (aggr.value && (mod || pulse.modified(aggr._inputs, true))) {
    aggr._prev = aggr.value;
    aggr.value = mod ? aggr.init(_) : {};
    pulse.visit(pulse.SOURCE, t => aggr.add(t));
  } else {
    aggr.value = aggr.value || aggr.init(_);
    pulse.visit(pulse.REM, t => aggr.rem(t));
    pulse.visit(pulse.ADD, t => aggr.add(t));
  }

  // Indicate output fields and return aggregate tuples.
  out.modifies(aggr._outputs);

  // Should empty cells be dropped?
  aggr._drop = _.drop !== false;

  // If domain cross-product requested, generate empty cells as needed
  // and ensure that empty cells are not dropped
  if (_.cross && aggr._dims.length > 1) {
    aggr._drop = false;
    aggr.cross();
  }

  if (pulse.clean() && aggr._drop) {
    out.clean(true).runAfter(() => this.clean());
  }

  return aggr.changes(out);
};

prototype.cross = function() {
  var aggr = this,
      curr = aggr.value,
      dims = aggr._dnames,
      vals = dims.map(function() { return {}; }),
      n = dims.length;

  // collect all group-by domain values
  function collect(cells) {
    var key, i, t, v;
    for (key in cells) {
      t = cells[key].tuple;
      for (i=0; i<n; ++i) {
        vals[i][(v = t[dims[i]])] = v;
      }
    }
  }
  collect(aggr._prev);
  collect(curr);

  // iterate over key cross-product, create cells as needed
  function generate(base, tuple, index) {
    var name = dims[index],
        v = vals[index++],
        k, key;

    for (k in v) {
      tuple[name] = v[k];
      key = base ? base + '|' + k : k;
      if (index < n) generate(key, tuple, index);
      else if (!curr[key]) aggr.cell(key, tuple);
    }
  }
  generate('', {}, 0);
};

prototype.init = function(_) {
  // initialize input and output fields
  var inputs = (this._inputs = []),
      outputs = (this._outputs = []),
      inputMap = {};

  function inputVisit(get) {
    var fields = array(accessorFields(get)),
        i = 0, n = fields.length, f;
    for (; i<n; ++i) {
      if (!inputMap[f=fields[i]]) {
        inputMap[f] = 1;
        inputs.push(f);
      }
    }
  }

  // initialize group-by dimensions
  this._dims = array(_.groupby);
  this._dnames = this._dims.map(function(d) {
    var dname = accessorName(d);
    inputVisit(d);
    outputs.push(dname);
    return dname;
  });
  this.cellkey = _.key ? _.key : groupkey(this._dims);

  // initialize aggregate measures
  this._countOnly = true;
  this._counts = [];
  this._measures = [];

  var fields = _.fields || [null],
      ops = _.ops || ['count'],
      as = _.as || [],
      n = fields.length,
      map = {},
      field, op, m, mname, outname, i;

  if (n !== ops.length) {
    error('Unmatched number of fields and aggregate ops.');
  }

  for (i=0; i<n; ++i) {
    field = fields[i];
    op = ops[i];

    if (field == null && op !== 'count') {
      error('Null aggregate field specified.');
    }
    mname = accessorName(field);
    outname = measureName(op, mname, as[i]);
    outputs.push(outname);

    if (op === 'count') {
      this._counts.push(outname);
      continue;
    }

    m = map[mname];
    if (!m) {
      inputVisit(field);
      m = (map[mname] = []);
      m.field = field;
      this._measures.push(m);
    }

    if (op !== 'count') this._countOnly = false;
    m.push(createMeasure(op, outname));
  }

  this._measures = this._measures.map(function(m) {
    return compileMeasures(m, m.field);
  });

  return {}; // aggregation cells (this.value)
};

// -- Cell Management -----

prototype.cellkey = groupkey();

prototype.cell = function(key, t) {
  var cell = this.value[key];
  if (!cell) {
    cell = this.value[key] = this.newcell(key, t);
    this._adds[this._alen++] = cell;
  } else if (cell.num === 0 && this._drop && cell.stamp < this.stamp) {
    cell.stamp = this.stamp;
    this._adds[this._alen++] = cell;
  } else if (cell.stamp < this.stamp) {
    cell.stamp = this.stamp;
    this._mods[this._mlen++] = cell;
  }
  return cell;
};

prototype.newcell = function(key, t) {
  var cell = {
    key:   key,
    num:   0,
    agg:   null,
    tuple: this.newtuple(t, this._prev && this._prev[key]),
    stamp: this.stamp,
    store: false
  };

  if (!this._countOnly) {
    var measures = this._measures,
        n = measures.length, i;

    cell.agg = Array(n);
    for (i=0; i<n; ++i) {
      cell.agg[i] = new measures[i](cell);
    }
  }

  if (cell.store) {
    cell.data = new TupleStore();
  }

  return cell;
};

prototype.newtuple = function(t, p) {
  var names = this._dnames,
      dims = this._dims,
      x = {}, i, n;

  for (i=0, n=dims.length; i<n; ++i) {
    x[names[i]] = dims[i](t);
  }

  return p ? replace(p.tuple, x) : ingest(x);
};

prototype.clean = function() {
  const cells = this.value;
  for (const key in cells) {
    if (cells[key].num === 0) {
      delete cells[key];
    }
  }
};

// -- Process Tuples -----

prototype.add = function(t) {
  var key = this.cellkey(t),
      cell = this.cell(key, t),
      agg, i, n;

  cell.num += 1;
  if (this._countOnly) return;

  if (cell.store) cell.data.add(t);

  agg = cell.agg;
  for (i=0, n=agg.length; i<n; ++i) {
    agg[i].add(agg[i].get(t), t);
  }
};

prototype.rem = function(t) {
  var key = this.cellkey(t),
      cell = this.cell(key, t),
      agg, i, n;

  cell.num -= 1;
  if (this._countOnly) return;

  if (cell.store) cell.data.rem(t);

  agg = cell.agg;
  for (i=0, n=agg.length; i<n; ++i) {
    agg[i].rem(agg[i].get(t), t);
  }
};

prototype.celltuple = function(cell) {
  var tuple = cell.tuple,
      counts = this._counts,
      agg, i, n;

  // consolidate stored values
  if (cell.store) {
    cell.data.values();
  }

  // update tuple properties
  for (i=0, n=counts.length; i<n; ++i) {
    tuple[counts[i]] = cell.num;
  }
  if (!this._countOnly) {
    agg = cell.agg;
    for (i=0, n=agg.length; i<n; ++i) {
      agg[i].set(tuple);
    }
  }

  return tuple;
};

prototype.changes = function(out) {
  var adds = this._adds,
      mods = this._mods,
      prev = this._prev,
      drop = this._drop,
      add = out.add,
      rem = out.rem,
      mod = out.mod,
      cell, key, i, n;

  if (prev) for (key in prev) {
    cell = prev[key];
    if (!drop || cell.num) rem.push(cell.tuple);
  }

  for (i=0, n=this._alen; i<n; ++i) {
    add.push(this.celltuple(adds[i]));
    adds[i] = null; // for garbage collection
  }

  for (i=0, n=this._mlen; i<n; ++i) {
    cell = mods[i];
    (cell.num === 0 && drop ? rem : mod).push(this.celltuple(cell));
    mods[i] = null; // for garbage collection
  }

  this._alen = this._mlen = 0; // reset list of active cells
  this._prev = null;
  return out;
};
