/* eslint-disable sort-keys, no-magic-numbers, complexity */
import React from 'react';
import { BoxPlotSeries, XYChart } from '@data-ui/xy-chart';
import { chartTheme, ChartTheme } from '@data-ui/theme';
import { Margin, Dimension } from '@superset-ui/dimension';
import { WithLegend } from '@superset-ui/chart-composition';
import { createSelector } from 'reselect';
import createTooltip from './createTooltip';
import ChartLegend from '../components/legend/ChartLegend';
import Encoder, { ChannelTypes, Encoding, Outputs } from './Encoder';
import { Dataset, PlainObject } from '../encodeable/types/Data';
import { PartialSpec } from '../encodeable/types/Specification';
import createMarginSelector, { DEFAULT_MARGIN } from '../utils/selectors/createMarginSelector';
import createXYChartLayoutSelector from '../utils/selectors/createXYChartLayoutSelector';

const defaultProps = {
  className: '',
  margin: DEFAULT_MARGIN,
  theme: chartTheme,
} as const;

type Props = {
  className?: string;
  width: string | number;
  height: string | number;
  margin?: Margin;
  data: Dataset;
  theme?: ChartTheme;
} & PartialSpec<Encoding> &
  Readonly<typeof defaultProps>;

export default class BoxPlot extends React.PureComponent<Props> {
  static defaultProps = defaultProps;

  encoder: Encoder;
  private createEncoder: () => void;

  private createMargin = createMarginSelector();

  private createXYChartLayout = createXYChartLayoutSelector();

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
    this.renderChart = this.renderChart.bind(this);
  }

  renderChart(dim: Dimension) {
    const { width, height } = dim;
    const { data, margin, theme } = this.props;
    const { channels } = this.encoder;

    const isHorizontal = channels.y.definition.type === 'nominal';

    const children = [
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
      />,
    ];

    const layout = this.createXYChartLayout({
      width,
      height,
      margin: this.createMargin(margin),
      theme,
      xEncoder: channels.x,
      yEncoder: channels.y,
      children,
    });

    return layout.renderChartWithFrame((chartDim: Dimension) => (
      <XYChart
        width={chartDim.width}
        height={chartDim.height}
        ariaLabel="BoxPlot"
        margin={layout.margin}
        renderTooltip={createTooltip(this.encoder)}
        showYGrid
        theme={theme}
        xScale={channels.x.definition.scale}
        yScale={channels.y.definition.scale}
      >
        {children}
        {layout.renderXAxis()}
        {layout.renderYAxis()}
      </XYChart>
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
        className={`superset-chart-box-plot ${className}`}
        width={width}
        height={height}
        position="top"
        renderLegend={renderLegend}
        renderChart={this.renderChart}
      />
    );
  }
}
