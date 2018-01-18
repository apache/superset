import { PolygonLayer } from 'deck.gl';

import * as common from './common';
import sandboxedEval from '../../../javascripts/modules/sandbox';

export default function polygonLayer(formData, payload, slice) {
  const fd = formData;
  const fc = fd.fill_color_picker;
  let data = payload.data.features.map(d => ({
    ...d,
    fillColor: [fc.r, fc.g, fc.b, 255 * fc.a],
  }));

  if (fd.js_datapoint_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_datapoint_mutator);
    data = data.map(jsFnMutator);
  }

  return new PolygonLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    filled: fd.filled,
    stroked: fd.stoked,
    extruded: fd.extruded,
    ...common.commonLayerProps(fd, slice),
  });
}
