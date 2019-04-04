// @flow

import StyleLayer from '../style_layer';

import FillExtrusionBucket from '../../data/bucket/fill_extrusion_bucket';
import { multiPolygonIntersectsMultiPolygon } from '../../util/intersection_tests';
import { translateDistance, translate } from '../query_utils';
import properties from './fill_extrusion_style_layer_properties';
import { Transitionable, Transitioning, PossiblyEvaluated } from '../properties';

import type { FeatureState } from '../../style-spec/expression';
import type {BucketParameters} from '../../data/bucket';
import type Point from '@mapbox/point-geometry';
import type {PaintProps} from './fill_extrusion_style_layer_properties';
import type Framebuffer from '../../gl/framebuffer';
import type Transform from '../../geo/transform';
import type {LayerSpecification} from '../../style-spec/types';

class FillExtrusionStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;
    viewportFrame: ?Framebuffer;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    createBucket(parameters: BucketParameters<FillExtrusionStyleLayer>) {
        return new FillExtrusionBucket(parameters);
    }

    queryRadius(): number {
        return translateDistance(this.paint.get('fill-extrusion-translate'));
    }

    queryIntersectsFeature(queryGeometry: Array<Array<Point>>,
                           feature: VectorTileFeature,
                           featureState: FeatureState,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           transform: Transform,
                           pixelsToTileUnits: number): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('fill-extrusion-translate'),
            this.paint.get('fill-extrusion-translate-anchor'),
            transform.angle, pixelsToTileUnits);
        return multiPolygonIntersectsMultiPolygon(translatedPolygon, geometry);
    }

    hasOffscreenPass() {
        return this.paint.get('fill-extrusion-opacity') !== 0 && this.visibility !== 'none';
    }

    resize() {
        if (this.viewportFrame) {
            this.viewportFrame.destroy();
            this.viewportFrame = null;
        }
    }
}

export default FillExtrusionStyleLayer;
