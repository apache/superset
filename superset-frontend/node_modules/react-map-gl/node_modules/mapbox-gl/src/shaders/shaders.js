
// Disable Flow annotations here because Flow doesn't support importing GLSL files
/* eslint-disable flowtype/require-valid-file-annotation */

import preludeFrag from './_prelude.fragment.glsl';
import preludeVert from './_prelude.vertex.glsl';
import backgroundFrag from './background.fragment.glsl';
import backgroundVert from './background.vertex.glsl';
import backgroundPatternFrag from './background_pattern.fragment.glsl';
import backgroundPatternVert from './background_pattern.vertex.glsl';
import circleFrag from './circle.fragment.glsl';
import circleVert from './circle.vertex.glsl';
import clippingMaskFrag from './clipping_mask.fragment.glsl';
import clippingMaskVert from './clipping_mask.vertex.glsl';
import heatmapFrag from './heatmap.fragment.glsl';
import heatmapVert from './heatmap.vertex.glsl';
import heatmapTextureFrag from './heatmap_texture.fragment.glsl';
import heatmapTextureVert from './heatmap_texture.vertex.glsl';
import collisionBoxFrag from './collision_box.fragment.glsl';
import collisionBoxVert from './collision_box.vertex.glsl';
import collisionCircleFrag from './collision_circle.fragment.glsl';
import collisionCircleVert from './collision_circle.vertex.glsl';
import debugFrag from './debug.fragment.glsl';
import debugVert from './debug.vertex.glsl';
import fillFrag from './fill.fragment.glsl';
import fillVert from './fill.vertex.glsl';
import fillOutlineFrag from './fill_outline.fragment.glsl';
import fillOutlineVert from './fill_outline.vertex.glsl';
import fillOutlinePatternFrag from './fill_outline_pattern.fragment.glsl';
import fillOutlinePatternVert from './fill_outline_pattern.vertex.glsl';
import fillPatternFrag from './fill_pattern.fragment.glsl';
import fillPatternVert from './fill_pattern.vertex.glsl';
import fillExtrusionFrag from './fill_extrusion.fragment.glsl';
import fillExtrusionVert from './fill_extrusion.vertex.glsl';
import fillExtrusionPatternFrag from './fill_extrusion_pattern.fragment.glsl';
import fillExtrusionPatternVert from './fill_extrusion_pattern.vertex.glsl';
import hillshadePrepareFrag from './hillshade_prepare.fragment.glsl';
import hillshadePrepareVert from './hillshade_prepare.vertex.glsl';
import hillshadeFrag from './hillshade.fragment.glsl';
import hillshadeVert from './hillshade.vertex.glsl';
import lineFrag from './line.fragment.glsl';
import lineVert from './line.vertex.glsl';
import lineGradientFrag from './line_gradient.fragment.glsl';
import lineGradientVert from './line_gradient.vertex.glsl';
import linePatternFrag from './line_pattern.fragment.glsl';
import linePatternVert from './line_pattern.vertex.glsl';
import lineSDFFrag from './line_sdf.fragment.glsl';
import lineSDFVert from './line_sdf.vertex.glsl';
import rasterFrag from './raster.fragment.glsl';
import rasterVert from './raster.vertex.glsl';
import symbolIconFrag from './symbol_icon.fragment.glsl';
import symbolIconVert from './symbol_icon.vertex.glsl';
import symbolSDFFrag from './symbol_sdf.fragment.glsl';
import symbolSDFVert from './symbol_sdf.vertex.glsl';

export const prelude = compile(preludeFrag, preludeVert);
export const background = compile(backgroundFrag, backgroundVert);
export const backgroundPattern = compile(backgroundPatternFrag, backgroundPatternVert);
export const circle = compile(circleFrag, circleVert);
export const clippingMask = compile(clippingMaskFrag, clippingMaskVert);
export const heatmap = compile(heatmapFrag, heatmapVert);
export const heatmapTexture = compile(heatmapTextureFrag, heatmapTextureVert);
export const collisionBox = compile(collisionBoxFrag, collisionBoxVert);
export const collisionCircle = compile(collisionCircleFrag, collisionCircleVert);
export const debug = compile(debugFrag, debugVert);
export const fill = compile(fillFrag, fillVert);
export const fillOutline = compile(fillOutlineFrag, fillOutlineVert);
export const fillOutlinePattern = compile(fillOutlinePatternFrag, fillOutlinePatternVert);
export const fillPattern = compile(fillPatternFrag, fillPatternVert);
export const fillExtrusion = compile(fillExtrusionFrag, fillExtrusionVert);
export const fillExtrusionPattern = compile(fillExtrusionPatternFrag, fillExtrusionPatternVert);
export const hillshadePrepare = compile(hillshadePrepareFrag, hillshadePrepareVert);
export const hillshade = compile(hillshadeFrag, hillshadeVert);
export const line = compile(lineFrag, lineVert);
export const lineGradient = compile(lineGradientFrag, lineGradientVert);
export const linePattern = compile(linePatternFrag, linePatternVert);
export const lineSDF = compile(lineSDFFrag, lineSDFVert);
export const raster = compile(rasterFrag, rasterVert);
export const symbolIcon = compile(symbolIconFrag, symbolIconVert);
export const symbolSDF = compile(symbolSDFFrag, symbolSDFVert);

// Expand #pragmas to #ifdefs.

function compile(fragmentSource, vertexSource) {
    const re = /#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g;

    const fragmentPragmas = {};

    fragmentSource = fragmentSource.replace(re, (match, operation, precision, type, name) => {
        fragmentPragmas[name] = true;
        if (operation === 'define') {
            return `
#ifndef HAS_UNIFORM_u_${name}
varying ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
        } else /* if (operation === 'initialize') */ {
            return `
#ifdef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = u_${name};
#endif
`;
        }
    });

    vertexSource = vertexSource.replace(re, (match, operation, precision, type, name) => {
        const attrType = type === 'float' ? 'vec2' : 'vec4';
        const unpackType = name.match(/color/) ? 'color' : attrType;

        if (fragmentPragmas[name]) {
            if (operation === 'define') {
                return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float a_${name}_t;
attribute ${precision} ${attrType} a_${name};
varying ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
            } else /* if (operation === 'initialize') */ {
                if (unpackType === 'vec4') {
                    // vec4 attributes are only used for cross-faded properties, and are not packed
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${name} = a_${name};
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                } else {
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${name} = unpack_mix_${unpackType}(a_${name}, a_${name}_t);
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                }
            }
        } else {
            if (operation === 'define') {
                return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float a_${name}_t;
attribute ${precision} ${attrType} a_${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
            } else /* if (operation === 'initialize') */ {
                if (unpackType === 'vec4') {
                    // vec4 attributes are only used for cross-faded properties, and are not packed
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = a_${name};
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                } else /* */{
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = unpack_mix_${unpackType}(a_${name}, a_${name}_t);
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                }
            }
        }
    });

    return {fragmentSource, vertexSource};
}
