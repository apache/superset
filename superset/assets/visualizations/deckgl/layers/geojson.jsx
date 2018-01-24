import { GeoJsonLayer } from 'deck.gl';

import * as common from './common';
import { hexToRGB } from '../../../javascripts/modules/colors';
import sandboxedEval from '../../../javascripts/modules/sandbox';

const propertyMap = {
  fillColor: 'fillColor',
  color: 'fillColor',
  fill: 'fillColor',
  'fill-color': 'fillColor',
  strokeColor: 'strokeColor',
  'stroke-color': 'strokeColor',
  'stroke-width': 'strokeWidth',
};

const alterProps = (props, propOverrides) => {
  const newProps = {};
  Object.keys(props).forEach((k) => {
    if (k in propertyMap) {
      newProps[propertyMap[k]] = props[k];
    } else {
      newProps[k] = props[k];
    }
  });
  if (typeof props.fillColor === 'string') {
    newProps.fillColor = hexToRGB(p.fillColor);
  }
  if (typeof props.strokeColor === 'string') {
    newProps.strokeColor = hexToRGB(p.strokeColor);
  }
  return {
    ...newProps,
    ...propOverrides,
  };
};
let features;
const recurseGeoJson = (node, propOverrides, extraProps) => {
  if (node && node.features) {
    node.features.forEach((obj) => {
      recurseGeoJson(obj, propOverrides, node.extraProps || extraProps);
    });
  }
  if (node && node.geometry) {
    const newNode = {
      ...node,
      properties: alterProps(node.properties, propOverrides),
    };
    if (!newNode.extraProps) {
      newNode.extraProps = extraProps;
    }
    features.push(newNode);
  }
};

export default function geoJsonLayer(formData, payload, slice) {
  const fd = formData;
  const fc = fd.fill_color_picker;
  const sc = fd.stroke_color_picker;
  const fillColor = [fc.r, fc.g, fc.b, 255 * fc.a];
  const strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  const propOverrides = {};
  if (fillColor[3] > 0) {
    propOverrides.fillColor = fillColor;
  }
  if (strokeColor[3] > 0) {
    propOverrides.strokeColor = strokeColor;
  }

  features = [];
  recurseGeoJson(payload.data, propOverrides);

  let jsFnMutator;
  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    jsFnMutator = sandboxedEval(fd.js_data_mutator);
    features = jsFnMutator(features);
  }

  return new GeoJsonLayer({
    id: `geojson-layer-${fd.slice_id}`,
    filled: fd.filled,
    data: features,
    stroked: fd.stroked,
    extruded: fd.extruded,
    pointRadiusScale: fd.point_radius_scale,
    ...common.commonLayerProps(fd, slice),
  });
}
