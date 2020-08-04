import { Point } from './types';
/** Format originally used by the Polygon plugin */
declare type CustomPolygonFeature = {
    polygon: Point[];
};
/**
 * Format that is geojson standard
 * https://geojson.org/geojson-spec.html
 */
declare type GeojsonPolygonFeature = {
    polygon: {
        type: 'Feature';
        geometry: {
            type: 'Polygon';
            coordinates: Point[][];
        };
    };
};
export default function getPointsFromPolygon(feature: CustomPolygonFeature | GeojsonPolygonFeature): Point[];
export {};
//# sourceMappingURL=getPointsFromPolygon.d.ts.map