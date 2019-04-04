// @flow

import { fillExtrusionUniforms, fillExtrusionPatternUniforms, extrusionTextureUniforms } from './fill_extrusion_program';
import { fillUniforms, fillPatternUniforms, fillOutlineUniforms, fillOutlinePatternUniforms } from './fill_program';
import { circleUniforms } from './circle_program';
import { collisionUniforms } from './collision_program';
import { debugUniforms } from './debug_program';
import { clippingMaskUniforms } from './clipping_mask_program';
import { heatmapUniforms, heatmapTextureUniforms } from './heatmap_program';
import { hillshadeUniforms, hillshadePrepareUniforms } from './hillshade_program';
import { lineUniforms, lineGradientUniforms, linePatternUniforms, lineSDFUniforms } from './line_program';
import { rasterUniforms } from './raster_program';
import { symbolIconUniforms, symbolSDFUniforms } from './symbol_program';
import { backgroundUniforms, backgroundPatternUniforms } from './background_program';

export const programUniforms = {
    fillExtrusion: fillExtrusionUniforms,
    fillExtrusionPattern: fillExtrusionPatternUniforms,
    extrusionTexture: extrusionTextureUniforms,
    fill: fillUniforms,
    fillPattern: fillPatternUniforms,
    fillOutline: fillOutlineUniforms,
    fillOutlinePattern: fillOutlinePatternUniforms,
    circle: circleUniforms,
    collisionBox: collisionUniforms,
    collisionCircle: collisionUniforms,
    debug: debugUniforms,
    clippingMask: clippingMaskUniforms,
    heatmap: heatmapUniforms,
    heatmapTexture: heatmapTextureUniforms,
    hillshade: hillshadeUniforms,
    hillshadePrepare: hillshadePrepareUniforms,
    line: lineUniforms,
    lineGradient: lineGradientUniforms,
    linePattern: linePatternUniforms,
    lineSDF: lineSDFUniforms,
    raster: rasterUniforms,
    symbolIcon: symbolIconUniforms,
    symbolSDF: symbolSDFUniforms,
    background: backgroundUniforms,
    backgroundPattern: backgroundPatternUniforms
};
