import Encoder from 'encodable/lib/encoders/Encoder';
import { DeriveEncoding, DeriveChannelOutputs } from 'encodable/lib/types/Encoding';
export declare type LineEncodingConfig = {
    x: ['X', number];
    y: ['Y', number];
    fill: ['Category', boolean];
    stroke: ['Color', string];
    strokeDasharray: ['Category', string];
    strokeWidth: ['Numeric', number];
};
export declare const lineEncoderFactory: {
    channelTypes: import("encodable/lib/types/Encoding").DeriveChannelTypes<LineEncodingConfig>;
    create: (encoding?: Partial<DeriveEncoding<LineEncodingConfig>> | undefined) => Encoder<LineEncodingConfig>;
    createSelector: () => import("reselect").OutputSelector<Partial<DeriveEncoding<LineEncodingConfig>>, Encoder<LineEncodingConfig>, (res: Partial<DeriveEncoding<LineEncodingConfig>>) => Encoder<LineEncodingConfig>>;
    DEFAULT_ENCODING: DeriveEncoding<LineEncodingConfig>;
};
export declare type LineEncoding = DeriveEncoding<LineEncodingConfig>;
export declare type LineEncoder = Encoder<LineEncodingConfig>;
export declare type LineChannelOutputs = DeriveChannelOutputs<LineEncodingConfig>;
//# sourceMappingURL=Encoder.d.ts.map