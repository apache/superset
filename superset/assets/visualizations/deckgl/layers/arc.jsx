import React from 'react';
import ReactDOM from 'react-dom';

import { ArcLayer } from 'deck.gl';

import DeckGLContainer from './../DeckGLContainer';

import * as common from './common';
import sandboxedEval from '../../../javascripts/modules/sandbox';

function getPoints(data) {
  const points = [];
  data.forEach((d) => {
    points.push(d.sourcePosition);
    points.push(d.targetPosition);
  });
  return points;
}

function getLayer(formData, payload, slice) {
  const fd = formData;
  const fc = fd.color_picker;
  let data = payload.data.arcs.map(d => ({
    ...d,
    color: [fc.r, fc.g, fc.b, 255 * fc.a],
  }));

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  return new ArcLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    strokeWidth: (fd.stroke_width) ? fd.stroke_width : 3,
    ...common.commonLayerProps(fd, slice),
  });
}

function deckArc(slice, payload, setControlValue) {
  const layer = getLayer(slice.formData, payload, slice);
  let viewport = {
    ...slice.formData.viewport,
    width: slice.width(),
    height: slice.height(),
  };

  if (slice.formData.autozoom) {
    viewport = common.fitViewport(viewport, getPoints(payload.data.arcs));
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
  default: deckArc,
  getLayer,
};
