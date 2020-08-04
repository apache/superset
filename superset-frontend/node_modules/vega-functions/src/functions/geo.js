import {getScale} from '../scales';
import {
  geoArea as area,
  geoBounds as bounds,
  geoCentroid as centroid
} from 'd3-geo';

function geoMethod(methodName, globalMethod) {
  return function(projection, geojson, group) {
    if (projection) {
      // projection defined, use it
      const p = getScale(projection, (group || this).context);
      return p && p.path[methodName](geojson);
    } else {
      // projection undefined, use global method
      return globalMethod(geojson);
    }
  };
}

export const geoArea = geoMethod('area', area);
export const geoBounds = geoMethod('bounds', bounds);
export const geoCentroid = geoMethod('centroid', centroid);
