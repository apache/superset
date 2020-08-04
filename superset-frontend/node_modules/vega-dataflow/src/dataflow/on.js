import Operator from '../Operator';
import {isChangeSet} from '../ChangeSet';
import {constant, extend, isFunction} from 'vega-util';

var SKIP = {skip: true};

/**
 * Perform operator updates in response to events. Applies an
 * update function to compute a new operator value. If the update function
 * returns a {@link ChangeSet}, the operator will be pulsed with those tuple
 * changes. Otherwise, the operator value will be updated to the return value.
 * @param {EventStream|Operator} source - The event source to react to.
 *   This argument can be either an EventStream or an Operator.
 * @param {Operator|function(object):Operator} target - The operator to update.
 *   This argument can either be an Operator instance or (if the source
 *   argument is an EventStream), a function that accepts an event object as
 *   input and returns an Operator to target.
 * @param {function(Parameters,Event): *} [update] - Optional update function
 *   to compute the new operator value, or a literal value to set. Update
 *   functions expect to receive a parameter object and event as arguments.
 *   This function can either return a new operator value or (if the source
 *   argument is an EventStream) a {@link ChangeSet} instance to pulse
 *   the target operator with tuple changes.
 * @param {object} [params] - The update function parameters.
 * @param {object} [options] - Additional options hash. If not overridden,
 *   updated operators will be skipped by default.
 * @param {boolean} [options.skip] - If true, the operator will
 *  be skipped: it will not be evaluated, but its dependents will be.
 * @param {boolean} [options.force] - If true, the operator will
 *   be re-evaluated even if its value has not changed.
 * @return {Dataflow}
 */
export default function(source, target, update, params, options) {
  var fn = source instanceof Operator ? onOperator : onStream;
  fn(this, source, target, update, params, options);
  return this;
}

function onStream(df, stream, target, update, params, options) {
  var opt = extend({}, options, SKIP), func, op;

  if (!isFunction(target)) target = constant(target);

  if (update === undefined) {
    func = e => df.touch(target(e));
  } else if (isFunction(update)) {
    op = new Operator(null, update, params, false);
    func = e => {
      op.evaluate(e);
      const t = target(e), v = op.value;
      isChangeSet(v) ? df.pulse(t, v, options) : df.update(t, v, opt);
    };
  } else {
    func = e => df.update(target(e), update, opt);
  }

  stream.apply(func);
}

function onOperator(df, source, target, update, params, options) {
  if (update === undefined) {
    source.targets().add(target);
  } else {
    const opt = options || {},
          op = new Operator(null, updater(target, update), params, false);
    op.modified(opt.force);
    op.rank = source.rank;       // immediately follow source
    source.targets().add(op);    // add dependency

    if (target) {
      op.skip(true);             // skip first invocation
      op.value = target.value;   // initialize value
      op.targets().add(target);  // chain dependencies
      df.connect(target, [op]);  // rerank as needed, #1672
    }
  }
}

function updater(target, update) {
  update = isFunction(update) ? update : constant(update);
  return target
    ? function(_, pulse) {
        const value = update(_, pulse);
        if (!target.skip()) {
          target.skip(value !== this.value).value = value;
        }
        return value;
      }
    : update;
}
