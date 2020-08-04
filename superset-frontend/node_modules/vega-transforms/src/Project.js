import {fieldNames} from './util/util';
import {Transform, ingest, rederive, tupleid} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Performs a relational projection, copying selected fields from source
 * tuples to a new set of derived tuples.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Array<function(object): *} params.fields - The fields to project,
 *   as an array of field accessors. If unspecified, all fields will be
 *   copied with names unchanged.
 * @param {Array<string>} [params.as] - Output field names for each projected
 *   field. Any unspecified fields will use the field name provided by
 *   the field accessor.
 */
export default function Project(params) {
  Transform.call(this, null, params);
}

Project.Definition = {
  'type': 'Project',
  'metadata': {'generates': true, 'changes': true},
  'params': [
    { 'name': 'fields', 'type': 'field', 'array': true },
    { 'name': 'as', 'type': 'string', 'null': true, 'array': true }
  ]
};

var prototype = inherits(Project, Transform);

prototype.transform = function(_, pulse) {
  var fields = _.fields,
      as = fieldNames(_.fields, _.as || []),
      derive = fields
        ? function(s, t) { return project(s, t, fields, as); }
        : rederive,
      out, lut;

  if (this.value) {
    lut = this.value;
  } else {
    pulse = pulse.addAll();
    lut = this.value = {};
  }

  out = pulse.fork(pulse.NO_SOURCE);

  pulse.visit(pulse.REM, function(t) {
    var id = tupleid(t);
    out.rem.push(lut[id]);
    lut[id] = null;
  });

  pulse.visit(pulse.ADD, function(t) {
    var dt = derive(t, ingest({}));
    lut[tupleid(t)] = dt;
    out.add.push(dt);
  });

  pulse.visit(pulse.MOD, function(t) {
    out.mod.push(derive(t, lut[tupleid(t)]));
  });

  return out;
};

function project(s, t, fields, as) {
  for (var i=0, n=fields.length; i<n; ++i) {
    t[as[i]] = fields[i](s);
  }
  return t;
}
