import {Feature, FeatureCollection, MultiPoint} from './constants';
import {Transform} from 'vega-dataflow';
import {accessorFields, identity, inherits} from 'vega-util';

/**
 * Consolidate an array of [longitude, latitude] points or GeoJSON features
 * into a combined GeoJSON object. This transform is particularly useful for
 * combining geo data for a Projection's fit argument. The resulting GeoJSON
 * data is available as this transform's value. Input pulses are unchanged.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Array<function(object): *>} [params.fields] - A two-element array
 *   of field accessors for the longitude and latitude values.
 * @param {function(object): *} params.geojson - A field accessor for
 *   retrieving GeoJSON feature data.
 */
export default function GeoJSON(params) {
  Transform.call(this, null, params);
}

GeoJSON.Definition = {
  'type': 'GeoJSON',
  'metadata': {},
  'params': [
    { 'name': 'fields', 'type': 'field', 'array': true, 'length': 2 },
    { 'name': 'geojson', 'type': 'field' }
  ]
};

var prototype = inherits(GeoJSON, Transform);

prototype.transform = function(_, pulse) {
  var features = this._features,
      points = this._points,
      fields = _.fields,
      lon = fields && fields[0],
      lat = fields && fields[1],
      geojson = _.geojson || (!fields && identity),
      flag = pulse.ADD,
      mod;

  mod = _.modified()
    || pulse.changed(pulse.REM)
    || pulse.modified(accessorFields(geojson))
    || (lon && (pulse.modified(accessorFields(lon))))
    || (lat && (pulse.modified(accessorFields(lat))));

  if (!this.value || mod) {
    flag = pulse.SOURCE;
    this._features = (features = []);
    this._points = (points = []);
  }

  if (geojson) {
    pulse.visit(flag, function(t) {
      features.push(geojson(t));
    });
  }

  if (lon && lat) {
    pulse.visit(flag, function(t) {
      var x = lon(t),
          y = lat(t);
      if (x != null && y != null && (x = +x) === x && (y = +y) === y) {
        points.push([x, y]);
      }
    });
    features = features.concat({
      type: Feature,
      geometry: {
        type: MultiPoint,
        coordinates: points
      }
    });
  }

  this.value = {
    type: FeatureCollection,
    features: features
  };
};
