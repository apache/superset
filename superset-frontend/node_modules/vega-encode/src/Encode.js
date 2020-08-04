import {Transform} from 'vega-dataflow';
import {falsy, inherits, isArray} from 'vega-util';

/**
 * Invokes encoding functions for visual items.
 * @constructor
 * @param {object} params - The parameters to the encoding functions. This
 *   parameter object will be passed through to all invoked encoding functions.
 * @param {object} [params.mod=false] - Flag indicating if tuples in the input
 *   mod set that are unmodified by encoders should be included in the output.
 * @param {object} param.encoders - The encoding functions
 * @param {function(object, object): boolean} [param.encoders.update] - Update encoding set
 * @param {function(object, object): boolean} [param.encoders.enter] - Enter encoding set
 * @param {function(object, object): boolean} [param.encoders.exit] - Exit encoding set
 */
export default function Encode(params) {
  Transform.call(this, null, params);
}

var prototype = inherits(Encode, Transform);

prototype.transform = function(_, pulse) {
  var out = pulse.fork(pulse.ADD_REM),
      fmod = _.mod || false,
      encoders = _.encoders,
      encode = pulse.encode;

  // if an array, the encode directive includes additional sets
  // that must be defined in order for the primary set to be invoked
  // e.g., only run the update set if the hover set is defined
  if (isArray(encode)) {
    if (out.changed() || encode.every(function(e) { return encoders[e]; })) {
      encode = encode[0];
      out.encode = null; // consume targeted encode directive
    } else {
      return pulse.StopPropagation;
    }
  }

  // marshall encoder functions
  var reenter = encode === 'enter',
      update = encoders.update || falsy,
      enter = encoders.enter || falsy,
      exit = encoders.exit || falsy,
      set = (encode && !reenter ? encoders[encode] : update) || falsy;

  if (pulse.changed(pulse.ADD)) {
    pulse.visit(pulse.ADD, function(t) { enter(t, _); update(t, _); });
    out.modifies(enter.output);
    out.modifies(update.output);
    if (set !== falsy && set !== update) {
      pulse.visit(pulse.ADD, function(t) { set(t, _); });
      out.modifies(set.output);
    }
  }

  if (pulse.changed(pulse.REM) && exit !== falsy) {
    pulse.visit(pulse.REM, function(t) { exit(t, _); });
    out.modifies(exit.output);
  }

  if (reenter || set !== falsy) {
    var flag = pulse.MOD | (_.modified() ? pulse.REFLOW : 0);
    if (reenter) {
      pulse.visit(flag, function(t) {
        var mod = enter(t, _) || fmod;
        if (set(t, _) || mod) out.mod.push(t);
      });
      if (out.mod.length) out.modifies(enter.output);
    } else {
      pulse.visit(flag, function(t) {
        if (set(t, _) || fmod) out.mod.push(t);
      });
    }
    if (out.mod.length) out.modifies(set.output);
  }

  return out.changed() ? out : pulse.StopPropagation;
};
