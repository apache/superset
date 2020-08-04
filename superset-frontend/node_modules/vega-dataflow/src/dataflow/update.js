import Pulse from '../Pulse';

var NO_OPT = {skip: false, force: false};

/**
 * Touches an operator, scheduling it to be evaluated. If invoked outside of
 * a pulse propagation, the operator will be evaluated the next time this
 * dataflow is run. If invoked in the midst of pulse propagation, the operator
 * will be queued for evaluation if and only if the operator has not yet been
 * evaluated on the current propagation timestamp.
 * @param {Operator} op - The operator to touch.
 * @param {object} [options] - Additional options hash.
 * @param {boolean} [options.skip] - If true, the operator will
 *   be skipped: it will not be evaluated, but its dependents will be.
 * @return {Dataflow}
 */
export function touch(op, options) {
  var opt = options || NO_OPT;
  if (this._pulse) {
    // if in midst of propagation, add to priority queue
    this._enqueue(op);
  } else {
    // otherwise, queue for next propagation
    this._touched.add(op);
  }
  if (opt.skip) op.skip(true);
  return this;
}

/**
 * Updates the value of the given operator.
 * @param {Operator} op - The operator to update.
 * @param {*} value - The value to set.
 * @param {object} [options] - Additional options hash.
 * @param {boolean} [options.force] - If true, the operator will
 *   be re-evaluated even if its value has not changed.
 * @param {boolean} [options.skip] - If true, the operator will
 *   be skipped: it will not be evaluated, but its dependents will be.
 * @return {Dataflow}
 */
export function update(op, value, options) {
  var opt = options || NO_OPT;
  if (op.set(value) || opt.force) {
    this.touch(op, opt);
  }
  return this;
}

/**
 * Pulses an operator with a changeset of tuples. If invoked outside of
 * a pulse propagation, the pulse will be applied the next time this
 * dataflow is run. If invoked in the midst of pulse propagation, the pulse
 * will be added to the set of active pulses and will be applied if and
 * only if the target operator has not yet been evaluated on the current
 * propagation timestamp.
 * @param {Operator} op - The operator to pulse.
 * @param {ChangeSet} value - The tuple changeset to apply.
 * @param {object} [options] - Additional options hash.
 * @param {boolean} [options.skip] - If true, the operator will
 *   be skipped: it will not be evaluated, but its dependents will be.
 * @return {Dataflow}
 */
export function pulse(op, changeset, options) {
  this.touch(op, options || NO_OPT);

  var p = new Pulse(this, this._clock + (this._pulse ? 0 : 1)),
      t = op.pulse && op.pulse.source || [];

  p.target = op;
  this._input[op.id] = changeset.pulse(p, t);

  return this;
}
