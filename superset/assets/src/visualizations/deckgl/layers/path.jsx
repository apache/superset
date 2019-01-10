import { PathLayer } from 'deck.gl';
import { commonLayerProps } from './common';
import sandboxedEval from '../../../modules/sandbox';
import createAdaptor from '../createAdaptor';
import { createDeckGLComponent } from '../factory';

export function getLayer(formData, payload, onAddFilter, onTooltip) {
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
    ...commonLayerProps(fd, onAddFilter, onTooltip),
  });
}

function getPoints(data) {
  let points = [];
  data.forEach((d) => {
    points = points.concat(d.path);
  });
  return points;
}

export default createAdaptor(createDeckGLComponent(getLayer, getPoints));
