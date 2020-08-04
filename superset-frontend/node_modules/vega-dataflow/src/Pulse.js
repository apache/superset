import {tupleid} from './Tuple';
import {isArray, visitArray} from 'vega-util';

/**
 * Sentinel value indicating pulse propagation should stop.
 */
export const StopPropagation = {};

// Pulse visit type flags
const ADD       = (1 << 0),
      REM       = (1 << 1),
      MOD       = (1 << 2),
      ADD_REM   = ADD | REM,
      ADD_MOD   = ADD | MOD,
      ALL       = ADD | REM | MOD,
      REFLOW    = (1 << 3),
      SOURCE    = (1 << 4),
      NO_SOURCE = (1 << 5),
      NO_FIELDS = (1 << 6);

/**
 * A Pulse enables inter-operator communication during a run of the
 * dataflow graph. In addition to the current timestamp, a pulse may also
 * contain a change-set of added, removed or modified data tuples, as well as
 * a pointer to a full backing data source. Tuple change sets may not
 * be fully materialized; for example, to prevent needless array creation
 * a change set may include larger arrays and corresponding filter functions.
 * The pulse provides a {@link visit} method to enable proper and efficient
 * iteration over requested data tuples.
 *
 * In addition, each pulse can track modification flags for data tuple fields.
 * Responsible transform operators should call the {@link modifies} method to
 * indicate changes to data fields. The {@link modified} method enables
 * querying of this modification state.
 *
 * @constructor
 * @param {Dataflow} dataflow - The backing dataflow instance.
 * @param {number} stamp - The current propagation timestamp.
 * @param {string} [encode] - An optional encoding set name, which is then
 *   accessible as Pulse.encode. Operators can respond to (or ignore) this
 *   setting as appropriate. This parameter can be used in conjunction with
 *   the Encode transform in the vega-encode module.
 */
export default function Pulse(dataflow, stamp, encode) {
  this.dataflow = dataflow;
  this.stamp = stamp == null ? -1 : stamp;
  this.add = [];
  this.rem = [];
  this.mod = [];
  this.fields = null;
  this.encode = encode || null;
}

const prototype = Pulse.prototype;

/**
 * Sentinel value indicating pulse propagation should stop.
 */
prototype.StopPropagation = StopPropagation;

/**
 * Boolean flag indicating ADD (added) tuples.
 */
prototype.ADD = ADD;

/**
 * Boolean flag indicating REM (removed) tuples.
 */
prototype.REM = REM;

/**
 * Boolean flag indicating MOD (modified) tuples.
 */
prototype.MOD = MOD;

/**
 * Boolean flag indicating ADD (added) and REM (removed) tuples.
 */
prototype.ADD_REM = ADD_REM;

/**
 * Boolean flag indicating ADD (added) and MOD (modified) tuples.
 */
prototype.ADD_MOD = ADD_MOD;

/**
 * Boolean flag indicating ADD, REM and MOD tuples.
 */
prototype.ALL = ALL;

/**
 * Boolean flag indicating all tuples in a data source
 * except for the ADD, REM and MOD tuples.
 */
prototype.REFLOW = REFLOW;

/**
 * Boolean flag indicating a 'pass-through' to a
 * backing data source, ignoring ADD, REM and MOD tuples.
 */
prototype.SOURCE = SOURCE;

/**
 * Boolean flag indicating that source data should be
 * suppressed when creating a forked pulse.
 */
prototype.NO_SOURCE = NO_SOURCE;

/**
 * Boolean flag indicating that field modifications should be
 * suppressed when creating a forked pulse.
 */
prototype.NO_FIELDS = NO_FIELDS;

/**
 * Creates a new pulse based on the values of this pulse.
 * The dataflow, time stamp and field modification values are copied over.
 * By default, new empty ADD, REM and MOD arrays are created.
 * @param {number} flags - Integer of boolean flags indicating which (if any)
 *   tuple arrays should be copied to the new pulse. The supported flag values
 *   are ADD, REM and MOD. Array references are copied directly: new array
 *   instances are not created.
 * @return {Pulse} - The forked pulse instance.
 * @see init
 */
prototype.fork = function(flags) {
  return new Pulse(this.dataflow).init(this, flags);
};

/**
 * Creates a copy of this pulse with new materialized array
 * instances for the ADD, REM, MOD, and SOURCE arrays.
 * The dataflow, time stamp and field modification values are copied over.
 * @return {Pulse} - The cloned pulse instance.
 * @see init
 */
prototype.clone = function() {
  const p = this.fork(ALL);
  p.add = p.add.slice();
  p.rem = p.rem.slice();
  p.mod = p.mod.slice();
  if (p.source) p.source = p.source.slice();
  return p.materialize(ALL | SOURCE);
};

/**
 * Returns a pulse that adds all tuples from a backing source. This is
 * useful for cases where operators are added to a dataflow after an
 * upstream data pipeline has already been processed, ensuring that
 * new operators can observe all tuples within a stream.
 * @return {Pulse} - A pulse instance with all source tuples included
 *   in the add array. If the current pulse already has all source
 *   tuples in its add array, it is returned directly. If the current
 *   pulse does not have a backing source, it is returned directly.
 */
prototype.addAll = function() {
  let p = this;
  if (!p.source || p.source.length === p.add.length) {
    return p;
  } else {
    p = new Pulse(this.dataflow).init(this);
    p.add = p.source;
    return p;
  }
};

/**
 * Initialize this pulse based on the values of another pulse. This method
 * is used internally by {@link fork} to initialize a new forked tuple.
 * The dataflow, time stamp and field modification values are copied over.
 * By default, new empty ADD, REM and MOD arrays are created.
 * @param {Pulse} src - The source pulse to copy from.
 * @param {number} flags - Integer of boolean flags indicating which (if any)
 *   tuple arrays should be copied to the new pulse. The supported flag values
 *   are ADD, REM and MOD. Array references are copied directly: new array
 *   instances are not created. By default, source data arrays are copied
 *   to the new pulse. Use the NO_SOURCE flag to enforce a null source.
 * @return {Pulse} - Returns this Pulse instance.
 */
prototype.init = function(src, flags) {
  const p = this;
  p.stamp = src.stamp;
  p.encode = src.encode;

  if (src.fields && !(flags & NO_FIELDS)) {
    p.fields = src.fields;
  }

  if (flags & ADD) {
    p.addF = src.addF;
    p.add = src.add;
  } else {
    p.addF = null;
    p.add = [];
  }

  if (flags & REM) {
    p.remF = src.remF;
    p.rem = src.rem;
  } else {
    p.remF = null;
    p.rem = [];
  }

  if (flags & MOD) {
    p.modF = src.modF;
    p.mod = src.mod;
  } else {
    p.modF = null;
    p.mod = [];
  }

  if (flags & NO_SOURCE) {
    p.srcF = null;
    p.source = null;
  } else {
    p.srcF = src.srcF;
    p.source = src.source;
    if (src.cleans) p.cleans = src.cleans;
  }

  return p;
};

/**
 * Schedules a function to run after pulse propagation completes.
 * @param {function} func - The function to run.
 */
prototype.runAfter = function(func) {
  this.dataflow.runAfter(func);
};

/**
 * Indicates if tuples have been added, removed or modified.
 * @param {number} [flags] - The tuple types (ADD, REM or MOD) to query.
 *   Defaults to ALL, returning true if any tuple type has changed.
 * @return {boolean} - Returns true if one or more queried tuple types have
 *   changed, false otherwise.
 */
prototype.changed = function(flags) {
  var f = flags || ALL;
  return ((f & ADD) && this.add.length)
      || ((f & REM) && this.rem.length)
      || ((f & MOD) && this.mod.length);
};

/**
 * Forces a "reflow" of tuple values, such that all tuples in the backing
 * source are added to the MOD set, unless already present in the ADD set.
 * @param {boolean} [fork=false] - If true, returns a forked copy of this
 *   pulse, and invokes reflow on that derived pulse.
 * @return {Pulse} - The reflowed pulse instance.
 */
prototype.reflow = function(fork) {
  if (fork) return this.fork(ALL).reflow();

  var len = this.add.length,
      src = this.source && this.source.length;
  if (src && src !== len) {
    this.mod = this.source;
    if (len) this.filter(MOD, filter(this, ADD));
  }
  return this;
};

/**
 * Get/set metadata to pulse requesting garbage collection
 * to reclaim currently unused resources.
 */
prototype.clean = function(value) {
  if (arguments.length) {
    this.cleans = !!value;
    return this;
  } else {
    return this.cleans;
  }
};

/**
 * Marks one or more data field names as modified to assist dependency
 * tracking and incremental processing by transform operators.
 * @param {string|Array<string>} _ - The field(s) to mark as modified.
 * @return {Pulse} - This pulse instance.
 */
prototype.modifies = function(_) {
  var hash = this.fields || (this.fields = {});
  if (isArray(_)) {
    _.forEach(f => hash[f] = true);
  } else {
    hash[_] = true;
  }
  return this;
};

/**
 * Checks if one or more data fields have been modified during this pulse
 * propagation timestamp.
 * @param {string|Array<string>} _ - The field(s) to check for modified.
 * @param {boolean} nomod - If true, will check the modified flag even if
 *   no mod tuples exist. If false (default), mod tuples must be present.
 * @return {boolean} - Returns true if any of the provided fields has been
 *   marked as modified, false otherwise.
 */
prototype.modified = function(_, nomod) {
  var fields = this.fields;
  return !((nomod || this.mod.length) && fields) ? false
    : !arguments.length ? !!fields
    : isArray(_) ? _.some(f => fields[f])
    : fields[_];
};

/**
 * Adds a filter function to one more tuple sets. Filters are applied to
 * backing tuple arrays, to determine the actual set of tuples considered
 * added, removed or modified. They can be used to delay materialization of
 * a tuple set in order to avoid expensive array copies. In addition, the
 * filter functions can serve as value transformers: unlike standard predicate
 * function (which return boolean values), Pulse filters should return the
 * actual tuple value to process. If a tuple set is already filtered, the
 * new filter function will be appended into a conjuntive ('and') query.
 * @param {number} flags - Flags indicating the tuple set(s) to filter.
 * @param {function(*):object} filter - Filter function that will be applied
 *   to the tuple set array, and should return a data tuple if the value
 *   should be included in the tuple set, and falsy (or null) otherwise.
 * @return {Pulse} - Returns this pulse instance.
 */
prototype.filter = function(flags, filter) {
  var p = this;
  if (flags & ADD) p.addF = addFilter(p.addF, filter);
  if (flags & REM) p.remF = addFilter(p.remF, filter);
  if (flags & MOD) p.modF = addFilter(p.modF, filter);
  if (flags & SOURCE) p.srcF = addFilter(p.srcF, filter);
  return p;
};

function addFilter(a, b) {
  return a
    ? (t, i) => a(t, i) && b(t, i)
    : b;
}

/**
 * Materialize one or more tuple sets in this pulse. If the tuple set(s) have
 * a registered filter function, it will be applied and the tuple set(s) will
 * be replaced with materialized tuple arrays.
 * @param {number} flags - Flags indicating the tuple set(s) to materialize.
 * @return {Pulse} - Returns this pulse instance.
 */
prototype.materialize = function(flags) {
  flags = flags || ALL;
  var p = this;
  if ((flags & ADD) && p.addF) {
    p.add = materialize(p.add, p.addF);
    p.addF = null;
  }
  if ((flags & REM) && p.remF) {
    p.rem = materialize(p.rem, p.remF);
    p.remF = null;
  }
  if ((flags & MOD) && p.modF) {
    p.mod = materialize(p.mod, p.modF);
    p.modF = null;
  }
  if ((flags & SOURCE) && p.srcF) {
    p.source = p.source.filter(p.srcF);
    p.srcF = null;
  }
  return p;
};

function materialize(data, filter) {
  var out = [];
  visitArray(data, filter, _ => out.push(_));
  return out;
}

function filter(pulse, flags) {
  var map = {};
  pulse.visit(flags, function(t) { map[tupleid(t)] = 1; });
  return t => map[tupleid(t)] ? null : t;
}

/**
 * Visit one or more tuple sets in this pulse.
 * @param {number} flags - Flags indicating the tuple set(s) to visit.
 *   Legal values are ADD, REM, MOD and SOURCE (if a backing data source
 *   has been set).
 * @param {function(object):*} - Visitor function invoked per-tuple.
 * @return {Pulse} - Returns this pulse instance.
 */
prototype.visit = function(flags, visitor) {
  var p = this, v = visitor, src, sum;

  if (flags & SOURCE) {
    visitArray(p.source, p.srcF, v);
    return p;
  }

  if (flags & ADD) visitArray(p.add, p.addF, v);
  if (flags & REM) visitArray(p.rem, p.remF, v);
  if (flags & MOD) visitArray(p.mod, p.modF, v);

  if ((flags & REFLOW) && (src = p.source)) {
    sum = p.add.length + p.mod.length;
    if (sum === src.length) {
      // do nothing
    } else if (sum) {
      visitArray(src, filter(p, ADD_MOD), v);
    } else {
      // if no add/rem/mod tuples, visit source
      visitArray(src, p.srcF, v);
    }
  }

  return p;
};
