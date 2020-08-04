// @flow strict

type GeoJSONPosition = [number, number] | [number, number, number];
type Geometry<T, C> = { type: T, coordinates: C }

export type      GeoJSONPoint = Geometry<     'Point',       GeoJSONPosition>;
export type GeoJSONMultiPoint = Geometry<'MultiPoint', Array<GeoJSONPosition>>;

export type      GeoJSONLineString = Geometry<     'LineString',       Array<GeoJSONPosition>>;
export type GeoJSONMultiLineString = Geometry<'MultiLineString', Array<Array<GeoJSONPosition>>>;

export type      GeoJSONPolygon = Geometry<     'Polygon',       Array<Array<GeoJSONPosition>>>;
export type GeoJSONMultiPolygon = Geometry<'MultiPolygon', Array<Array<Array<GeoJSONPosition>>>>;

export type GeoJSONGeometry =
    | GeoJSONPoint
    | GeoJSONMultiPoint
    | GeoJSONLineString
    | GeoJSONMultiLineString
    | GeoJSONPolygon
    | GeoJSONMultiPolygon
    | GeoJSONGeometryCollection;

export type GeoJSONGeometryCollection = {
    type: 'GeometryCollection',
    geometries: Array<GeoJSONGeometry>
};

export type GeoJSONFeature = {
    type: 'Feature',
    geometry: ?GeoJSONGeometry,
    properties: ?{},
    id?: number | string
};

export type GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: Array<GeoJSONFeature>
};

export type GeoJSON = GeoJSONGeometry | GeoJSONFeature | GeoJSONFeatureCollection;
