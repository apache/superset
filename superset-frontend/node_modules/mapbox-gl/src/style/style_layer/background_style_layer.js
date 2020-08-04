// @flow

import StyleLayer from '../style_layer';

import properties from './background_style_layer_properties';
import { Transitionable, Transitioning, PossiblyEvaluated } from '../properties';

import type {PaintProps} from './background_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';

class BackgroundStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }
}

export default BackgroundStyleLayer;
