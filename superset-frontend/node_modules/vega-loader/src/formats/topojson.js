import json from './json';
import {feature, mesh} from 'topojson-client';
import {error} from 'vega-util';

const filters = {
  interior: (a, b) => a !== b,
  exterior: (a, b) => a === b
};

export default function topojson(data, format) {
  let method, object, property, filter;
  data = json(data, format);

  if (format && format.feature) {
    method = feature;
    property = format.feature;
  } else if (format && format.mesh) {
    method = mesh;
    property = format.mesh;
    filter = filters[format.filter];
  } else {
    error('Missing TopoJSON feature or mesh parameter.');
  }

  object = (object = data.objects[property])
    ? method(data, object, filter)
    : error('Invalid TopoJSON object: ' + property);

  return object && object.features || [object];
}

topojson.responseType = 'json';
