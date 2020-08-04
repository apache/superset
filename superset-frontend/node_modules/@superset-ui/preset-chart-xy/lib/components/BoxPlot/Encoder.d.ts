import { Encoder, DeriveEncoding } from 'encodable';
export declare type BoxPlotEncodingConfig = {
    x: ['XBand', number];
    y: ['YBand', number];
    color: ['Color', string];
};
export declare const boxPlotEncoderFactory: {
    channelTypes: import("encodable").DeriveChannelTypes<BoxPlotEncodingConfig>;
    create: (encoding?: Partial<DeriveEncoding<BoxPlotEncodingConfig>> | undefined) => Encoder<BoxPlotEncodingConfig>;
    createSelector: () => import("reselect").OutputSelector<Partial<DeriveEncoding<BoxPlotEncodingConfig>>, Encoder<BoxPlotEncodingConfig>, (res: Partial<DeriveEncoding<BoxPlotEncodingConfig>>) => Encoder<BoxPlotEncodingConfig>>;
    DEFAULT_ENCODING: DeriveEncoding<BoxPlotEncodingConfig>;
};
export declare type BoxPlotEncoding = DeriveEncoding<BoxPlotEncodingConfig>;
export declare type BoxPlotEncoder = Encoder<BoxPlotEncodingConfig>;
//# sourceMappingURL=Encoder.d.ts.map