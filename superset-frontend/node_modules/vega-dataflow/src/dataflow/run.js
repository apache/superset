/* eslint-disable require-atomic-updates */
import {default as Pulse, StopPropagation} from '../Pulse';
import MultiPulse from '../MultiPulse';
import asyncCallback from '../util/asyncCallback';
import UniqueList from '../util/UniqueList';
import {id, isArray} from 'vega-util';

/**
 * Evaluates the dataflow and returns a Promise that resolves when pulse
 * propagation completes. This method will increment the current timestamp
 * and process all updated, pulsed and touched operators. When invoked for
 * the first time, all registered operators will be processed. This method
 * should not be invoked by third-party clients, use {@link runAsync} or
 * {@link run} instead.
 * @param {string} [encode] - The name of an encoding set to invoke during
 *   propagation. This value is added to generated Pulse instances;
 *   operators can then respond to (or ignore) this setting as appropriate.
 *   This parameter can be used in conjunction with the Encode transform in
 *   the vega-encode package.
 * @param {function} [prerun] - An optional callback function to invoke
 *   immediately before dataflow evaluation commences.
 * @param {function} [postrun] - An optional callback function to invoke
 *   after dataflow evaluation completes. The callback will be invoked
 *   after those registered via {@link runAfter}.
 * @return {Promise} - A promise that resolves to this dataflow after
 *   evaluation completes.
 */
export async function evaluate(encode, prerun, postrun) {
  const df = this,
        async = [];

  // if the pulse value is set, this is a re-entrant call
  if (df._pulse) return reentrant(df);

  // wait for pending datasets to load
  if (df._pending) await df._pending;

  // invoke prerun function, if provided
  if (prerun) await asyncCallback(df, prerun);

  // exit early if there are no updates
  if (!df._touched.length) {
    df.debug('Dataflow invoked, but nothing to do.');
    return df;
  }

  // increment timestamp clock
  const stamp = ++df._clock;

  // set the current pulse
  df._pulse = new Pulse(df, stamp, encode);

  // initialize priority queue, reset touched operators
  df._touched.forEach(op => df._enqueue(op, true));
  df._touched = UniqueList(id);

  let count = 0, op, next, error;

  try {
    while (df._heap.size() > 0) {
      // dequeue operator with highest priority
      op = df._heap.pop();

      // re-queue if rank changed
      if (op.rank !== op.qrank) {
        df._enqueue(op, true);
        continue;
      }

      // otherwise, evaluate the operator
      next = op.run(df._getPulse(op, encode));

      if (next.then) {
        // await if operator returns a promise directly
        next = await next;
      } else if (next.async) {
        // queue parallel asynchronous execution
        async.push(next.async);
        next = StopPropagation;
      }

      // propagate evaluation, enqueue dependent operators
      if (next !== StopPropagation) {
        if (op._targets) op._targets.forEach(op => df._enqueue(op));
      }

      // increment visit counter
      ++count;
    }
  } catch (err) {
    df._heap.clear();
    error = err;
  }

  // reset pulse map
  df._input = {};
  df._pulse = null;

  df.debug(`Pulse ${stamp}: ${count} operators`);

  if (error) {
    df._postrun = [];
    df.error(error);
  }

  // invoke callbacks queued via runAfter
  if (df._postrun.length) {
    const pr = df._postrun.sort((a, b) => b.priority - a.priority);
    df._postrun = [];
    for (let i=0; i<pr.length; ++i) {
      await asyncCallback(df, pr[i].callback);
    }
  }

  // invoke postrun function, if provided
  if (postrun) await asyncCallback(df, postrun);

  // handle non-blocking asynchronous callbacks
  if (async.length) {
    Promise.all(async)
      .then(cb => df.runAsync(null, () => {
        cb.forEach(f => { try { f(df); } catch (err) { df.error(err); } });
      }));
  }

  return df;
}

/**
 * Queues dataflow evaluation to run once any other queued evaluations have
 * completed and returns a Promise that resolves when the queued pulse
 * propagation completes. If provided, a callback function will be invoked
 * immediately before evaluation commences. This method will ensure a
 * separate evaluation is invoked for each time it is called.
 * @param {string} [encode] - The name of an encoding set to invoke during
 *   propagation. This value is added to generated Pulse instances;
 *   operators can then respond to (or ignore) this setting as appropriate.
 *   This parameter can be used in conjunction with the Encode transform in
 *   the vega-encode package.
 * @param {function} [prerun] - An optional callback function to invoke
 *   immediately before dataflow evaluation commences.
 * @param {function} [postrun] - An optional callback function to invoke
 *   after dataflow evaluation completes. The callback will be invoked
 *   after those registered via {@link runAfter}.
 * @return {Promise} - A promise that resolves to this dataflow after
 *   evaluation completes.
 */
export async function runAsync(encode, prerun, postrun) {
  // await previously queued functions
  while (this._running) await this._running;

  // run dataflow, manage running promise
  const clear = () => this._running = null;
  (this._running = this.evaluate(encode, prerun, postrun))
    .then(clear, clear);

  return this._running;
}

/**
 * Requests dataflow evaluation and the immediately returns this dataflow
 * instance. If there are pending data loading or other asynchronous
 * operations, the dataflow will evaluate asynchronously after this method
 * has been invoked. To track when dataflow evaluation completes, use the
 * {@link runAsync} method instead. This method will raise an error if
 * invoked while the dataflow is already in the midst of evaluation.
 * @param {string} [encode] - The name of an encoding set to invoke during
 *   propagation. This value is added to generated Pulse instances;
 *   operators can then respond to (or ignore) this setting as appropriate.
 *   This parameter can be used in conjunction with the Encode transform in
 *   the vega-encode module.
 * @param {function} [prerun] - An optional callback function to invoke
 *   immediately before dataflow evaluation commences.
 * @param {function} [postrun] - An optional callback function to invoke
 *   after dataflow evaluation completes. The callback will be invoked
 *   after those registered via {@link runAfter}.
 * @return {Dataflow} - This dataflow instance.
 */
export function run(encode, prerun, postrun) {
  return this._pulse ? reentrant(this)
    : (this.evaluate(encode, prerun, postrun), this);
}

/**
 * Schedules a callback function to be invoked after the current pulse
 * propagation completes. If no propagation is currently occurring,
 * the function is invoked immediately. Callbacks scheduled via runAfter
 * are invoked immediately upon completion of the current cycle, before
 * any request queued via runAsync. This method is primarily intended for
 * internal use. Third-party callers using runAfter to schedule a callback
 * that invokes {@link run} or {@link runAsync} should not use this method,
 * but instead use {@link runAsync} with prerun or postrun arguments.
 * @param {function(Dataflow)} callback - The callback function to run.
 *   The callback will be invoked with this Dataflow instance as its
 *   sole argument.
 * @param {boolean} enqueue - A boolean flag indicating that the
 *   callback should be queued up to run after the next propagation
 *   cycle, suppressing immediate invocation when propagation is not
 *   currently occurring.
 * @param {number} [priority] - A priority value used to sort registered
 *   callbacks to determine execution order. This argument is intended
 *   for internal Vega use only.
 */
export function runAfter(callback, enqueue, priority) {
  if (this._pulse || enqueue) {
    // pulse propagation is currently running, queue to run after
    this._postrun.push({
      priority: priority || 0,
      callback: callback
    });
  } else {
    // pulse propagation already complete, invoke immediately
    try { callback(this); } catch (err) { this.error(err); }
  }
}

/**
 * Raise an error for re-entrant dataflow evaluation.
 */
function reentrant(df) {
  df.error('Dataflow already running. Use runAsync() to chain invocations.');
  return df;
}

/**
 * Enqueue an operator into the priority queue for evaluation. The operator
 * will be enqueued if it has no registered pulse for the current cycle, or if
 * the force argument is true. Upon enqueue, this method also sets the
 * operator's qrank to the current rank value.
 * @param {Operator} op - The operator to enqueue.
 * @param {boolean} [force] - A flag indicating if the operator should be
 *   forceably added to the queue, even if it has already been previously
 *   enqueued during the current pulse propagation. This is useful when the
 *   dataflow graph is dynamically modified and the operator rank changes.
 */
export function enqueue(op, force) {
  var q = op.stamp < this._clock;
  if (q) op.stamp = this._clock;
  if (q || force) {
    op.qrank = op.rank;
    this._heap.push(op);
  }
}

/**
 * Provide a correct pulse for evaluating an operator. If the operator has an
 * explicit source operator, we will try to pull the pulse(s) from it.
 * If there is an array of source operators, we build a multi-pulse.
 * Otherwise, we return a current pulse with correct source data.
 * If the pulse is the pulse map has an explicit target set, we use that.
 * Else if the pulse on the upstream source operator is current, we use that.
 * Else we use the pulse from the pulse map, but copy the source tuple array.
 * @param {Operator} op - The operator for which to get an input pulse.
 * @param {string} [encode] - An (optional) encoding set name with which to
 *   annotate the returned pulse. See {@link run} for more information.
 */
export function getPulse(op, encode) {
  var s = op.source,
      stamp = this._clock;

  return s && isArray(s)
    ? new MultiPulse(this, stamp, s.map(_ => _.pulse), encode)
    : this._input[op.id] || singlePulse(this._pulse, s && s.pulse);
}

function singlePulse(p, s) {
  if (s && s.stamp === p.stamp) {
    return s;
  }

  p = p.fork();
  if (s && s !== StopPropagation) {
    p.source = s.source;
  }
  return p;
}
