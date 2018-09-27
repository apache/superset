/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React from 'react';
import ReactDOM from 'react-dom';

import { ScatterplotLayer } from 'deck.gl';

import CategoricalDeckGLContainer from '../CategoricalDeckGLContainer';
import * as common from './common';
import { unitToRadius } from '../../../modules/geo';


function getPoints(data) {
  return data.map(d => d.position);
}

function getLayer(fd, payload, slice) {
  const dataWithRadius = payload.data.features.map((d) => {
    let radius = unitToRadius(fd.point_unit, d.radius) || 10;
    if (fd.multiplier) {
      radius *= fd.multiplier;
    }
    if (d.color) {
      return { ...d, radius };
    }
    const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    const color = [c.r, c.g, c.b, c.a * 255];
    return { ...d, radius, color };
  });

  return new ScatterplotLayer({
    id: `scatter-layer-${fd.slice_id}`,
    data: dataWithRadius,
    fp64: true,
    radiusMinPixels: fd.min_radius || null,
    radiusMaxPixels: fd.max_radius || null,
    outline: false,
    ...common.commonLayerProps(fd, slice),
  });
}

function deckScatter(slice, payload, setControlValue) {
  const fd = slice.formData;
  let viewport = {
    ...fd.viewport,
    width: slice.width(),
    height: slice.height(),
  };

  if (fd.autozoom) {
    viewport = common.fitViewport(viewport, getPoints(payload.data.features));
  }

  ReactDOM.render(
    <CategoricalDeckGLContainer
      slice={slice}
      mapboxApiKey={payload.data.mapboxApiKey}
      setControlValue={setControlValue}
      viewport={viewport}
      getLayer={getLayer}
      payload={payload}
    />,
    document.getElementById(slice.containerId),
  );
}

module.exports = {
  default: deckScatter,
  getLayer,
};
