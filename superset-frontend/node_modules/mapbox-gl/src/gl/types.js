// @flow

type BlendFuncConstant =
    | $PropertyType<WebGLRenderingContext, 'ZERO'>
    | $PropertyType<WebGLRenderingContext, 'ONE'>
    | $PropertyType<WebGLRenderingContext, 'SRC_COLOR'>
    | $PropertyType<WebGLRenderingContext, 'ONE_MINUS_SRC_COLOR'>
    | $PropertyType<WebGLRenderingContext, 'DST_COLOR'>
    | $PropertyType<WebGLRenderingContext, 'ONE_MINUS_DST_COLOR'>
    | $PropertyType<WebGLRenderingContext, 'SRC_ALPHA'>
    | $PropertyType<WebGLRenderingContext, 'ONE_MINUS_SRC_ALPHA'>
    | $PropertyType<WebGLRenderingContext, 'DST_ALPHA'>
    | $PropertyType<WebGLRenderingContext, 'ONE_MINUS_DST_ALPHA'>
    | $PropertyType<WebGLRenderingContext, 'CONSTANT_COLOR'>
    | $PropertyType<WebGLRenderingContext, 'ONE_MINUS_CONSTANT_COLOR'>
    | $PropertyType<WebGLRenderingContext, 'CONSTANT_ALPHA'>
    | $PropertyType<WebGLRenderingContext, 'ONE_MINUS_CONSTANT_ALPHA'>
    | $PropertyType<WebGLRenderingContext, 'BLEND_COLOR'>;

export type BlendFuncType = [BlendFuncConstant, BlendFuncConstant];

export type BlendEquationType =
    | $PropertyType<WebGLRenderingContext, 'FUNC_ADD'>
    | $PropertyType<WebGLRenderingContext, 'FUNC_SUBTRACT'>
    | $PropertyType<WebGLRenderingContext, 'FUNC_REVERSE_SUBTRACT'>;

export type ColorMaskType = [boolean, boolean, boolean, boolean];

export type CompareFuncType =
    | $PropertyType<WebGLRenderingContext, 'NEVER'>
    | $PropertyType<WebGLRenderingContext, 'LESS'>
    | $PropertyType<WebGLRenderingContext, 'EQUAL'>
    | $PropertyType<WebGLRenderingContext, 'LEQUAL'>
    | $PropertyType<WebGLRenderingContext, 'GREATER'>
    | $PropertyType<WebGLRenderingContext, 'NOTEQUAL'>
    | $PropertyType<WebGLRenderingContext, 'GEQUAL'>
    | $PropertyType<WebGLRenderingContext, 'ALWAYS'>;

export type DepthMaskType = boolean;

export type DepthRangeType = [number, number];

export type DepthFuncType = CompareFuncType;

export type StencilFuncType = {
    func: CompareFuncType,
    ref: number,
    mask: number
};

export type StencilOpConstant =
    | $PropertyType<WebGLRenderingContext, 'KEEP'>
    | $PropertyType<WebGLRenderingContext, 'ZERO'>
    | $PropertyType<WebGLRenderingContext, 'REPLACE'>
    | $PropertyType<WebGLRenderingContext, 'INCR'>
    | $PropertyType<WebGLRenderingContext, 'INCR_WRAP'>
    | $PropertyType<WebGLRenderingContext, 'DECR'>
    | $PropertyType<WebGLRenderingContext, 'DECR_WRAP'>
    | $PropertyType<WebGLRenderingContext, 'INVERT'>;

export type StencilOpType = [StencilOpConstant, StencilOpConstant, StencilOpConstant];

export type TextureUnitType = number;

export type ViewportType = [number, number, number, number];

export type StencilTest =
    | { func: $PropertyType<WebGLRenderingContext, 'NEVER'>, mask: 0 }
    | { func: $PropertyType<WebGLRenderingContext, 'LESS'>, mask: number }
    | { func: $PropertyType<WebGLRenderingContext, 'EQUAL'>, mask: number }
    | { func: $PropertyType<WebGLRenderingContext, 'LEQUAL'>, mask: number }
    | { func: $PropertyType<WebGLRenderingContext, 'GREATER'>, mask: number }
    | { func: $PropertyType<WebGLRenderingContext, 'NOTEQUAL'>, mask: number }
    | { func: $PropertyType<WebGLRenderingContext, 'GEQUAL'>, mask: number }
    | { func: $PropertyType<WebGLRenderingContext, 'ALWAYS'>, mask: 0 };

export type CullFaceModeType =
    | $PropertyType<WebGLRenderingContext, 'FRONT'>
    | $PropertyType<WebGLRenderingContext, 'BACK'>
    | $PropertyType<WebGLRenderingContext, 'FRONT_AND_BACK'>

export type FrontFaceType =
    | $PropertyType<WebGLRenderingContext, 'CW'>
    | $PropertyType<WebGLRenderingContext, 'CCW'>
