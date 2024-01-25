// DODO was here
import React, { RefObject } from 'react';
import {
  ChartDataResponseResult,
  ChartProps,
  ContextMenuFilters,
  FilterState,
  HandlerFunction,
  LegendState,
  PlainObject,
  QueryFormColumn,
  SetDataMaskHook,
  ChartPlugin,
  SqlaFormData,
  ChartMetadata,
} from '@superset-ui/core';
import { EChartsCoreOption, ECharts } from 'echarts';
import { TooltipMarker } from 'echarts/types/src/util/format';
import { StackControlsValue } from './constants';

export type EchartsStylesProps = {
  height: number;
  width: number;
};

export type Refs = {
  echartRef?: React.Ref<EchartsHandler>;
  divRef?: RefObject<HTMLDivElement>;
};

export interface EchartsProps {
  height: number;
  width: number;
  echartOptions: EChartsCoreOption;
  eventHandlers?: EventHandlers;
  zrEventHandlers?: EventHandlers;
  selectedValues?: Record<number, string>;
  forceClear?: boolean;
  refs: Refs;
}

export interface EchartsHandler {
  getEchartInstance: () => ECharts | undefined;
}

export enum ForecastSeriesEnum {
  Observation = '',
  ForecastTrend = '__yhat',
  ForecastUpper = '__yhat_upper',
  ForecastLower = '__yhat_lower',
}

export type ForecastSeriesContext = {
  name: string;
  type: ForecastSeriesEnum;
};

export enum LegendOrientation {
  Top = 'top',
  Bottom = 'bottom',
  Left = 'left',
  Right = 'right',
}

export enum LegendType {
  Scroll = 'scroll',
  Plain = 'plain',
}

export type ForecastValue = {
  marker: TooltipMarker;
  observation?: number;
  forecastTrend?: number;
  forecastLower?: number;
  forecastUpper?: number;
};

export type LegendFormData = {
  legendMargin: number | null | string;
  legendOrientation: LegendOrientation;
  legendType: LegendType;
  showLegend: boolean;
};

export type EventHandlers = Record<string, { (props: any): void }>;

export enum LabelPositionEnum {
  Top = 'top',
  Left = 'left',
  Right = 'right',
  Bottom = 'bottom',
  Inside = 'inside',
  InsideLeft = 'insideLeft',
  InsideRight = 'insideRight',
  InsideTop = 'insideTop',
  InsideBottom = 'insideBottom',
  InsideTopLeft = 'insideTopLeft',
  InsideBottomLeft = 'insideBottomLeft',
  InsideTopRight = 'insideTopRight',
  InsideBottomRight = 'insideBottomRight',
}

export interface BaseChartProps<T extends PlainObject> extends ChartProps<T> {
  queriesData: ChartDataResponseResult[];
}

export interface BaseTransformedProps<F> {
  echartOptions: EChartsCoreOption;
  formData: F;
  height: number;
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  setDataMask?: SetDataMaskHook;
  onLegendStateChanged?: (state: LegendState) => void;
  filterState?: FilterState;
  refs: Refs;
  width: number;
  emitCrossFilters?: boolean;
  coltypeMapping?: Record<string, number>;
}

export type CrossFilterTransformedProps = {
  groupby: QueryFormColumn[];
  labelMap: Record<string, string[]>;
  setControlValue?: HandlerFunction;
  setDataMask: SetDataMaskHook;
  selectedValues: Record<number, string>;
  emitCrossFilters?: boolean;
};

export type ContextMenuTransformedProps = {
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  setDataMask?: SetDataMaskHook;
};

export interface TitleFormData {
  xAxisTitle: string;
  xAxisTitleMargin: number;
  yAxisTitle: string;
  yAxisTitleMargin: number;
  yAxisTitlePosition: string;
}

export type StackType = boolean | null | Partial<StackControlsValue>;

export interface TreePathInfo {
  name: string;
  dataIndex: number;
  value: number | number[];
}

export class EchartsChartPlugin<
  T extends SqlaFormData = SqlaFormData,
  P extends ChartProps = ChartProps,
> extends ChartPlugin<T, P> {
  constructor(props: any) {
    const { metadata, ...restProps } = props;
    super({
      ...restProps,
      metadata: new ChartMetadata({
        parseMethod: 'json',
        ...metadata,
      }),
    });
  }
}

// DODO added
export type EchartsLegendFormData = {
  legendMargin: number | null | string;
  legendOrientation: LegendOrientation;
  legendType: LegendType;
  showLegend: boolean;
};

// DODO added
export const DEFAULT_LEGEND_FORM_DATA: EchartsLegendFormData = {
  legendMargin: null,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  showLegend: true,
};

export * from './Timeseries/types';
