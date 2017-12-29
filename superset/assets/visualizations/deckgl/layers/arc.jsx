import { ArcLayer } from 'deck.gl';

export default function arcLayer(formData, payload) {
  const fd = formData;
  const fc = fd.color_picker;
  const data = payload.data.arcs.map(d => ({
    ...d,
    color: [fc.r, fc.g, fc.b, 255 * fc.a],
  }));

  return new ArcLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    filled: true,
    stroked: false,
    extruded: true,
    pointRadiusScale: fd.point_radius_scale,
  });
}
