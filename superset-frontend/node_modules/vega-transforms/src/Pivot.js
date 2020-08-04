import Aggregate from './Aggregate';
import {ValidAggregateOps} from './util/AggregateOps';
import {accessor, accessorFields, inherits} from 'vega-util';

/**
 * Aggregate and pivot selected field values to become new fields.
 * This operator is useful to construction cross-tabulations.
 * @constructor
 * @param {Array<function(object): *>} [params.groupby] - An array of accessors
 *  to groupby. These fields act just like groupby fields of an Aggregate transform.
 * @param {function(object): *} params.field - The field to pivot on. The unique
 *  values of this field become new field names in the output stream.
 * @param {function(object): *} params.value - The field to populate pivoted fields.
 *  The aggregate values of this field become the values of the new pivoted fields.
 * @param {string} [params.op] - The aggregation operation for the value field,
 *  applied per cell in the output stream. The default is "sum".
 * @param {number} [params.limit] - An optional parameter indicating the maximum
 *  number of pivoted fields to generate. The pivoted field names are sorted in
 *  ascending order prior to enforcing the limit.
 */
export default function Pivot(params) {
  Aggregate.call(this, params);
}

Pivot.Definition = {
  'type': 'Pivot',
  'metadata': {'generates': true, 'changes': true},
  'params': [
    { 'name': 'groupby', 'type': 'field', 'array': true },
    { 'name': 'field', 'type': 'field', 'required': true },
    { 'name': 'value', 'type': 'field', 'required': true },
    { 'name': 'op', 'type': 'enum', 'values': ValidAggregateOps, 'default': 'sum' },
    { 'name': 'limit', 'type': 'number', 'default': 0 },
    { 'name': 'key', 'type': 'field' }
  ]
};

var prototype = inherits(Pivot, Aggregate);

prototype._transform = prototype.transform;

prototype.transform = function(_, pulse) {
  return this._transform(aggregateParams(_, pulse), pulse);
};

// Shoehorn a pivot transform into an aggregate transform!
// First collect all unique pivot field values.
// Then generate aggregate fields for each output pivot field.
function aggregateParams(_, pulse) {
  var key    = _.field,
      value  = _.value,
      op     = (_.op === 'count' ? '__count__' : _.op) || 'sum',
      fields = accessorFields(key).concat(accessorFields(value)),
      keys   = pivotKeys(key, _.limit || 0, pulse);

  // if data stream content changes, pivot fields may change
  // flag parameter modification to ensure re-initialization
  if (pulse.changed()) _.set('__pivot__', null, null, true);

  return {
    key:      _.key,
    groupby:  _.groupby,
    ops:      keys.map(function() { return op; }),
    fields:   keys.map(function(k) { return get(k, key, value, fields); }),
    as:       keys.map(function(k) { return k + ''; }),
    modified: _.modified.bind(_)
  };
}

// Generate aggregate field accessor.
// Output NaN for non-existent values; aggregator will ignore!
function get(k, key, value, fields) {
  return accessor(
    function(d) { return key(d) === k ? value(d) : NaN; },
    fields,
    k + ''
  );
}

// Collect (and optionally limit) all unique pivot values.
function pivotKeys(key, limit, pulse) {
  var map = {},
      list = [];

  pulse.visit(pulse.SOURCE, function(t) {
    var k = key(t);
    if (!map[k]) {
      map[k] = 1;
      list.push(k);
    }
  });

  // TODO? Move this comparator to vega-util?
  list.sort(function(u, v) {
    return (u<v||u==null) && v!=null ? -1
      : (u>v||v==null) && u!=null ? 1
      : ((v=v instanceof Date?+v:v),(u=u instanceof Date?+u:u))!==u && v===v ? -1
      : v!==v && u===u ? 1 : 0;
  });

  return limit ? list.slice(0, limit) : list;
}
