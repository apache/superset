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
    strokeWidth: (fd.stroke_width) ? fd.stroke_width : 3,
  });
}
