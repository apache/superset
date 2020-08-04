import {Transform, stableCompare} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Sorts scenegraph items in the pulse source array.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(*,*): number} [params.sort] - A comparator
 *   function for sorting tuples.
 */
export default function SortItems(params) {
  Transform.call(this, null, params);
}

var prototype = inherits(SortItems, Transform);

prototype.transform = function(_, pulse) {
  var mod = _.modified('sort')
         || pulse.changed(pulse.ADD)
         || pulse.modified(_.sort.fields)
         || pulse.modified('datum');

  if (mod) pulse.source.sort(stableCompare(_.sort));

  this.modified(mod);
  return pulse;
};
