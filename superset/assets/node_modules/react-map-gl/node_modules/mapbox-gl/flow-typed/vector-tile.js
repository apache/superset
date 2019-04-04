import type Pbf from 'pbf';
import type Point from '@mapbox/point-geometry';
import type { GeoJSONFeature } from '@mapbox/geojson-types';

declare interface VectorTile {
    layers: {[string]: VectorTileLayer};
}

declare interface VectorTileLayer {
    version?: number;
    name: string;
    extent: number;
    length: number;
    feature(i: number): VectorTileFeature;
}

declare interface VectorTileFeature {
    extent: number;
    type: 1 | 2 | 3;
    id: number;
    properties: {[string]: string | number | boolean};

    loadGeometry(): Array<Array<Point>>;
    toGeoJSON(x: number, y: number, z: number): GeoJSONFeature;
}

declare module "@mapbox/vector-tile" {
    declare class VectorTileImpl {
        constructor(pbf: Pbf): VectorTile;
    }

    declare class VectorTileFeatureImpl {
        static types: ['Unknown', 'Point', 'LineString', 'Polygon'];
        toGeoJSON(x: number, y: number, z: number): GeoJSONFeature;
    }

    declare module.exports: {
        VectorTile: typeof VectorTileImpl;
        VectorTileFeature: typeof VectorTileFeatureImpl;
    }
}
