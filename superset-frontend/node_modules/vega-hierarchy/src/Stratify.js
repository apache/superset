import lookup from './lookup';
import {Transform} from 'vega-dataflow';
import {error, inherits, truthy} from 'vega-util';
import {stratify} from 'd3-hierarchy';

 /**
  * Stratify a collection of tuples into a tree structure based on
  * id and parent id fields.
  * @constructor
  * @param {object} params - The parameters for this operator.
  * @param {function(object): *} params.key - Unique key field for each tuple.
  * @param {function(object): *} params.parentKey - Field with key for parent tuple.
  */
export default function Stratify(params) {
  Transform.call(this, null, params);
}

Stratify.Definition = {
  'type': 'Stratify',
  'metadata': {'treesource': true},
  'params': [
    { 'name': 'key', 'type': 'field', 'required': true },
    { 'name': 'parentKey', 'type': 'field', 'required': true  }
  ]
};

var prototype = inherits(Stratify, Transform);

prototype.transform = function(_, pulse) {
  if (!pulse.source) {
    error('Stratify transform requires an upstream data source.');
  }

  var tree = this.value,
      mod = _.modified(),
      out = pulse.fork(pulse.ALL).materialize(pulse.SOURCE),
      run = !this.value
         || mod
         || pulse.changed(pulse.ADD_REM)
         || pulse.modified(_.key.fields)
         || pulse.modified(_.parentKey.fields);

  // prevent upstream source pollution
  out.source = out.source.slice();

  if (run) {
    if (out.source.length) {
      tree = lookup(
        stratify().id(_.key).parentId(_.parentKey)(out.source)
        , _.key, truthy);
    } else {
      tree = lookup(stratify()([{}]), _.key, _.key);
    }
  }

  out.source.root = this.value = tree;
  return out;
};
