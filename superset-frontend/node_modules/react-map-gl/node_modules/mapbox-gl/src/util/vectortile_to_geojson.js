// @flow
import type {GeoJSONGeometry} from '@mapbox/geojson-types';

class Feature {
    type: 'Feature';
    _geometry: ?GeoJSONGeometry;
    properties: {};
    id: number | string | void;

    _vectorTileFeature: VectorTileFeature;

    constructor(vectorTileFeature: VectorTileFeature, z: number, x: number, y: number) {
        this.type = 'Feature';

        this._vectorTileFeature = vectorTileFeature;
        (vectorTileFeature: any)._z = z;
        (vectorTileFeature: any)._x = x;
        (vectorTileFeature: any)._y = y;

        this.properties = vectorTileFeature.properties;

        if (vectorTileFeature.id != null) {
            this.id = vectorTileFeature.id;
        }
    }

    get geometry(): ?GeoJSONGeometry {
        if (this._geometry === undefined) {
            this._geometry = this._vectorTileFeature.toGeoJSON(
                (this._vectorTileFeature: any)._x,
                (this._vectorTileFeature: any)._y,
                (this._vectorTileFeature: any)._z).geometry;
        }
        return this._geometry;
    }

    set geometry(g: ?GeoJSONGeometry) {
        this._geometry = g;
    }

    toJSON() {
        const json = {
            geometry: this.geometry
        };
        for (const i in this) {
            if (i === '_geometry' || i === '_vectorTileFeature') continue;
            json[i] = (this: any)[i];
        }
        return json;
    }
}

export default Feature;
