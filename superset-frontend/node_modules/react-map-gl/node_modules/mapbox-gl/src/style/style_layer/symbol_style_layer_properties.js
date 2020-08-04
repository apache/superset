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

export type LayoutProps = {|
    "symbol-placement": DataConstantProperty<"point" | "line" | "line-center">,
    "symbol-spacing": DataConstantProperty<number>,
    "symbol-avoid-edges": DataConstantProperty<boolean>,
    "symbol-sort-key": DataDrivenProperty<number>,
    "symbol-z-order": DataConstantProperty<"auto" | "viewport-y" | "source">,
    "icon-allow-overlap": DataConstantProperty<boolean>,
    "icon-ignore-placement": DataConstantProperty<boolean>,
    "icon-optional": DataConstantProperty<boolean>,
    "icon-rotation-alignment": DataConstantProperty<"map" | "viewport" | "auto">,
    "icon-size": DataDrivenProperty<number>,
    "icon-text-fit": DataConstantProperty<"none" | "width" | "height" | "both">,
    "icon-text-fit-padding": DataConstantProperty<[number, number, number, number]>,
    "icon-image": DataDrivenProperty<string>,
    "icon-rotate": DataDrivenProperty<number>,
    "icon-padding": DataConstantProperty<number>,
    "icon-keep-upright": DataConstantProperty<boolean>,
    "icon-offset": DataDrivenProperty<[number, number]>,
    "icon-anchor": DataDrivenProperty<"center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right">,
    "icon-pitch-alignment": DataConstantProperty<"map" | "viewport" | "auto">,
    "text-pitch-alignment": DataConstantProperty<"map" | "viewport" | "auto">,
    "text-rotation-alignment": DataConstantProperty<"map" | "viewport" | "auto">,
    "text-field": DataDrivenProperty<Formatted>,
    "text-font": DataDrivenProperty<Array<string>>,
    "text-size": DataDrivenProperty<number>,
    "text-max-width": DataDrivenProperty<number>,
    "text-line-height": DataConstantProperty<number>,
    "text-letter-spacing": DataDrivenProperty<number>,
    "text-justify": DataDrivenProperty<"auto" | "left" | "center" | "right">,
    "text-radial-offset": DataDrivenProperty<number>,
    "text-variable-anchor": DataConstantProperty<Array<"center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right">>,
    "text-anchor": DataDrivenProperty<"center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right">,
    "text-max-angle": DataConstantProperty<number>,
    "text-rotate": DataDrivenProperty<number>,
    "text-padding": DataConstantProperty<number>,
    "text-keep-upright": DataConstantProperty<boolean>,
    "text-transform": DataDrivenProperty<"none" | "uppercase" | "lowercase">,
    "text-offset": DataDrivenProperty<[number, number]>,
    "text-allow-overlap": DataConstantProperty<boolean>,
    "text-ignore-placement": DataConstantProperty<boolean>,
    "text-optional": DataConstantProperty<boolean>,
|};

const layout: Properties<LayoutProps> = new Properties({
    "symbol-placement": new DataConstantProperty(styleSpec["layout_symbol"]["symbol-placement"]),
    "symbol-spacing": new DataConstantProperty(styleSpec["layout_symbol"]["symbol-spacing"]),
    "symbol-avoid-edges": new DataConstantProperty(styleSpec["layout_symbol"]["symbol-avoid-edges"]),
    "symbol-sort-key": new DataDrivenProperty(styleSpec["layout_symbol"]["symbol-sort-key"]),
    "symbol-z-order": new DataConstantProperty(styleSpec["layout_symbol"]["symbol-z-order"]),
    "icon-allow-overlap": new DataConstantProperty(styleSpec["layout_symbol"]["icon-allow-overlap"]),
    "icon-ignore-placement": new DataConstantProperty(styleSpec["layout_symbol"]["icon-ignore-placement"]),
    "icon-optional": new DataConstantProperty(styleSpec["layout_symbol"]["icon-optional"]),
    "icon-rotation-alignment": new DataConstantProperty(styleSpec["layout_symbol"]["icon-rotation-alignment"]),
    "icon-size": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-size"]),
    "icon-text-fit": new DataConstantProperty(styleSpec["layout_symbol"]["icon-text-fit"]),
    "icon-text-fit-padding": new DataConstantProperty(styleSpec["layout_symbol"]["icon-text-fit-padding"]),
    "icon-image": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-image"]),
    "icon-rotate": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-rotate"]),
    "icon-padding": new DataConstantProperty(styleSpec["layout_symbol"]["icon-padding"]),
    "icon-keep-upright": new DataConstantProperty(styleSpec["layout_symbol"]["icon-keep-upright"]),
    "icon-offset": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-offset"]),
    "icon-anchor": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-anchor"]),
    "icon-pitch-alignment": new DataConstantProperty(styleSpec["layout_symbol"]["icon-pitch-alignment"]),
    "text-pitch-alignment": new DataConstantProperty(styleSpec["layout_symbol"]["text-pitch-alignment"]),
    "text-rotation-alignment": new DataConstantProperty(styleSpec["layout_symbol"]["text-rotation-alignment"]),
    "text-field": new DataDrivenProperty(styleSpec["layout_symbol"]["text-field"]),
    "text-font": new DataDrivenProperty(styleSpec["layout_symbol"]["text-font"]),
    "text-size": new DataDrivenProperty(styleSpec["layout_symbol"]["text-size"]),
    "text-max-width": new DataDrivenProperty(styleSpec["layout_symbol"]["text-max-width"]),
    "text-line-height": new DataConstantProperty(styleSpec["layout_symbol"]["text-line-height"]),
    "text-letter-spacing": new DataDrivenProperty(styleSpec["layout_symbol"]["text-letter-spacing"]),
    "text-justify": new DataDrivenProperty(styleSpec["layout_symbol"]["text-justify"]),
    "text-radial-offset": new DataDrivenProperty(styleSpec["layout_symbol"]["text-radial-offset"]),
    "text-variable-anchor": new DataConstantProperty(styleSpec["layout_symbol"]["text-variable-anchor"]),
    "text-anchor": new DataDrivenProperty(styleSpec["layout_symbol"]["text-anchor"]),
    "text-max-angle": new DataConstantProperty(styleSpec["layout_symbol"]["text-max-angle"]),
    "text-rotate": new DataDrivenProperty(styleSpec["layout_symbol"]["text-rotate"]),
    "text-padding": new DataConstantProperty(styleSpec["layout_symbol"]["text-padding"]),
    "text-keep-upright": new DataConstantProperty(styleSpec["layout_symbol"]["text-keep-upright"]),
    "text-transform": new DataDrivenProperty(styleSpec["layout_symbol"]["text-transform"]),
    "text-offset": new DataDrivenProperty(styleSpec["layout_symbol"]["text-offset"]),
    "text-allow-overlap": new DataConstantProperty(styleSpec["layout_symbol"]["text-allow-overlap"]),
    "text-ignore-placement": new DataConstantProperty(styleSpec["layout_symbol"]["text-ignore-placement"]),
    "text-optional": new DataConstantProperty(styleSpec["layout_symbol"]["text-optional"]),
});

export type PaintProps = {|
    "icon-opacity": DataDrivenProperty<number>,
    "icon-color": DataDrivenProperty<Color>,
    "icon-halo-color": DataDrivenProperty<Color>,
    "icon-halo-width": DataDrivenProperty<number>,
    "icon-halo-blur": DataDrivenProperty<number>,
    "icon-translate": DataConstantProperty<[number, number]>,
    "icon-translate-anchor": DataConstantProperty<"map" | "viewport">,
    "text-opacity": DataDrivenProperty<number>,
    "text-color": DataDrivenProperty<Color>,
    "text-halo-color": DataDrivenProperty<Color>,
    "text-halo-width": DataDrivenProperty<number>,
    "text-halo-blur": DataDrivenProperty<number>,
    "text-translate": DataConstantProperty<[number, number]>,
    "text-translate-anchor": DataConstantProperty<"map" | "viewport">,
|};

const paint: Properties<PaintProps> = new Properties({
    "icon-opacity": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-opacity"]),
    "icon-color": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-color"]),
    "icon-halo-color": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-halo-color"]),
    "icon-halo-width": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-halo-width"]),
    "icon-halo-blur": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-halo-blur"]),
    "icon-translate": new DataConstantProperty(styleSpec["paint_symbol"]["icon-translate"]),
    "icon-translate-anchor": new DataConstantProperty(styleSpec["paint_symbol"]["icon-translate-anchor"]),
    "text-opacity": new DataDrivenProperty(styleSpec["paint_symbol"]["text-opacity"]),
    "text-color": new DataDrivenProperty(styleSpec["paint_symbol"]["text-color"]),
    "text-halo-color": new DataDrivenProperty(styleSpec["paint_symbol"]["text-halo-color"]),
    "text-halo-width": new DataDrivenProperty(styleSpec["paint_symbol"]["text-halo-width"]),
    "text-halo-blur": new DataDrivenProperty(styleSpec["paint_symbol"]["text-halo-blur"]),
    "text-translate": new DataConstantProperty(styleSpec["paint_symbol"]["text-translate"]),
    "text-translate-anchor": new DataConstantProperty(styleSpec["paint_symbol"]["text-translate-anchor"]),
});

// Note: without adding the explicit type annotation, Flow infers weaker types
// for these objects from their use in the constructor to StyleLayer, as
// {layout?: Properties<...>, paint: Properties<...>}
export default ({ paint, layout }: $Exact<{
  paint: Properties<PaintProps>, layout: Properties<LayoutProps>
}>);
