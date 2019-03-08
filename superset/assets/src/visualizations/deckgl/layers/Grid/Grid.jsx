import { GridLayer } from 'deck.gl';

import { commonLayerProps, getAggFunc  } from '../common';
import sandboxedEval from '../../../../modules/sandbox';
import { createDeckGLComponent } from '../../factory';

export function getLayer(formData, payload, onAddFilter, setTooltip) {
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

  const aggFunc = getAggFunc(fd.js_agg_function, p => p.weight);
  return new GridLayer({
    id: `grid-layer-${fd.slice_id}`,
    data,
    pickable: true,
    cellSize: fd.grid_size,
    minColor: [0, 0, 0, 0],
    extruded: fd.extruded,
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getElevationValue: aggFunc,
    getColorValue: aggFunc,
    ...commonLayerProps(fd, setTooltip),
  });
}

function getPoints(data) {
  return data.map(d => d.position);
}

export default createDeckGLComponent(getLayer, getPoints);
