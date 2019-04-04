// @flow

import { Color } from './values';

import type { GlobalProperties, Feature, FeatureState } from './index';

const geometryTypes = ['Unknown', 'Point', 'LineString', 'Polygon'];

class EvaluationContext {
    globals: GlobalProperties;
    feature: ?Feature;
    featureState: ?FeatureState;

    _parseColorCache: {[string]: ?Color};

    constructor() {
        this.globals = (null: any);
        this.feature = null;
        this.featureState = null;
        this._parseColorCache = {};
    }

    id() {
        return this.feature && 'id' in this.feature ? this.feature.id : null;
    }

    geometryType() {
        return this.feature ? typeof this.feature.type === 'number' ? geometryTypes[this.feature.type] : this.feature.type : null;
    }

    properties() {
        return this.feature && this.feature.properties || {};
    }

    parseColor(input: string): ?Color {
        let cached = this._parseColorCache[input];
        if (!cached) {
            cached = this._parseColorCache[input] = Color.parse(input);
        }
        return cached;
    }
}

export default EvaluationContext;
