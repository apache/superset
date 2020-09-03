import React, { PureComponent } from 'react';
import { XYChart, PointSeries } from '@data-ui/xy-chart';
import { chartTheme, ChartTheme } from '@data-ui/theme';
import { WithLegend, Margin, Dimension } from '@superset-ui/core';
import { isFieldDef, Dataset, PlainObject } from 'encodable';

import {
  scatterPlotEncoderFactory,
  ScatterPlotEncoder,
  ScatterPlotEncodingConfig,
  ScatterPlotEncoding,
} from './Encoder';
import createMarginSelector, { DEFAULT_MARGIN } from '../../utils/createMarginSelector';
import DefaultTooltipRenderer from './DefaultTooltipRenderer';
import convertScaleToDataUIScale from '../../utils/convertScaleToDataUIScaleShape';
import createXYChartLayoutWithTheme from '../../utils/createXYChartLayoutWithTheme';
import createRenderLegend from '../legend/createRenderLegend';
import { LegendHooks } from '../legend/types';

export interface TooltipProps {
  datum: PlainObject;
  encoder: ScatterPlotEncoder;
}

const defaultProps = {
  className: '',
  margin: DEFAULT_MARGIN,
  encoding: {},
  theme: chartTheme,
  TooltipRenderer: DefaultTooltipRenderer,
} as const;

export type HookProps = {
  TooltipRenderer?: React.ComponentType<TooltipProps>;
} & LegendHooks<ScatterPlotEncodingConfig>;

type Props = {
  className?: string;
  width: string | number;
  height: string | number;
  margin?: Margin;
  data: Dataset;
  encoding?: Partial<ScatterPlotEncoding>;
  theme?: ChartTheme;
} & HookProps &
  Readonly<typeof defaultProps>;

export default class ScatterPlot extends PureComponent<Props> {
  private createEncoder = scatterPlotEncoderFactory.createSelector();

  private createMargin = createMarginSelector();

  static defaultProps = defaultProps;

  renderChart = (dim: Dimension) => {
    const { width, height } = dim;
    const { data, margin, theme, TooltipRenderer, encoding } = this.props;
    const encoder = this.createEncoder(encoding);
    const { channels } = encoder;

    encoder.setDomainFromDataset(data);

    const encodedData = data.map(d => ({
      x: channels.x.getValueFromDatum(d),
      y: channels.y.getValueFromDatum(d),
      ...d,
    }));

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
        showYGrid
        width={chartDim.width}
        height={chartDim.height}
        ariaLabel="ScatterPlot"
        margin={layout.margin}
        renderTooltip={({ datum }: { datum: PlainObject }) => (
          <TooltipRenderer datum={datum} encoder={encoder} />
        )}
        theme={theme}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        xScale={convertScaleToDataUIScale(channels.x.definition.scale as any)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yScale={convertScaleToDataUIScale(channels.y.definition.scale as any)}
      >
        {layout.renderXAxis()}
        {layout.renderYAxis()}
        <PointSeries
          key={isFieldDef(channels.x.definition) ? channels.x.definition.field : ''}
          data={encodedData}
          fill={(d: PlainObject) => channels.fill.encodeDatum(d)}
          fillOpacity={0.5}
          stroke={(d: PlainObject) => channels.stroke.encodeDatum(d)}
          size={(d: PlainObject) => channels.size.encodeDatum(d)}
        />
      </XYChart>
    ));
  };

  render() {
    const { className, data, width, height, encoding } = this.props;

    return (
      <WithLegend
        className={`superset-chart-scatter-plot ${className}`}
        width={width}
        height={height}
        position="top"
        renderLegend={createRenderLegend(this.createEncoder(encoding), data, this.props)}
        renderChart={this.renderChart}
      />
    );
  }
}
