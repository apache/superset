import { ScatterplotLayer } from 'deck.gl';
import { commonLayerProps } from '../common';
import { createCategoricalDeckGLComponent } from '../../factory';
import { unitToRadius } from '../../../../modules/geo';

function getPoints(data) {
  return data.map(d => d.position);
}

export function getLayer(fd, payload, onAddFilter, setTooltip) {
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
    ...commonLayerProps(fd, setTooltip),
  });
}

export default createCategoricalDeckGLComponent(getLayer, getPoints);
