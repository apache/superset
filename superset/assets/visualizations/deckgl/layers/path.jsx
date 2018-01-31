import React from 'react';
import ReactDOM from 'react-dom';

import { PathLayer } from 'deck.gl';

import DeckGLContainer from './../DeckGLContainer';

import * as common from './common';
import sandboxedEval from '../../../javascripts/modules/sandbox';

function getLayer(formData, payload, slice) {
  const fd = formData;
  const c = fd.color_picker;
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  let data = payload.data.features.map(feature => ({
    ...feature,
    path: feature.path,
    width: fd.line_width,
    color: fixedColor,
  }));

  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  return new PathLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    rounded: true,
    widthScale: 1,
    ...common.commonLayerProps(fd, slice),
  });
}

function deckPath(slice, payload, setControlValue) {
  const layer = getLayer(slice.formData, payload, slice);
  const viewport = {
    ...slice.formData.viewport,
    width: slice.width(),
    height: slice.height(),
  };
  ReactDOM.render(
    <DeckGLContainer
      mapboxApiAccessToken={payload.data.mapboxApiKey}
      viewport={viewport}
      layers={[layer]}
      mapStyle={slice.formData.mapbox_style}
      setControlValue={setControlValue}
    />,
    document.getElementById(slice.containerId),
  );
}

module.exports = {
  default: deckPath,
  getLayer,
};
