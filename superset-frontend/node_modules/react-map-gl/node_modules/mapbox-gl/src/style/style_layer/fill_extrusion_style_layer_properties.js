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
    "fill-extrusion-opacity": DataConstantProperty<number>,
    "fill-extrusion-color": DataDrivenProperty<Color>,
    "fill-extrusion-translate": DataConstantProperty<[number, number]>,
    "fill-extrusion-translate-anchor": DataConstantProperty<"map" | "viewport">,
    "fill-extrusion-pattern": CrossFadedDataDrivenProperty<string>,
    "fill-extrusion-height": DataDrivenProperty<number>,
    "fill-extrusion-base": DataDrivenProperty<number>,
    "fill-extrusion-vertical-gradient": DataConstantProperty<boolean>,
|};

const paint: Properties<PaintProps> = new Properties({
    "fill-extrusion-opacity": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-opacity"]),
    "fill-extrusion-color": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-color"]),
    "fill-extrusion-translate": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-translate"]),
    "fill-extrusion-translate-anchor": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-translate-anchor"]),
    "fill-extrusion-pattern": new CrossFadedDataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-pattern"]),
    "fill-extrusion-height": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-height"]),
    "fill-extrusion-base": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-base"]),
    "fill-extrusion-vertical-gradient": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-vertical-gradient"]),
});

// Note: without adding the explicit type annotation, Flow infers weaker types
// for these objects from their use in the constructor to StyleLayer, as
// {layout?: Properties<...>, paint: Properties<...>}
export default ({ paint }: $Exact<{
  paint: Properties<PaintProps>
}>);
