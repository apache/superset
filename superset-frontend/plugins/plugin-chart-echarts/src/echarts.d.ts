/**
 * Declaration file for ECharts modules
 * This suppresses TypeScript errors for the specific imports that are causing problems
 */

// Declare the main echarts module
declare module 'echarts' {
  export const util: any;
  export function init(dom: HTMLElement, theme?: string, opts?: any): any;
  export type SeriesOption = any;
}

// Declare the echarts/core module
declare module 'echarts/core' {
  export const graphic: any;
  export const format: any;
  export function use(components: any[]): void;
  export function init(dom: HTMLElement, theme?: string, opts?: any): any;
  export type EChartsCoreOption = any;
  export type EChartsType = any;
  export type ComposeOption<T> = any;
}

// Declare the echarts/charts module
declare module 'echarts/charts' {
  export const BarChart: any;
  export const BoxplotChart: any;
  export const FunnelChart: any;
  export const GaugeChart: any;
  export const GraphChart: any;
  export const HeatmapChart: any;
  export const LineChart: any;
  export const PieChart: any;
  export const RadarChart: any;
  export const SankeyChart: any;
  export const ScatterChart: any;
  export const SunburstChart: any;
  export const TreeChart: any;
  export const TreemapChart: any;

  export type BarSeriesOption = any;
  export type BoxplotSeriesOption = any;
  export type FunnelSeriesOption = any;
  export type GaugeSeriesOption = any;
  export type GraphSeriesOption = any;
  export type HeatmapSeriesOption = any;
  export type LineSeriesOption = any;
  export type PieSeriesOption = any;
  export type RadarSeriesOption = any;
  export type SankeySeriesOption = any;
  export type ScatterSeriesOption = any;
  export type SunburstSeriesOption = any;
  export type TreeSeriesOption = any;
  export type TreemapSeriesOption = any;
}

// Declare the echarts/components module
declare module 'echarts/components' {
  export const TitleComponent: any;
  export const TooltipComponent: any;
  export const GridComponent: any;
  export const LegendComponent: any;
  export type GridComponentOption = any;
  export type LegendComponentOption = any;
}

// Declare the echarts/renderers module
declare module 'echarts/renderers' {
  export const CanvasRenderer: any;
  export const SVGRenderer: any;
}

// Declare the echarts/features module
declare module 'echarts/features' {
  export const LabelLayout: any;
  export const UniversalTransition: any;
}

// Declare the echarts/types/src/util/types module
declare module 'echarts/types/src/util/types' {
  export type CallbackDataParams = any;
  export type DefaultStatesMixin = any;
  export type ItemStyleOption = any;
  export type LineStyleOption = any;
  export type OptionName = any;
  export type SeriesLabelOption = any;
  export type SeriesLineLabelOption = any;
  export type SeriesOption = any;
  export type SeriesTooltipOption = any;
  export type ViewRootGroup = any;
  export type ZRLineType = any;
  export type LabelFormatterCallback = any;
}

// Declare the echarts/types/src/util/format module
declare module 'echarts/types/src/util/format' {
  export type TooltipMarker = any;
}

// Declare the chart-specific types
declare module 'echarts/types/src/chart/gauge/GaugeSeries' {
  export type GaugeDataItemOption = any;
}

declare module 'echarts/types/src/chart/graph/GraphSeries' {
  export type GraphEdgeItemOption = any;
  export type GraphNodeItemOption = any;
}

declare module 'echarts/types/src/chart/sunburst/SunburstSeries' {
  export type SunburstSeriesNodeItemOption = any;
}

declare module 'echarts/types/src/chart/tree/TreeSeries' {
  export type TreeSeriesNodeItemOption = any;
}

declare module 'echarts/types/src/chart/treemap/TreemapSeries' {
  export type TreemapSeriesNodeItemOption = any;
}

declare module 'echarts/types/src/chart/radar/RadarSeries' {
  export type RadarSeriesDataItemOption = any;
}

declare module 'echarts/types/src/chart/bar/BarSeries' {
  export type BarDataItemOption = any;
}

declare module 'echarts/types/src/component/marker/MarkAreaModel' {
  export type MarkArea1DDataItemOption = any;
  export type MarkArea2DDataItemOption = any;
}

declare module 'echarts/types/src/component/marker/MarkLineModel' {
  export type MarkLine1DDataItemOption = any;
}

declare module 'echarts/types/src/model/Global' {
  export default interface GlobalModel {
    [key: string]: any;
  }
}

declare module 'echarts/types/src/model/Component' {
  export default interface ComponentModel {
    [key: string]: any;
  }
}
