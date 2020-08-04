import {Transform, ingest, replace} from 'vega-dataflow';
import {inherits, isFunction} from 'vega-util';
import {geoGraticule} from 'd3-geo';

/**
 * GeoJSON feature generator for creating graticules.
 * @constructor
 */
export default function Graticule(params) {
  Transform.call(this, [], params);
  this.generator = geoGraticule();
}

Graticule.Definition = {
  'type': 'Graticule',
  'metadata': {'changes': true, 'generates': true},
  'params': [
    { 'name': 'extent', 'type': 'array', 'array': true, 'length': 2,
      'content': {'type': 'number', 'array': true, 'length': 2} },
    { 'name': 'extentMajor', 'type': 'array', 'array': true, 'length': 2,
      'content': {'type': 'number', 'array': true, 'length': 2} },
    { 'name': 'extentMinor', 'type': 'array', 'array': true, 'length': 2,
      'content': {'type': 'number', 'array': true, 'length': 2} },
    { 'name': 'step', 'type': 'number', 'array': true, 'length': 2 },
    { 'name': 'stepMajor', 'type': 'number', 'array': true, 'length': 2, 'default': [90, 360] },
    { 'name': 'stepMinor', 'type': 'number', 'array': true, 'length': 2, 'default': [10, 10] },
    { 'name': 'precision', 'type': 'number', 'default': 2.5 }
  ]
};

var prototype = inherits(Graticule, Transform);

prototype.transform = function(_, pulse) {
  var src = this.value,
      gen = this.generator, t;

  if (!src.length || _.modified()) {
    for (var prop in _) {
      if (isFunction(gen[prop])) {
        gen[prop](_[prop]);
      }
    }
  }

  t = gen();
  if (src.length) {
    pulse.mod.push(replace(src[0], t));
  } else {
    pulse.add.push(ingest(t));
  }
  src[0] = t;

  return pulse;
};
