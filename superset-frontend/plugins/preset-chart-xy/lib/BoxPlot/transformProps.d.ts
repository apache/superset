import { ChartProps } from '@superset-ui/core';
export default function transformProps(chartProps: ChartProps): {
    LegendGroupRenderer?: import("../components/legend/types").LegendGroupRendererType<import("../components/BoxPlot/Encoder").BoxPlotEncodingConfig> | undefined;
    LegendItemRenderer?: import("../components/legend/types").LegendItemRendererType<import("../components/BoxPlot/Encoder").BoxPlotEncodingConfig> | undefined;
    LegendItemMarkRenderer?: import("../components/legend/types").LegendItemMarkRendererType<import("../components/BoxPlot/Encoder").BoxPlotEncodingConfig> | undefined;
    LegendItemLabelRenderer?: import("../components/legend/types").LegendItemLabelRendererType<import("../components/BoxPlot/Encoder").BoxPlotEncodingConfig> | undefined;
    LegendRenderer?: import("../components/legend/types").LegendRendererType<import("../components/BoxPlot/Encoder").BoxPlotEncodingConfig> | undefined;
    TooltipRenderer?: import("react").ComponentType<import("../components/BoxPlot/BoxPlot").TooltipProps> | undefined;
    data: {
        label: string;
        min: number;
        max: number;
        firstQuartile: number;
        median: number;
        thirdQuartile: number;
        outliers: number[];
    }[];
    width: number;
    height: number;
    margin: any;
    theme: any;
    encoding: import("encodable").DeriveEncoding<import("../components/BoxPlot/Encoder").BoxPlotEncodingConfig>;
};
//# sourceMappingURL=transformProps.d.ts.map