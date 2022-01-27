import { ChartProps } from '@superset-ui/core';
export default function transformProps(chartProps: ChartProps): {
    LegendGroupRenderer?: import("../components/legend/types").LegendGroupRendererType<import("../components/ScatterPlot/Encoder").ScatterPlotEncodingConfig> | undefined;
    LegendItemRenderer?: import("../components/legend/types").LegendItemRendererType<import("../components/ScatterPlot/Encoder").ScatterPlotEncodingConfig> | undefined;
    LegendItemMarkRenderer?: import("../components/legend/types").LegendItemMarkRendererType<import("../components/ScatterPlot/Encoder").ScatterPlotEncodingConfig> | undefined;
    LegendItemLabelRenderer?: import("../components/legend/types").LegendItemLabelRendererType<import("../components/ScatterPlot/Encoder").ScatterPlotEncodingConfig> | undefined;
    LegendRenderer?: import("../components/legend/types").LegendRendererType<import("../components/ScatterPlot/Encoder").ScatterPlotEncodingConfig> | undefined;
    TooltipRenderer?: import("react").ComponentType<import("../components/ScatterPlot/ScatterPlot").TooltipProps> | undefined;
    data: any;
    width: number;
    height: number;
    encoding: any;
    margin: any;
    theme: any;
};
//# sourceMappingURL=transformProps.d.ts.map