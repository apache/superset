import { GeoJsonLayer } from 'deck.gl';
import { hexToRGB } from '../../../javascripts/modules/colors';


const propertyMap = {
  fillColor: 'fillColor',
  color: 'fillColor',
  fill: 'fillColor',
  'fill-color': 'fillColor',
  strokeColor: 'strokeColor',
  'stroke-color': 'strokeColor',
  'stroke-width': 'strokeWidth',
};

const convertGeoJsonColorProps = (p, colors) => {
  const obj = Object.assign(...Object.keys(p).map(k => ({
    [(propertyMap[k]) ? propertyMap[k] : k]: p[k] })));

  return {
    ...obj,
    fillColor: (colors.fillColor[3] !== 0) ? colors.fillColor : hexToRGB(obj.fillColor),
    strokeColor: (colors.strokeColor[3] !== 0) ? colors.strokeColor : hexToRGB(obj.strokeColor),
  };
};

export default function geoJsonLayer(formData, payload) {
  const fd = formData;
  const fc = fd.fill_color_picker;
  const sc = fd.stroke_color_picker;
  const data = payload.data.geojson.features.map(d => ({
    ...d,
    properties: convertGeoJsonColorProps(
      d.properties, {
        fillColor: [fc.r, fc.g, fc.b, 255 * fc.a],
        strokeColor: [sc.r, sc.g, sc.b, 255 * sc.a],
      }),
  }));

  return new GeoJsonLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    filled: true,
    stroked: false,
    extruded: true,
    pointRadiusScale: fd.point_radius_scale,
  });
}
