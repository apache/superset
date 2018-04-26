import React from 'react';
import ReactDOM from 'react-dom';

import { HexagonLayer } from 'deck.gl';

import DeckGLContainer from './../DeckGLContainer';

import * as common from './common';
import sandboxedEval from '../../../modules/sandbox';

function getLayer(formData, payload, slice) {
  const fd = formData;
  const c = fd.color_picker;
  let data = payload.data.features.map(d => ({
    ...d,
    color: [c.r, c.g, c.b, 255 * c.a],
  }));

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  return new HexagonLayer({
    id: `hex-layer-${fd.slice_id}`,
    data,
    pickable: true,
    radius: fd.grid_size,
    minColor: [0, 0, 0, 0],
    extruded: fd.extruded,
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getElevationValue: points => points.reduce((sum, point) => sum + point.weight, 0),
    getColorValue: points => points.reduce((sum, point) => sum + point.weight, 0),
    ...common.commonLayerProps(fd, slice),
  });
}

function getPoints(data) {
  return data.map(d => d.position);
}

function deckHex(slice, payload, setControlValue) {
  const layer = getLayer(slice.formData, payload, slice);
  let viewport = {
    ...slice.formData.viewport,
    width: slice.width(),
    height: slice.height(),
  };

  if (slice.formData.autozoom) {
    viewport = common.fitViewport(viewport, getPoints(payload.data.features));
  }

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
  default: deckHex,
  getLayer,
};
