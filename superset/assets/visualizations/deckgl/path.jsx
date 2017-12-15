import React from 'react';
import ReactDOM from 'react-dom';
import { PathLayer } from 'deck.gl';

import DeckGLContainer from './DeckGLContainer';

function deckPath(slice, payload, setControlValue) {
  const fd = slice.formData;
  const c = fd.color_picker;
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  const data = payload.data.paths.map(path => ({
    path,
    width: fd.line_width,
    color: fixedColor,
  }));

  const layer = new PathLayer({
    id: `path-layer-${slice.containerId}`,
    data,
    rounded: true,
    widthScale: 1,
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
module.exports = deckPath;
