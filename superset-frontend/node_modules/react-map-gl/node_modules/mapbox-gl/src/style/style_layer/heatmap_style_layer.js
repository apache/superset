// @flow

import StyleLayer from '../style_layer';

import HeatmapBucket from '../../data/bucket/heatmap_bucket';
import { RGBAImage } from '../../util/image';
import properties from './heatmap_style_layer_properties';
import renderColorRamp from '../../util/color_ramp';
import { Transitionable, Transitioning, PossiblyEvaluated } from '../properties';

import type Texture from '../../render/texture';
import type Framebuffer from '../../gl/framebuffer';
import type {PaintProps} from './heatmap_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';

class HeatmapStyleLayer extends StyleLayer {

    heatmapFbo: ?Framebuffer;
    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    createBucket(options: any) {
        return new HeatmapBucket(options);
    }

    constructor(layer: LayerSpecification) {
        super(layer, properties);

        // make sure color ramp texture is generated for default heatmap color too
        this._updateColorRamp();
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'heatmap-color') {
            this._updateColorRamp();
        }
    }

    _updateColorRamp() {
        const expression = this._transitionablePaint._values['heatmap-color'].value.expression;
        this.colorRamp = renderColorRamp(expression, 'heatmapDensity');
        this.colorRampTexture = null;
    }

    resize() {
        if (this.heatmapFbo) {
            this.heatmapFbo.destroy();
            this.heatmapFbo = null;
        }
    }

    queryRadius(): number {
        return 0;
    }

    queryIntersectsFeature(): boolean  {
        return false;
    }

    hasOffscreenPass() {
        return this.paint.get('heatmap-opacity') !== 0 && this.visibility !== 'none';
    }
}

export default HeatmapStyleLayer;
