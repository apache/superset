import React from 'react';
import ReactDOM from 'react-dom';
import { ScreenGridLayer } from 'deck.gl';

import DeckGLContainer from './DeckGLContainer';

function deckScreenGridLayer(slice, payload, setControlValue) {
  const fd = slice.formData;
  const c = fd.color_picker;
  const data = payload.data.features.map(d => ({
    ...d,
    color: [c.r, c.g, c.b, 255 * c.a],
  }));

  const viewport = {
    ...fd.viewport,
    width: slice.width(),
    height: slice.height(),
  };
  // Passing a layer creator function instead of a layer since the
  // layer needs to be regenerated at each render
  const layer = () => new ScreenGridLayer({
    id: `screengrid-layer-${slice.containerId}`,
    data,
    pickable: true,
    cellSizePixels: fd.grid_size,
    minColor: [c.r, c.g, c.b, 0],
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getWeight: d => d.weight || 0,
  });
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
