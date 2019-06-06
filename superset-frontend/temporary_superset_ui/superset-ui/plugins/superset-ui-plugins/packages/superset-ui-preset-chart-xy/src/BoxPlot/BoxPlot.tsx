/* eslint-disable sort-keys, no-magic-numbers, complexity */

import React from 'react';
import { BoxPlotSeries, XYChart } from '@data-ui/xy-chart';
import { chartTheme, ChartTheme } from '@data-ui/theme';
import { Margin, Dimension } from '@superset-ui/dimension';
import { WithLegend } from '@superset-ui/chart-composition';
import DefaultTooltipRenderer from './DefaultTooltipRenderer';
import Encoder, { Encoding } from './Encoder';
import { Dataset, PlainObject } from '../encodeable/types/Data';
import { PartialSpec } from '../encodeable/types/Specification';
import createMarginSelector, { DEFAULT_MARGIN } from '../utils/selectors/createMarginSelector';
import { BoxPlotDataRow } from './types';
import convertScaleToDataUIScale from '../utils/convertScaleToDataUIScaleShape';
import createXYChartLayoutWithTheme from '../utils/createXYChartLayoutWithTheme';
import createEncoderSelector from '../encodeable/createEncoderSelector';
import createRenderLegend from '../components/legend/createRenderLegend';
import { LegendHooks } from '../components/legend/types';

export interface TooltipProps {
  datum: BoxPlotDataRow;
  color: string;
  encoder: Encoder;
}

const defaultProps = {
  className: '',
  margin: DEFAULT_MARGIN,
  theme: chartTheme,
  TooltipRenderer: DefaultTooltipRenderer,
} as const;

export type HookProps = {
  TooltipRenderer?: React.ComponentType<TooltipProps>;
} & LegendHooks<Encoder>;

type Props = {
  className?: string;
  width: string | number;
  height: string | number;
  margin?: Margin;
  data: Dataset;
  theme?: ChartTheme;
} & PartialSpec<Encoding> &
  HookProps &
  Readonly<typeof defaultProps>;

export default class BoxPlot extends React.PureComponent<Props> {
  static defaultProps = defaultProps;

  private createEncoder = createEncoderSelector(Encoder);

  private createMargin = createMarginSelector();

  constructor(props: Props) {
    super(props);

    this.renderChart = this.renderChart.bind(this);
  }

  renderChart(dim: Dimension) {
    const { width, height } = dim;
    const { data, margin, theme, TooltipRenderer } = this.props;
    const encoder = this.createEncoder(this.props);
    const { channels } = encoder;

    const isHorizontal = channels.y.definition.type === 'nominal';

    if (typeof channels.x.scale !== 'undefined') {
      const xDomain = channels.x.getDomain(data);
      channels.x.scale.setDomain(xDomain);
    }
    if (typeof channels.y.scale !== 'undefined') {
      const yDomain = channels.y.getDomain(data);
      channels.y.scale.setDomain(yDomain);
    }

    const layout = createXYChartLayoutWithTheme({
      width,
      height,
      margin: this.createMargin(margin),
      theme,
      xEncoder: channels.x,
      yEncoder: channels.y,
    });

    return layout.renderChartWithFrame((chartDim: Dimension) => (
      <XYChart
        width={chartDim.width}
        height={chartDim.height}
        ariaLabel="BoxPlot"
        margin={layout.margin}
        renderTooltip={({ datum, color }: { datum: BoxPlotDataRow; color: string }) => (
          <TooltipRenderer datum={datum} color={color} encoder={encoder} />
        )}
        showYGrid
        theme={theme}
        xScale={convertScaleToDataUIScale(channels.x.scale!.config)}
        yScale={convertScaleToDataUIScale(channels.y.scale!.config)}
      >
        {layout.renderXAxis()}
        {layout.renderYAxis()}
        <BoxPlotSeries
          key={channels.x.definition.field}
          animated
          data={
            isHorizontal
              ? data.map(row => ({ ...row, y: channels.y.get(row) }))
              : data.map(row => ({ ...row, x: channels.x.get(row) }))
          }
          fill={(datum: PlainObject) => channels.color.encode(datum, '#55acee')}
          fillOpacity={0.4}
          stroke={(datum: PlainObject) => channels.color.encode(datum)}
          strokeWidth={1}
          widthRatio={0.6}
          horizontal={channels.y.definition.type === 'nominal'}
        />
      </XYChart>
    ));
  }

  render() {
    const { className, data, width, height } = this.props;

    const encoder = this.createEncoder(this.props);

    return (
      <WithLegend
        className={`superset-chart-box-plot ${className}`}
        width={width}
        height={height}
        position="top"
        renderLegend={createRenderLegend(encoder, data, this.props)}
        renderChart={this.renderChart}
      />
    );
  }
}
