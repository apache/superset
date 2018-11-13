import { ArcLayer } from 'deck.gl';
import { commonLayerProps } from '../common';
import { createCategoricalDeckGLComponent } from '../../factory';

function getPoints(data) {
  const points = [];
  data.forEach((d) => {
    points.push(d.sourcePosition);
    points.push(d.targetPosition);
  });
  return points;
}

export function getLayer(fd, payload, onAddFilter, setTooltip) {
  const data = payload.data.features;
  const sc = fd.color_picker;
  const tc = fd.target_color_picker;
  return new ArcLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    getSourceColor: d => d.sourceColor || d.color || [sc.r, sc.g, sc.b, 255 * sc.a],
    getTargetColor: d => d.targetColor || d.color || [tc.r, tc.g, tc.b, 255 * tc.a],
    strokeWidth: (fd.stroke_width) ? fd.stroke_width : 3,
    ...commonLayerProps(fd, onAddFilter, setTooltip),
  });
}

export default createCategoricalDeckGLComponent(getLayer, getPoints);
