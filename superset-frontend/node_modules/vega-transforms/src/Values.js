import {Transform, stableCompare} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Extracts an array of values. Assumes the source data has already been
 * reduced as needed (e.g., by an upstream Aggregate transform).
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.field - The domain field to extract.
 * @param {function(*,*): number} [params.sort] - An optional
 *   comparator function for sorting the values. The comparator will be
 *   applied to backing tuples prior to value extraction.
 */
export default function Values(params) {
  Transform.call(this, null, params);
}

var prototype = inherits(Values, Transform);

prototype.transform = function(_, pulse) {
  var run = !this.value
    || _.modified('field')
    || _.modified('sort')
    || pulse.changed()
    || (_.sort && pulse.modified(_.sort.fields));

  if (run) {
    this.value = (_.sort
      ? pulse.source.slice().sort(stableCompare(_.sort))
      : pulse.source).map(_.field);
  }
};
