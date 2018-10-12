import { HexagonLayer } from 'deck.gl';
import { commonLayerProps } from './common';
import sandboxedEval from '../../../modules/sandbox';
import createAdaptor from '../createAdaptor';
import { createDeckGLComponent } from '../factory';

export function getLayer(formData, payload, onAddFilter, onTooltip) {
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
    ...commonLayerProps(fd, onAddFilter, onTooltip),
  });
}

function getPoints(data) {
  return data.map(d => d.position);
}

export default createAdaptor(createDeckGLComponent(getLayer, getPoints));
