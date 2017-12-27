import { PathLayer } from 'deck.gl';

export default function getLayer(formData, payload) {
  const fd = formData;
  const c = fd.color_picker;
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  const data = payload.data.paths.map(path => ({
    path,
    width: fd.line_width,
    color: fixedColor,
  }));

  return new PathLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    rounded: true,
    widthScale: 1,
  });
}
