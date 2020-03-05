import { Point } from './types';

/** Format originally used by the Polygon plugin */
type CustomPolygonFeature = {
  polygon: Point[];
};

/**
 * Format that is geojson standard
 * https://geojson.org/geojson-spec.html
 */
type GeojsonPolygonFeature = {
  polygon: {
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: Point[][];
    };
  };
};

export default function getPointsFromPolygon(
  feature: CustomPolygonFeature | GeojsonPolygonFeature,
) {
  return 'geometry' in feature.polygon ? feature.polygon.geometry.coordinates[0] : feature.polygon;
}
