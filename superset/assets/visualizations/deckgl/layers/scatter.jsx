import React from 'react';
import ReactDOM from 'react-dom';
import { ScatterplotLayer } from 'deck.gl';

import DeckGLContainer from './../DeckGLContainer';
import * as common from './common';
import { getColorFromScheme, hexToRGB } from '../../../javascripts/modules/colors';
import { unitToRadius } from '../../../javascripts/modules/geo';
import sandboxedEval from '../../../javascripts/modules/sandbox';

function getPoints(data) {
  return data.map(d => d.position);
}

function getLayer(formData, payload, slice) {
  const fd = formData;
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];

  let data = payload.data.features.map((d) => {
    let radius = unitToRadius(fd.point_unit, d.radius) || 10;
    if (fd.multiplier) {
      radius *= fd.multiplier;
    }
    let color;
    if (fd.dimension) {
      color = hexToRGB(getColorFromScheme(d.cat_color, fd.color_scheme), c.a * 255);
    } else {
      color = fixedColor;
    }
    return {
      ...d,
      radius,
      color,
    };
  });

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  return new ScatterplotLayer({
    id: `scatter-layer-${fd.slice_id}`,
    data,
    fp64: true,
    outline: false,
    ...common.commonLayerProps(fd, slice),
  });
}

function deckScatter(slice, payload, setControlValue) {
  const layer = getLayer(slice.formData, payload, slice);
  const fd = slice.formData;
  const width = slice.width();
  const height = slice.height();
  let viewport = {
    ...fd.viewport,
    width,
    height,
  };

  if (fd.autozoom) {
    viewport = common.fitViewport(viewport, getPoints(payload.data.features));
  }

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

module.exports = {
  default: deckScatter,
  getLayer,
};
