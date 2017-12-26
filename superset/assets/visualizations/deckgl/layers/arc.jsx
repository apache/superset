import { ArcLayer } from 'deck.gl';


export default function arcLayer(formData, payload) {
  const fd = formData;
  const data = payload.data.map(d => ({
    ...d,
  }));

  console.log(payload);

  return new ArcLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    filled: true,
    stroked: false,
    extruded: true,
    pointRadiusScale: fd.point_radius_scale,
  });
}
