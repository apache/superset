import React from 'react';
import { Word } from 'd3-cloud';
import { PlainObject, DeriveEncoding } from 'encodable';
import { SupersetThemeProps } from '@superset-ui/core';
export declare const ROTATION: {
    flat: () => number;
    random: () => number;
    square: () => number;
};
export declare type RotationType = keyof typeof ROTATION;
export declare type WordCloudEncoding = DeriveEncoding<WordCloudEncodingConfig>;
declare type WordCloudEncodingConfig = {
    color: ['Color', string];
    fontFamily: ['Category', string];
    fontSize: ['Numeric', number];
    fontWeight: ['Category', string | number];
    text: ['Text', string];
};
/**
 * These props should be stored when saving the chart.
 */
export interface WordCloudVisualProps {
    encoding?: Partial<WordCloudEncoding>;
    rotation?: RotationType;
}
export interface WordCloudProps extends WordCloudVisualProps {
    data: PlainObject[];
    height: number;
    width: number;
}
export interface WordCloudState {
    words: Word[];
    scaleFactor: number;
}
declare const defaultProps: Required<WordCloudVisualProps>;
declare type FullWordCloudProps = WordCloudProps & typeof defaultProps & SupersetThemeProps;
declare const _default: React.FC<Pick<Pick<FullWordCloudProps, "data" | "height" | "width" | "theme"> & Partial<Pick<FullWordCloudProps, "encoding" | "rotation">> & Partial<Pick<Required<WordCloudVisualProps>, never>>, "data" | "height" | "width" | "encoding" | "rotation"> & {
    theme?: import("@emotion/react").Theme | undefined;
}>;
export default _default;
//# sourceMappingURL=WordCloud.d.ts.map