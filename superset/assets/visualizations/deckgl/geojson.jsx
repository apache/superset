import React from 'react';
import ReactDOM from 'react-dom';
import { GeoJsonLayer } from 'deck.gl';
import { hexToRGB } from '../../javascripts/modules/colors';

import DeckGLContainer from './DeckGLContainer';

const propertyMap = {
  color: 'fillColor',
  fill: 'fillColor',
  'fill-color': 'fillColor',
  'stroke-color': 'strokeColor',
  'stroke-width': 'strokeWidth',
};

const convertGeoJsonColorProps = (p, colors) => {
  const obj = {};
  Object.entries(p).forEach(
    ([key, value]) => {
      if (propertyMap[key]) {
        const colorObj = colors[mappedColorKey];
        obj[mappedColorKey] = (colorObj[3] > 0) ? colorObj : hexToRGB(value);
      } else {
        obj[key] = value;
      }
    },
  );
  return obj;
};

function DeckGeoJsonLayer(slice, payload, setControlValue) {
  const fd = slice.formData;
  const fc = fd.fill_color_picker;
  const sc = fd.stroke_color_picker;
  const data = payload.data.geojson.features.map(d => ({
    ...d,
    properties: convertGeoJsonColorProps(d.properties, {
      fillColor: [fc.r, fc.g, fc.b, 255 * fc.a],
      strokeColor: [sc.r, sc.g, sc.b, 255 * sc.a],
    }),
  }));

  const layer = new GeoJsonLayer({
    id: 'geojson-layer',
    data,
    filled: true,
    stroked: false,
    extruded: true,
    pointRadiusScale: fd.point_radius_scale,
  });

  const viewport = {
    ...fd.viewport,
    width: slice.width(),
    height: slice.height(),
  };
  ReactDOM.render(
    <DeckGLContainer
      mapboxApiAccessToken={payload.data.mapboxApiKey}
      viewport={viewport}
      layers={[layer]}
      mapStyle={fd.mapbox_style}
      setControlValue={setControlValue}
    />,
    document.getElementById(slice.containerId),
  );
}
module.exports = DeckGeoJsonLayer;
