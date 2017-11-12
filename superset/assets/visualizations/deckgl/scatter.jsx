import React from 'react';
import ReactDOM from 'react-dom';
import { ScatterplotLayer } from 'deck.gl';

import DeckGLContainer from './DeckGLContainer';
import { getColorFromScheme, hexToRGB } from '../../javascripts/modules/colors';
import { unitToRadius } from '../../javascripts/modules/geo';

function deckScatter(slice, payload, setControlValue) {
  const fd = slice.formData;
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];

  const data = payload.data.features.map((d) => {
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

  const layer = new ScatterplotLayer({
    id: `scatter-layer-${slice.containerId}`,
    data,
    pickable: true,
    fp64: true,
    outline: false,
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
module.exports = deckScatter;
