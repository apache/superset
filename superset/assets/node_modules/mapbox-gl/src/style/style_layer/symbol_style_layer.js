// @flow

import StyleLayer from '../style_layer';

import SymbolBucket from '../../data/bucket/symbol_bucket';
import resolveTokens from '../../util/token';
import { isExpression } from '../../style-spec/expression';
import assert from 'assert';
import properties from './symbol_style_layer_properties';
import { Transitionable, Transitioning, Layout, PossiblyEvaluated } from '../properties';

import type {BucketParameters} from '../../data/bucket';
import type {LayoutProps, PaintProps} from './symbol_style_layer_properties';
import type {Feature} from '../../style-spec/expression';
import type EvaluationParameters from '../evaluation_parameters';
import type {LayerSpecification} from '../../style-spec/types';

class SymbolStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LayoutProps>;
    layout: PossiblyEvaluated<LayoutProps>;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    recalculate(parameters: EvaluationParameters) {
        super.recalculate(parameters);

        if (this.layout.get('icon-rotation-alignment') === 'auto') {
            if (this.layout.get('symbol-placement') !== 'point') {
                this.layout._values['icon-rotation-alignment'] = 'map';
            } else {
                this.layout._values['icon-rotation-alignment'] = 'viewport';
            }
        }

        if (this.layout.get('text-rotation-alignment') === 'auto') {
            if (this.layout.get('symbol-placement') !== 'point') {
                this.layout._values['text-rotation-alignment'] = 'map';
            } else {
                this.layout._values['text-rotation-alignment'] = 'viewport';
            }
        }

        // If unspecified, `*-pitch-alignment` inherits `*-rotation-alignment`
        if (this.layout.get('text-pitch-alignment') === 'auto') {
            this.layout._values['text-pitch-alignment'] = this.layout.get('text-rotation-alignment');
        }
        if (this.layout.get('icon-pitch-alignment') === 'auto') {
            this.layout._values['icon-pitch-alignment'] = this.layout.get('icon-rotation-alignment');
        }
    }

    getValueAndResolveTokens(name: *, feature: Feature) {
        const value = this.layout.get(name).evaluate(feature, {});
        const unevaluated = this._unevaluatedLayout._values[name];
        if (!unevaluated.isDataDriven() && !isExpression(unevaluated.value)) {
            return resolveTokens(feature.properties, value);
        }

        return value;
    }

    createBucket(parameters: BucketParameters<*>) {
        return new SymbolBucket(parameters);
    }

    queryRadius(): number {
        return 0;
    }

    queryIntersectsFeature(): boolean {
        assert(false); // Should take a different path in FeatureIndex
        return false;
    }
}

export default SymbolStyleLayer;
