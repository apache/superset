// @flow

import { endsWith, filterObject } from '../util/util';

import styleSpec from '../style-spec/reference/latest';
import {
    validateStyle,
    validateLayoutProperty,
    validatePaintProperty,
    emitValidationErrors
} from './validate_style';
import { Evented } from '../util/evented';
import { Layout, Transitionable, Transitioning, Properties, PossiblyEvaluatedPropertyValue } from './properties';
import { supportsPropertyExpression } from '../style-spec/util/properties';

import type { FeatureState } from '../style-spec/expression';
import type {Bucket} from '../data/bucket';
import type Point from '@mapbox/point-geometry';
import type {FeatureFilter} from '../style-spec/feature_filter';
import type {TransitionParameters} from './properties';
import type EvaluationParameters, {CrossfadeParameters} from './evaluation_parameters';
import type Transform from '../geo/transform';
import type {
    LayerSpecification,
    FilterSpecification
} from '../style-spec/types';
import type {CustomLayerInterface} from './style_layer/custom_style_layer';
import type Map from '../ui/map';
import type {StyleSetterOptions} from './style';

const TRANSITION_SUFFIX = '-transition';

class StyleLayer extends Evented {
    id: string;
    metadata: mixed;
    type: string;
    source: string;
    sourceLayer: ?string;
    minzoom: ?number;
    maxzoom: ?number;
    filter: FilterSpecification | void;
    visibility: 'visible' | 'none';
    _crossfadeParameters: CrossfadeParameters;

    _unevaluatedLayout: Layout<any>;
    +layout: mixed;

    _transitionablePaint: Transitionable<any>;
    _transitioningPaint: Transitioning<any>;
    +paint: mixed;

    _featureFilter: FeatureFilter;

    +queryRadius: (bucket: Bucket) => number;
    +queryIntersectsFeature: (queryGeometry: Array<Point>,
                              feature: VectorTileFeature,
                              featureState: FeatureState,
                              geometry: Array<Array<Point>>,
                              zoom: number,
                              transform: Transform,
                              pixelsToTileUnits: number,
                              pixelPosMatrix: Float32Array) => boolean | number;

    +onAdd: ?(map: Map) => void;
    +onRemove: ?(map: Map) => void;

    constructor(layer: LayerSpecification | CustomLayerInterface, properties: $ReadOnly<{layout?: Properties<*>, paint?: Properties<*>}>) {
        super();

        this.id = layer.id;
        this.type = layer.type;
        this.visibility = 'visible';
        this._featureFilter = () => true;

        if (layer.type === 'custom') return;

        layer = ((layer: any): LayerSpecification);

        this.metadata = layer.metadata;
        this.minzoom = layer.minzoom;
        this.maxzoom = layer.maxzoom;

        if (layer.type !== 'background') {
            this.source = layer.source;
            this.sourceLayer = layer['source-layer'];
            this.filter = layer.filter;
        }

        if (properties.layout) {
            this._unevaluatedLayout = new Layout(properties.layout);
        }

        if (properties.paint) {
            this._transitionablePaint = new Transitionable(properties.paint);

            for (const property in layer.paint) {
                this.setPaintProperty(property, layer.paint[property], {validate: false});
            }
            for (const property in layer.layout) {
                this.setLayoutProperty(property, layer.layout[property], {validate: false});
            }

            this._transitioningPaint = this._transitionablePaint.untransitioned();
        }
    }

    getCrossfadeParameters() {
        return this._crossfadeParameters;
    }

    getLayoutProperty(name: string) {
        if (name === 'visibility') {
            return this.visibility;
        }

        return this._unevaluatedLayout.getValue(name);
    }

    setLayoutProperty(name: string, value: mixed, options: StyleSetterOptions = {}) {
        if (value !== null && value !== undefined) {
            const key = `layers.${this.id}.layout.${name}`;
            if (this._validate(validateLayoutProperty, key, name, value, options)) {
                return;
            }
        }

        if (name === 'visibility') {
            this.visibility = value === 'none' ? value : 'visible';
            return;
        }

        this._unevaluatedLayout.setValue(name, value);
    }

    getPaintProperty(name: string) {
        if (endsWith(name, TRANSITION_SUFFIX)) {
            return this._transitionablePaint.getTransition(name.slice(0, -TRANSITION_SUFFIX.length));
        } else {
            return this._transitionablePaint.getValue(name);
        }
    }

    setPaintProperty(name: string, value: mixed, options: StyleSetterOptions = {}) {
        if (value !== null && value !== undefined) {
            const key = `layers.${this.id}.paint.${name}`;
            if (this._validate(validatePaintProperty, key, name, value, options)) {
                return false;
            }
        }

        if (endsWith(name, TRANSITION_SUFFIX)) {
            this._transitionablePaint.setTransition(name.slice(0, -TRANSITION_SUFFIX.length), (value: any) || undefined);
            return false;
        } else {
            // if a cross-faded value is changed, we need to make sure the new icons get added to each tile's iconAtlas
            // so a call to _updateLayer is necessary, and we return true from this function so it gets called in
            // Style#setPaintProperty
            const prop = this._transitionablePaint._values[name];
            const newCrossFadedValue = prop.property.specification["property-type"] === 'cross-faded-data-driven' && !prop.value.value && value;

            const wasDataDriven = this._transitionablePaint._values[name].value.isDataDriven();
            this._transitionablePaint.setValue(name, value);
            const isDataDriven = this._transitionablePaint._values[name].value.isDataDriven();
            this._handleSpecialPaintPropertyUpdate(name);
            return isDataDriven || wasDataDriven || newCrossFadedValue;
        }
    }

    _handleSpecialPaintPropertyUpdate(_: string) {
        // No-op; can be overridden by derived classes.
    }

    isHidden(zoom: number) {
        if (this.minzoom && zoom < this.minzoom) return true;
        if (this.maxzoom && zoom >= this.maxzoom) return true;
        return this.visibility === 'none';
    }

    updateTransitions(parameters: TransitionParameters) {
        this._transitioningPaint = this._transitionablePaint.transitioned(parameters, this._transitioningPaint);
    }

    hasTransition() {
        return this._transitioningPaint.hasTransition();
    }

    recalculate(parameters: EvaluationParameters) {
        if (parameters.getCrossfadeParameters) {
            this._crossfadeParameters = parameters.getCrossfadeParameters();
        }

        if (this._unevaluatedLayout) {
            (this: any).layout = this._unevaluatedLayout.possiblyEvaluate(parameters);
        }

        (this: any).paint = this._transitioningPaint.possiblyEvaluate(parameters);
    }

    serialize() {
        const output: any = {
            'id': this.id,
            'type': this.type,
            'source': this.source,
            'source-layer': this.sourceLayer,
            'metadata': this.metadata,
            'minzoom': this.minzoom,
            'maxzoom': this.maxzoom,
            'filter': this.filter,
            'layout': this._unevaluatedLayout && this._unevaluatedLayout.serialize(),
            'paint': this._transitionablePaint && this._transitionablePaint.serialize()
        };

        if (this.visibility === 'none') {
            output.layout = output.layout || {};
            output.layout.visibility = 'none';
        }

        return filterObject(output, (value, key) => {
            return value !== undefined &&
                !(key === 'layout' && !Object.keys(value).length) &&
                !(key === 'paint' && !Object.keys(value).length);
        });
    }

    _validate(validate: Function, key: string, name: string, value: mixed, options: StyleSetterOptions = {}) {
        if (options && options.validate === false) {
            return false;
        }
        return emitValidationErrors(this, validate.call(validateStyle, {
            key,
            layerType: this.type,
            objectKey: name,
            value,
            styleSpec,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true}
        }));
    }

    hasOffscreenPass() {
        return false;
    }

    resize() {
        // noop
    }

    isStateDependent() {
        for (const property in (this: any).paint._values) {
            const value = (this: any).paint.get(property);
            if (!(value instanceof PossiblyEvaluatedPropertyValue) || !supportsPropertyExpression(value.property.specification)) {
                continue;
            }

            if ((value.value.kind === 'source' || value.value.kind === 'composite') &&
                value.value.isStateDependent) {
                return true;
            }
        }
        return false;
    }
}

export default StyleLayer;


