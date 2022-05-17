/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React from 'react';
import { BoxPlotSeries, XYChart } from '@data-ui/xy-chart';
import { chartTheme, ChartTheme } from '@data-ui/theme';
import { WithLegend, Margin, Dimension } from '@superset-ui/core';
import { Dataset, PlainObject, isFieldDef } from 'encodable';
import DefaultTooltipRenderer from './DefaultTooltipRenderer';
import {
  BoxPlotEncodingConfig,
  BoxPlotEncoding,
  BoxPlotEncoder,
  boxPlotEncoderFactory,
} from './Encoder';
import createMarginSelector, {
  DEFAULT_MARGIN,
} from '../../utils/createMarginSelector';
import { BoxPlotDataRow } from './types';
import convertScaleToDataUIScale from '../../utils/convertScaleToDataUIScaleShape';
import createXYChartLayoutWithTheme from '../../utils/createXYChartLayoutWithTheme';
import createRenderLegend from '../legend/createRenderLegend';
import { LegendHooks } from '../legend/types';

export interface TooltipProps {
  datum: BoxPlotDataRow;
  color: string;
  encoder: BoxPlotEncoder;
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
} & LegendHooks<BoxPlotEncodingConfig>;

type Props = {
  className?: string;
  width: string | number;
  height: string | number;
  margin?: Margin;
  encoding?: Partial<BoxPlotEncoding>;
  data: Dataset;
  theme?: ChartTheme;
} & HookProps &
  Readonly<typeof defaultProps>;

export default class BoxPlot extends React.PureComponent<Props> {
  private createEncoder = boxPlotEncoderFactory(
    this.props.theme?.colors.darkGray,
  ).createSelector();

  private createMargin = createMarginSelector();

  static defaultProps = defaultProps;

  renderChart = (dim: Dimension) => {
    const { width, height } = dim;
    const { data, margin, theme, TooltipRenderer, encoding } = this.props;
    const encoder = this.createEncoder(encoding);
    const { channels } = encoder;

    const isHorizontal =
      isFieldDef(channels.y.definition) &&
      channels.y.definition.type === 'nominal';

    encoder.setDomainFromDataset(data);

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
        ariaLabel="BoxPlot"
        margin={layout.margin}
        renderTooltip={({
          datum,
          color,
        }: {
          datum: BoxPlotDataRow;
          color: string;
        }) => <TooltipRenderer datum={datum} color={color} encoder={encoder} />}
        theme={theme}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        xScale={convertScaleToDataUIScale(channels.x.definition.scale as any)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yScale={convertScaleToDataUIScale(channels.y.definition.scale as any)}
      >
        {layout.renderXAxis()}
        {layout.renderYAxis()}
        <BoxPlotSeries
          key={
            isFieldDef(channels.x.definition) ? channels.x.definition.field : ''
          }
          animated
          data={
            isHorizontal
              ? data.map(row => ({
                  ...row,
                  y: channels.y.getValueFromDatum(row),
                }))
              : data.map(row => ({
                  ...row,
                  x: channels.x.getValueFromDatum(row),
                }))
          }
          fill={(datum: PlainObject) =>
            channels.color.encodeDatum(datum, '#55acee')
          }
          fillOpacity={0.4}
          stroke={(datum: PlainObject) => channels.color.encodeDatum(datum)}
          strokeWidth={1}
          widthRatio={0.6}
          horizontal={isHorizontal}
        />
      </XYChart>
    ));
  };

  render() {
    const { className, data, encoding, width, height } = this.props;

    return (
      <WithLegend
        className={`superset-chart-box-plot ${className}`}
        width={width}
        height={height}
        position="top"
        renderLegend={createRenderLegend(
          this.createEncoder(encoding),
          data,
          this.props,
        )}
        renderChart={this.renderChart}
      />
    );
  }
}
