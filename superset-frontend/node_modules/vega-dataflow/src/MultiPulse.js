import Pulse from './Pulse';
import {error, inherits, isArray} from 'vega-util';

/**
 * Represents a set of multiple pulses. Used as input for operators
 * that accept multiple pulses at a time. Contained pulses are
 * accessible via the public "pulses" array property. This pulse doe
 * not carry added, removed or modified tuples directly. However,
 * the visit method can be used to traverse all such tuples contained
 * in sub-pulses with a timestamp matching this parent multi-pulse.
 * @constructor
 * @param {Dataflow} dataflow - The backing dataflow instance.
 * @param {number} stamp - The timestamp.
 * @param {Array<Pulse>} pulses - The sub-pulses for this multi-pulse.
 */
export default function MultiPulse(dataflow, stamp, pulses, encode) {
  var p = this,
      c = 0,
      pulse, hash, i, n, f;

  this.dataflow = dataflow;
  this.stamp = stamp;
  this.fields = null;
  this.encode = encode || null;
  this.pulses = pulses;

  for (i=0, n=pulses.length; i<n; ++i) {
    pulse = pulses[i];
    if (pulse.stamp !== stamp) continue;

    if (pulse.fields) {
      hash = p.fields || (p.fields = {});
      for (f in pulse.fields) { hash[f] = 1; }
    }

    if (pulse.changed(p.ADD)) c |= p.ADD;
    if (pulse.changed(p.REM)) c |= p.REM;
    if (pulse.changed(p.MOD)) c |= p.MOD;
  }

  this.changes = c;
}

var prototype = inherits(MultiPulse, Pulse);

/**
 * Creates a new pulse based on the values of this pulse.
 * The dataflow, time stamp and field modification values are copied over.
 * @return {Pulse}
 */
prototype.fork = function(flags) {
  var p = new Pulse(this.dataflow).init(this, flags & this.NO_FIELDS);
  if (flags !== undefined) {
    if (flags & p.ADD) {
      this.visit(p.ADD, function(t) { return p.add.push(t); });
    }
    if (flags & p.REM) {
      this.visit(p.REM, function(t) { return p.rem.push(t); });
    }
    if (flags & p.MOD) {
      this.visit(p.MOD, function(t) { return p.mod.push(t); });
    }
  }
  return p;
};

prototype.changed = function(flags) {
  return this.changes & flags;
};

prototype.modified = function(_) {
  var p = this, fields = p.fields;
  return !(fields && (p.changes & p.MOD)) ? 0
    : isArray(_) ? _.some(function(f) { return fields[f]; })
    : fields[_];
};

prototype.filter = function() {
  error('MultiPulse does not support filtering.');
};

prototype.materialize = function() {
  error('MultiPulse does not support materialization.');
};

prototype.visit = function(flags, visitor) {
  var p = this,
      pulses = p.pulses,
      n = pulses.length,
      i = 0;

  if (flags & p.SOURCE) {
    for (; i<n; ++i) {
      pulses[i].visit(flags, visitor);
    }
  } else {
    for (; i<n; ++i) {
      if (pulses[i].stamp === p.stamp) {
        pulses[i].visit(flags, visitor);
      }
    }
  }

  return p;
};
