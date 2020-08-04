// @flow

import StyleLayer from '../style_layer';

import FillBucket from '../../data/bucket/fill_bucket';
import { polygonIntersectsMultiPolygon } from '../../util/intersection_tests';
import { translateDistance, translate } from '../query_utils';
import properties from './fill_style_layer_properties';
import { Transitionable, Transitioning, PossiblyEvaluated } from '../properties';

import type { FeatureState } from '../../style-spec/expression';
import type {BucketParameters} from '../../data/bucket';
import type Point from '@mapbox/point-geometry';
import type {PaintProps} from './fill_style_layer_properties';
import type EvaluationParameters from '../evaluation_parameters';
import type Transform from '../../geo/transform';
import type {LayerSpecification} from '../../style-spec/types';

class FillStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    recalculate(parameters: EvaluationParameters) {
        super.recalculate(parameters);

        const outlineColor = this.paint._values['fill-outline-color'];
        if (outlineColor.value.kind === 'constant' && outlineColor.value.value === undefined) {
            this.paint._values['fill-outline-color'] = this.paint._values['fill-color'];
        }
    }

    createBucket(parameters: BucketParameters<*>) {
        return new FillBucket(parameters);
    }

    queryRadius(): number {
        return translateDistance(this.paint.get('fill-translate'));
    }

    queryIntersectsFeature(queryGeometry: Array<Point>,
                           feature: VectorTileFeature,
                           featureState: FeatureState,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           transform: Transform,
                           pixelsToTileUnits: number): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('fill-translate'),
            this.paint.get('fill-translate-anchor'),
            transform.angle, pixelsToTileUnits);
        return polygonIntersectsMultiPolygon(translatedPolygon, geometry);
    }
}

export default FillStyleLayer;
