// This file is generated. Edit build/generate-style-code.js, then run `yarn run codegen`.
// @flow
/* eslint-disable */

import styleSpec from '../../style-spec/reference/latest';

import {
    Properties,
    DataConstantProperty,
    DataDrivenProperty,
    CrossFadedDataDrivenProperty,
    CrossFadedProperty,
    ColorRampProperty
} from '../properties';

import type Color from '../../style-spec/util/color';

import type Formatted from '../../style-spec/expression/types/formatted';


export type PaintProps = {|
    "raster-opacity": DataConstantProperty<number>,
    "raster-hue-rotate": DataConstantProperty<number>,
    "raster-brightness-min": DataConstantProperty<number>,
    "raster-brightness-max": DataConstantProperty<number>,
    "raster-saturation": DataConstantProperty<number>,
    "raster-contrast": DataConstantProperty<number>,
    "raster-resampling": DataConstantProperty<"linear" | "nearest">,
    "raster-fade-duration": DataConstantProperty<number>,
|};

const paint: Properties<PaintProps> = new Properties({
    "raster-opacity": new DataConstantProperty(styleSpec["paint_raster"]["raster-opacity"]),
    "raster-hue-rotate": new DataConstantProperty(styleSpec["paint_raster"]["raster-hue-rotate"]),
    "raster-brightness-min": new DataConstantProperty(styleSpec["paint_raster"]["raster-brightness-min"]),
    "raster-brightness-max": new DataConstantProperty(styleSpec["paint_raster"]["raster-brightness-max"]),
    "raster-saturation": new DataConstantProperty(styleSpec["paint_raster"]["raster-saturation"]),
    "raster-contrast": new DataConstantProperty(styleSpec["paint_raster"]["raster-contrast"]),
    "raster-resampling": new DataConstantProperty(styleSpec["paint_raster"]["raster-resampling"]),
    "raster-fade-duration": new DataConstantProperty(styleSpec["paint_raster"]["raster-fade-duration"]),
});

// Note: without adding the explicit type annotation, Flow infers weaker types
// for these objects from their use in the constructor to StyleLayer, as
// {layout?: Properties<...>, paint: Properties<...>}
export default ({ paint }: $Exact<{
  paint: Properties<PaintProps>
}>);
