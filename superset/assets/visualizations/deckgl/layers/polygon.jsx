import { PolygonLayer } from 'deck.gl';

export default function polygonLayer(formData, payload) {
  const fd = formData;
  const fc = fd.fill_color_picker;
  const data = payload.data.polygons.map(d => ({
    ...d,
    fillColor: [fc.r, fc.g, fc.b, 255 * fc.a],
  }));

  return new PolygonLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    filled: fd.filled,
    stroked: fd.stoked,
    extruded: fd.extruded,
  });
}
