/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React from 'react';
import ReactDOM from 'react-dom';

import { ArcLayer } from 'deck.gl';

import CategoricalDeckGLContainer from '../CategoricalDeckGLContainer';

import * as common from './common';

function getPoints(data) {
  const points = [];
  data.forEach((d) => {
    points.push(d.sourcePosition);
    points.push(d.targetPosition);
  });
  return points;
}

function getLayer(fd, data, slice) {
  const sc = fd.color_picker;
  const tc = fd.target_color_picker;
  return new ArcLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    getSourceColor: d => d.sourceColor || d.color || [sc.r, sc.g, sc.b, 255 * sc.a],
    getTargetColor: d => d.targetColor || d.color || [tc.r, tc.g, tc.b, 255 * tc.a],
    strokeWidth: (fd.stroke_width) ? fd.stroke_width : 3,
    ...common.commonLayerProps(fd, slice),
  });
}

function deckArc(slice, payload, setControlValue) {
  const fd = slice.formData;
  let viewport = {
    ...fd.viewport,
    width: slice.width(),
    height: slice.height(),
  };

  if (fd.autozoom) {
    viewport = common.fitViewport(viewport, getPoints(payload.data.arcs));
  }

  ReactDOM.render(
    <CategoricalDeckGLContainer
      slice={slice}
      data={payload.data.arcs}
      mapboxApiKey={payload.data.mapboxApiKey}
      setControlValue={setControlValue}
      viewport={viewport}
      getLayer={getLayer}
    />,
    document.getElementById(slice.containerId),
  );
}

module.exports = {
  default: deckArc,
  getLayer,
};
