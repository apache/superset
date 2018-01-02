import React from 'react';
import ReactDOM from 'react-dom';

import DeckGLContainer from './DeckGLContainer';
import layerGenerators from './layers';

export default function deckglFactory(slice, payload, setControlValue) {
  const fd = slice.formData;
  const layer = layerGenerators[fd.viz_type](fd, payload);
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
