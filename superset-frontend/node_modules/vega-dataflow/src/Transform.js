import Operator from './Operator';
import {inherits} from 'vega-util';

/**
 * Abstract class for operators that process data tuples.
 * Subclasses must provide a {@link transform} method for operator processing.
 * @constructor
 * @param {*} [init] - The initial value for this operator.
 * @param {object} [params] - The parameters for this operator.
 * @param {Operator} [source] - The operator from which to receive pulses.
 */
export default function Transform(init, params) {
  Operator.call(this, init, null, params);
}

var prototype = inherits(Transform, Operator);

/**
 * Overrides {@link Operator.evaluate} for transform operators.
 * Internally, this method calls {@link evaluate} to perform processing.
 * If {@link evaluate} returns a falsy value, the input pulse is returned.
 * This method should NOT be overridden, instead overrride {@link evaluate}.
 * @param {Pulse} pulse - the current dataflow pulse.
 * @return the output pulse for this operator (or StopPropagation)
 */
prototype.run = function(pulse) {
  if (pulse.stamp < this.stamp) return pulse.StopPropagation;

  var rv;
  if (this.skip()) {
    this.skip(false);
  } else {
    rv = this.evaluate(pulse);
  }
  rv = rv || pulse;

  if (rv.then) {
    rv = rv.then(_ => this.pulse =_);
  } else if (rv !== pulse.StopPropagation) {
    this.pulse = rv;
  }

  return rv;
};

/**
 * Overrides {@link Operator.evaluate} for transform operators.
 * Marshalls parameter values and then invokes {@link transform}.
 * @param {Pulse} pulse - the current dataflow pulse.
 * @return {Pulse} The output pulse (or StopPropagation). A falsy return
     value (including undefined) will let the input pulse pass through.
 */
prototype.evaluate = function(pulse) {
  var params = this.marshall(pulse.stamp),
      out = this.transform(params, pulse);
  params.clear();
  return out;
};

/**
 * Process incoming pulses.
 * Subclasses should override this method to implement transforms.
 * @param {Parameters} _ - The operator parameter values.
 * @param {Pulse} pulse - The current dataflow pulse.
 * @return {Pulse} The output pulse (or StopPropagation). A falsy return
 *   value (including undefined) will let the input pulse pass through.
 */
prototype.transform = function() {};
