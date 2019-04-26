/* eslint-disable sort-keys, no-magic-numbers, complexity */

import React, { PureComponent } from 'react';
import {
  AreaSeries,
  LinearGradient,
  LineSeries,
  XYChart,
  CrossHair,
  WithTooltip,
} from '@data-ui/xy-chart';
import { chartTheme, ChartTheme } from '@data-ui/theme';
import { Margin, Dimension } from '@superset-ui/dimension';
import { groupBy, flatMap, uniqueId, values } from 'lodash';
import { createSelector } from 'reselect';
import createTooltip from './createTooltip';
import XYChartLayout from '../utils/XYChartLayout';
import WithLegend from '../components/WithLegend';
import Encoder, { ChannelTypes, Encoding, Outputs } from './Encoder';
import { Dataset, PlainObject } from '../encodeable/types/Data';
import ChartLegend from '../components/ChartLegend';

chartTheme.gridStyles.stroke = '#f1f3f5';

const DEFAULT_MARGIN = { top: 20, right: 20, left: 20, bottom: 20 };

const defaultProps = {
  className: '',
  margin: DEFAULT_MARGIN,
  theme: chartTheme,
};

type Props = {
  className?: string;
  width: string | number;
  height: string | number;
  margin?: Margin;
  encoding: Encoding;
  data: Dataset;
  theme?: ChartTheme;
} & Readonly<typeof defaultProps>;

export interface Series {
  key: string;
  color: Outputs['color'];
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

class LineChart extends PureComponent<Props> {
  static defaultProps = defaultProps;

  constructor(props: Props) {
    super(props);

    const createEncoder = createSelector(
      (enc: Encoding) => enc,
      (enc: Encoding) => new Encoder({ encoding: enc }),
    );

    this.createEncoder = () => {
      this.encoder = createEncoder(this.props.encoding);
    };

    this.encoder = createEncoder(this.props.encoding);
    this.renderChart = this.renderChart.bind(this);
  }

  encoder: Encoder;
  private createEncoder: () => void;

  renderChart(dim: Dimension) {
    const { width, height } = dim;
    const { data, margin, theme } = this.props;

    const { channels } = this.encoder;
    const fieldNames = this.encoder.getGroupBys();

    const groups = groupBy(data, row => fieldNames.map(f => `${f}=${row[f]}`).join(','));

    const allSeries = values(groups).map(seriesData => {
      const firstDatum = seriesData[0];
      const key = fieldNames.map(f => firstDatum[f]).join(',');
      const series: Series = {
        key: key.length === 0 ? channels.y.getTitle() : key,
        color: channels.color.encode(firstDatum, '#222'),
        fill: channels.fill.encode(firstDatum, false),
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
          const gradientId = uniqueId(`gradient-${series.key}`);

          return [
            <LinearGradient
              key={`${series.key}-gradient`}
              id={gradientId}
              from={series.color}
              to="#fff"
            />,
            <AreaSeries
              key={`${series.key}-fill`}
              seriesKey={series.key}
              data={series.values}
              interpolation="linear"
              fill={`url(#${gradientId})`}
              stroke={series.color}
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
          stroke={series.color}
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
      <WithTooltip renderTooltip={createTooltip(this.encoder, allSeries)}>
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
                d.y === tooltipData.datum.y ? d.parent.color : '#fff'
              }
              circleSize={(d: SeriesValue) => (d.y === tooltipData.datum.y ? 6 : 4)}
              circleStroke={(d: SeriesValue) =>
                d.y === tooltipData.datum.y ? '#fff' : d.parent.color
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

  render() {
    const { className, data, width, height } = this.props;

    this.createEncoder();
    const renderLegend = this.encoder.hasLegend()
      ? // eslint-disable-next-line react/jsx-props-no-multi-spaces
        () => <ChartLegend<ChannelTypes, Outputs, Encoding> data={data} encoder={this.encoder} />
      : undefined;

    return (
      <WithLegend
        className={`superset-chart-line ${className}`}
        width={width}
        height={height}
        position="top"
        renderLegend={renderLegend}
        renderChart={this.renderChart}
      />
    );
  }
}

export default LineChart;
