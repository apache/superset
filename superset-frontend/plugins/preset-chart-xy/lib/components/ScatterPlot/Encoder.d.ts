import { Encoder, DeriveEncoding, DeriveChannelOutputs } from 'encodable';
export declare type ScatterPlotEncodingConfig = {
    x: ['X', number];
    y: ['Y', number];
    fill: ['Color', string];
    group: ['Category', string, 'multiple'];
    size: ['Numeric', number];
    stroke: ['Color', string];
    tooltip: ['Text', string, 'multiple'];
};
export declare const scatterPlotEncoderFactory: {
    channelTypes: import("encodable").DeriveChannelTypes<ScatterPlotEncodingConfig>;
    create: (encoding?: Partial<DeriveEncoding<ScatterPlotEncodingConfig>> | undefined) => Encoder<ScatterPlotEncodingConfig>;
    createSelector: () => import("reselect").OutputSelector<Partial<DeriveEncoding<ScatterPlotEncodingConfig>>, Encoder<ScatterPlotEncodingConfig>, (res: Partial<DeriveEncoding<ScatterPlotEncodingConfig>>) => Encoder<ScatterPlotEncodingConfig>>;
    DEFAULT_ENCODING: DeriveEncoding<ScatterPlotEncodingConfig>;
};
export declare type ScatterPlotEncoding = DeriveEncoding<ScatterPlotEncodingConfig>;
export declare type ScatterPlotEncoder = Encoder<ScatterPlotEncodingConfig>;
export declare type ScatterPlotChannelOutputs = DeriveChannelOutputs<ScatterPlotEncodingConfig>;
//# sourceMappingURL=Encoder.d.ts.map