import { ChartProps } from '@superset-ui/core';
export default function transformProps(chartProps: ChartProps): {
    LegendGroupRenderer?: import("../components/legend/types").LegendGroupRendererType<import("../components/Line/Encoder").LineEncodingConfig> | undefined;
    LegendItemRenderer?: import("../components/legend/types").LegendItemRendererType<import("../components/Line/Encoder").LineEncodingConfig> | undefined;
    LegendItemMarkRenderer?: import("../components/legend/types").LegendItemMarkRendererType<import("../components/Line/Encoder").LineEncodingConfig> | undefined;
    LegendItemLabelRenderer?: import("../components/legend/types").LegendItemLabelRendererType<import("../components/Line/Encoder").LineEncodingConfig> | undefined;
    LegendRenderer?: import("../components/legend/types").LegendRendererType<import("../components/Line/Encoder").LineEncodingConfig> | undefined;
    TooltipRenderer?: import("react").ComponentType<import("../components/Line/Line").TooltipProps> | undefined;
    margin?: import("@superset-ui/core").Margin | undefined;
    theme?: import("@data-ui/theme").ChartTheme | undefined;
    encoding?: Partial<import("encodable").DeriveEncoding<import("../components/Line/Encoder").LineEncodingConfig>> | undefined;
    data: any;
    width: number;
    height: number;
};
//# sourceMappingURL=transformProps.d.ts.map