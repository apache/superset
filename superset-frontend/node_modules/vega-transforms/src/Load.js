import {Transform, ingest} from 'vega-dataflow';
import {array, inherits} from 'vega-util';

/**
 * Load and parse data from an external source. Marshalls parameter
 * values and then invokes the Dataflow request method.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {string} params.url - The URL to load from.
 * @param {object} params.format - The data format options.
 */
export default function Load(params) {
  Transform.call(this, [], params);
  this._pending = null;
}

var prototype = inherits(Load, Transform);

prototype.transform = function(_, pulse) {
  const df = pulse.dataflow;

  if (this._pending) {
    // update state and return pulse
    return output(this, pulse, this._pending);
  }

  if (stop(_)) return pulse.StopPropagation;

  if (_.values) {
    // parse and ingest values, return output pulse
    return output(this, pulse, df.parse(_.values, _.format));
  } else if (_.async) {
    // return promise for non-blocking async loading
    const p = df.request(_.url, _.format).then(res => {
      this._pending = array(res.data);
      return df => df.touch(this);
    });
    return {async: p};
  } else {
    // return promise for synchronous loading
    return df.request(_.url, _.format)
      .then(res => output(this, pulse, array(res.data)));
  }
};

function stop(_) {
  return _.modified('async') && !(
    _.modified('values') || _.modified('url') || _.modified('format')
  );
}

function output(op, pulse, data) {
  data.forEach(ingest);
  const out = pulse.fork(pulse.NO_FIELDS & pulse.NO_SOURCE);
  out.rem = op.value;
  op.value = out.source = out.add = data;
  op._pending = null;
  if (out.rem.length) out.clean(true);
  return out;
}
