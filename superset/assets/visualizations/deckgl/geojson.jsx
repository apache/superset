import React from 'react';
import ReactDOM from 'react-dom';
import { GeoJsonLayer } from 'deck.gl';

import DeckGLContainer from './DeckGLContainer';

const propertyMap = {
  color: 'fillColor',
  fill: 'fillColor',
  'fill-color': 'fillColor',
  'stroke-color': 'strokeColor',
  'stroke-width': 'strokeWidth',
}

const convertGeoJsonProps = (p) => {
  const obj = {}
  Object.entries(p).forEach(
    ([key, value]) => { obj[(propertyMap[key]) ? propertyMap[key] : key] = value }
  );
  return obj
}

function DeckGeoJsonLayer(slice, payload, setControlValue) {
  const fd = slice.formData;
  const fillColor = fd.fill_color_picker;
  const strokeColor = fd.stroke_color_picker;
  const pointRadiusScale = fd.point_radius_scale;
  const data = payload.data.geojson.features.map(d => ({
    ...d,
    properties: convertGeoJsonProps(d.properties),
  }));

  const layer = new GeoJsonLayer({
    id: 'geojson-layer',
    data,
    filled: true,
    stroked: false,
    extruded: true,
    pointRadiusScale: pointRadiusScale,
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
