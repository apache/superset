import { CSSProperties } from 'react';
import { EncodingConfig, LegendGroupInformation, LegendItemInformation } from 'encodable';
export declare type LegendItemMarkRendererProps<Config extends EncodingConfig> = {
    group: LegendGroupInformation<Config>;
    item: LegendItemInformation<Config>;
};
export declare type LegendItemMarkRendererType<Config extends EncodingConfig> = React.ComponentType<LegendItemMarkRendererProps<Config>>;
export declare type LegendItemLabelRendererProps<Config extends EncodingConfig> = LegendItemMarkRendererProps<Config>;
export declare type LegendItemLabelRendererType<Config extends EncodingConfig> = React.ComponentType<LegendItemLabelRendererProps<Config>>;
export declare type LegendItemRendererProps<Config extends EncodingConfig> = {
    group: LegendGroupInformation<Config>;
    item: LegendItemInformation<Config>;
    MarkRenderer?: LegendItemMarkRendererType<Config>;
    LabelRenderer?: LegendItemLabelRendererType<Config>;
};
export declare type LegendItemRendererType<Config extends EncodingConfig> = React.ComponentType<LegendItemRendererProps<Config>>;
export declare type LegendGroupRendererProps<Config extends EncodingConfig> = {
    group: LegendGroupInformation<Config>;
    ItemRenderer?: LegendItemRendererType<Config>;
    ItemMarkRenderer?: LegendItemMarkRendererType<Config>;
    ItemLabelRenderer?: LegendItemLabelRendererType<Config>;
    style?: CSSProperties;
};
export declare type LegendGroupRendererType<Config extends EncodingConfig> = React.ComponentType<LegendGroupRendererProps<Config>>;
export declare type LegendRendererProps<Config extends EncodingConfig> = {
    groups: LegendGroupInformation<Config>[];
    LegendGroupRenderer?: LegendGroupRendererType<Config>;
    LegendItemRenderer?: LegendItemRendererType<Config>;
    LegendItemMarkRenderer?: LegendItemMarkRendererType<Config>;
    LegendItemLabelRenderer?: LegendItemLabelRendererType<Config>;
    style?: CSSProperties;
};
export declare type LegendRendererType<Config extends EncodingConfig> = React.ComponentType<LegendRendererProps<Config>>;
export declare type LegendHooks<Config extends EncodingConfig> = {
    LegendRenderer?: LegendRendererType<Config>;
    LegendGroupRenderer?: LegendGroupRendererType<Config>;
    LegendItemRenderer?: LegendItemRendererType<Config>;
    LegendItemMarkRenderer?: LegendItemMarkRendererType<Config>;
    LegendItemLabelRenderer?: LegendItemLabelRendererType<Config>;
};
//# sourceMappingURL=types.d.ts.map