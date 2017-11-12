import React from 'react';
import ReactDOM from 'react-dom';
import { GridLayer } from 'deck.gl';

import DeckGLContainer from './DeckGLContainer';

function deckScreenGridLayer(slice, payload, setControlValue) {
  const fd = slice.formData;
  const c = fd.color_picker;
  const data = payload.data.features.map(d => ({
    ...d,
    color: [c.r, c.g, c.b, 255 * c.a],
  }));

  const layer = new GridLayer({
    id: `grid-layer-${slice.containerId}`,
    data,
    pickable: true,
    cellSize: fd.grid_size,
    minColor: [0, 0, 0, 0],
    extruded: fd.extruded,
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getElevationValue: points => points.reduce((sum, point) => sum + point.weight, 0),
    getColorValue: points => points.reduce((sum, point) => sum + point.weight, 0),
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
module.exports = deckScreenGridLayer;
