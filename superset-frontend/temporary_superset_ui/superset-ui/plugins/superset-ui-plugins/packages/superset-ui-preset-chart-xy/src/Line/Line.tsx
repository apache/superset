/* eslint-disable sort-keys, no-magic-numbers, complexity */

import React, { PureComponent } from 'react';
import { kebabCase, groupBy, flatMap, uniqueId, values } from 'lodash';
import {
  AreaSeries,
  LinearGradient,
  LineSeries,
  XYChart,
  CrossHair,
  WithTooltip,
} from '@data-ui/xy-chart';
import { chartTheme } from '@data-ui/theme';
import { Margin, Dimension } from '@superset-ui/dimension';
import { WithLegend } from '@superset-ui/chart-composition';
import { createSelector } from 'reselect';
import XYChartLayout from '../utils/XYChartLayout';
import Encoder, { ChannelTypes, Encoding, Outputs } from './Encoder';
import { Dataset, PlainObject } from '../encodeable/types/Data';
import ChartLegend, { Hooks as LegendHooks } from '../components/legend/ChartLegend';
import { PartialSpec } from '../encodeable/types/Specification';
import DefaultTooltipRenderer from './DefaultTooltipRenderer';

chartTheme.gridStyles.stroke = '#f1f3f5';

const DEFAULT_MARGIN = { top: 20, right: 20, left: 20, bottom: 20 };

export interface TooltipProps {
  encoder: Encoder;
  allSeries: Series[];
  datum: SeriesValue;
  series: {
    [key: string]: {
      y: number;
    };
  };
  theme: typeof chartTheme;
}

const defaultProps = {
  className: '',
  margin: DEFAULT_MARGIN,
  theme: chartTheme,
  TooltipRenderer: DefaultTooltipRenderer,
};

/** Part of formData that is needed for rendering logic in this file */
export type FormDataProps = {
  margin?: Margin;
  theme?: typeof chartTheme;
} & PartialSpec<Encoding>;

export type HookProps = {
  TooltipRenderer?: React.ComponentType<TooltipProps>;
} & LegendHooks<ChannelTypes>;

type Props = {
  className?: string;
  width: string | number;
  height: string | number;
  data: Dataset;
} & HookProps &
  FormDataProps &
  Readonly<typeof defaultProps>;

export interface Series {
  key: string;
  stroke: Outputs['stroke'];
  fill: Outputs['fill'];
  strokeDasharray: Outputs['strokeDasharray'];
  values: SeriesValue[];
}

export interface SeriesValue {
  x: number | Date;
  y: number;
  data: PlainObject;
  parent: Series;
}

const CIRCLE_STYLE = { strokeWidth: 1.5 };

export default class LineChart extends PureComponent<Props> {
  static defaultProps = defaultProps;

  encoder: Encoder;
  private createEncoder: () => void;

  constructor(props: Props) {
    super(props);

    const createEncoder = createSelector(
      (p: PartialSpec<Encoding>) => p.encoding,
      p => p.commonEncoding,
      p => p.options,
      (encoding, commonEncoding, options) => new Encoder({ encoding, commonEncoding, options }),
    );

    this.createEncoder = () => {
      this.encoder = createEncoder(this.props);
    };

    this.encoder = createEncoder(this.props);
    this.renderLegend = this.renderLegend.bind(this);
    this.renderChart = this.renderChart.bind(this);
  }

  renderChart(dim: Dimension) {
    const { width, height } = dim;
    const { data, margin, theme, TooltipRenderer } = this.props;

    const { channels } = this.encoder;
    const fieldNames = this.encoder.getGroupBys();

    const groups = groupBy(data, row => fieldNames.map(f => `${f}=${row[f]}`).join(','));

    const allSeries = values(groups).map(seriesData => {
      const firstDatum = seriesData[0];
      const key = fieldNames.map(f => firstDatum[f]).join(',');
      const series: Series = {
        key: key.length === 0 ? channels.y.getTitle() : key,
        fill: channels.fill.encode(firstDatum, false),
        stroke: channels.stroke.encode(firstDatum, '#222'),
        strokeDasharray: channels.strokeDasharray.encode(firstDatum, ''),
        values: [],
      };

      series.values = seriesData
        .map(v => ({
          x: channels.x.get<number | Date>(v),
          y: channels.y.get<number>(v),
          data: v,
          parent: series,
        }))
        .sort((a: SeriesValue, b: SeriesValue) => {
          const aTime = a.x instanceof Date ? a.x.getTime() : a.x;
          const bTime = b.x instanceof Date ? b.x.getTime() : b.x;

          return aTime - bTime;
        });

      return series;
    });

    const filledSeries = flatMap(
      allSeries
        .filter(({ fill }) => fill)
        .map(series => {
          const gradientId = uniqueId(kebabCase(`gradient-${series.key}`));

          return [
            <LinearGradient
              key={`${series.key}-gradient`}
              id={gradientId}
              from={series.stroke}
              to="#fff"
            />,
            <AreaSeries
              key={`${series.key}-fill`}
              seriesKey={series.key}
              data={series.values}
              interpolation="linear"
              fill={`url(#${gradientId})`}
              stroke={series.stroke}
              strokeWidth={1.5}
            />,
          ];
        }),
    );

    const unfilledSeries = allSeries
      .filter(({ fill }) => !fill)
      .map(series => (
        <LineSeries
          key={series.key}
          seriesKey={series.key}
          interpolation="linear"
          data={series.values}
          stroke={series.stroke}
          strokeDasharray={series.strokeDasharray}
          strokeWidth={1.5}
        />
      ));

    const children = filledSeries.concat(unfilledSeries);

    const layout = new XYChartLayout({
      width,
      height,
      margin: { ...DEFAULT_MARGIN, ...margin },
      theme,
      xEncoder: channels.x,
      yEncoder: channels.y,
      children,
    });

    return layout.renderChartWithFrame((chartDim: Dimension) => (
      <WithTooltip
        renderTooltip={({
          datum,
          series,
        }: {
          datum: SeriesValue;
          series: {
            [key: string]: {
              y: number;
            };
          };
        }) => (
          <TooltipRenderer
            encoder={this.encoder}
            allSeries={allSeries}
            datum={datum}
            series={series}
            theme={theme}
          />
        )}
      >
        {({
          onMouseLeave,
          onMouseMove,
          tooltipData,
        }: {
          onMouseLeave: (...args: any[]) => void;
          onMouseMove: (...args: any[]) => void;
          tooltipData: any;
        }) => (
          <XYChart
            width={chartDim.width}
            height={chartDim.height}
            ariaLabel="LineChart"
            eventTrigger="container"
            margin={layout.margin}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            renderTooltip={null}
            showYGrid
            snapTooltipToDataX
            theme={theme}
            tooltipData={tooltipData}
            xScale={channels.x.definition.scale}
            yScale={channels.y.definition.scale}
          >
            {children}
            {layout.renderXAxis()}
            {layout.renderYAxis()}
            <CrossHair
              fullHeight
              strokeDasharray=""
              showHorizontalLine={false}
              circleFill={(d: SeriesValue) =>
                d.y === tooltipData.datum.y ? d.parent.stroke : '#fff'
              }
              circleSize={(d: SeriesValue) => (d.y === tooltipData.datum.y ? 6 : 4)}
              circleStroke={(d: SeriesValue) =>
                d.y === tooltipData.datum.y ? '#fff' : d.parent.stroke
              }
              circleStyles={CIRCLE_STYLE}
              stroke="#ccc"
              showCircle
              showMultipleCircles
            />
          </XYChart>
        )}
      </WithTooltip>
    ));
  }

  renderLegend() {
    const {
      data,
      LegendGroupRenderer,
      LegendItemRenderer,
      LegendItemLabelRenderer,
      LegendItemMarkRenderer,
    } = this.props;

    return (
      <ChartLegend<ChannelTypes, Outputs, Encoding>
        data={data}
        encoder={this.encoder}
        LegendGroupRenderer={LegendGroupRenderer}
        LegendItemRenderer={LegendItemRenderer}
        LegendItemMarkRenderer={LegendItemMarkRenderer}
        LegendItemLabelRenderer={LegendItemLabelRenderer}
      />
    );
  }

  render() {
    const { className, width, height } = this.props;

    this.createEncoder();

    return (
      <WithLegend
        className={`superset-chart-line ${className}`}
        width={width}
        height={height}
        position="top"
        renderLegend={this.encoder.hasLegend() ? this.renderLegend : undefined}
        renderChart={this.renderChart}
      />
    );
  }
}
