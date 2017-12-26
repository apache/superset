import { HexagonLayer } from 'deck.gl';

export default function getLayer(formData, payload) {
  const fd = formData;
  const c = fd.color_picker;
  const data = payload.data.features.map(d => ({
    ...d,
    color: [c.r, c.g, c.b, 255 * c.a],
  }));

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
  });
}
