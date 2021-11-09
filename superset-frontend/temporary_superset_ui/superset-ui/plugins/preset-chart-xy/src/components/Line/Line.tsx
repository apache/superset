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
import { WithLegend, Margin, Dimension } from '@superset-ui/core';
import { createSelector } from 'reselect';
import { Dataset, PlainObject } from 'encodable';
import DefaultTooltipRenderer from './DefaultTooltipRenderer';
import createMarginSelector, {
  DEFAULT_MARGIN,
} from '../../utils/createMarginSelector';
import convertScaleToDataUIScale from '../../utils/convertScaleToDataUIScaleShape';
import createXYChartLayoutWithTheme from '../../utils/createXYChartLayoutWithTheme';
import createRenderLegend from '../legend/createRenderLegend';
import { LegendHooks } from '../legend/types';
import {
  lineEncoderFactory,
  LineEncoder,
  LineEncoding,
  LineEncodingConfig,
  LineChannelOutputs,
} from './Encoder';
import DefaultLegendItemMarkRenderer from './DefaultLegendItemMarkRenderer';

export interface TooltipProps {
  encoder: LineEncoder;
  allSeries: Series[];
  datum: SeriesValue;
  series: {
    [key: string]: SeriesValue;
  };
  theme: typeof chartTheme;
}

const defaultProps = {
  className: '',
  encoding: {},
  LegendItemMarkRenderer: DefaultLegendItemMarkRenderer,
  margin: DEFAULT_MARGIN,
  theme: chartTheme,
  TooltipRenderer: DefaultTooltipRenderer,
};

/** Part of formData that is needed for rendering logic in this file */
export type FormDataProps = {
  margin?: Margin;
  theme?: typeof chartTheme;
  encoding?: Partial<LineEncoding>;
};

export type HookProps = {
  TooltipRenderer?: React.ComponentType<TooltipProps>;
} & LegendHooks<LineEncodingConfig>;

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
  fill: LineChannelOutputs['fill'];
  stroke: LineChannelOutputs['stroke'];
  strokeDasharray: LineChannelOutputs['strokeDasharray'];
  strokeWidth: LineChannelOutputs['strokeWidth'];
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
  private createEncoder = lineEncoderFactory.createSelector();

  private createAllSeries = createSelector(
    (input: { encoder: LineEncoder; data: Dataset }) => input.encoder,
    input => input.data,
    (encoder, data) => {
      const { channels } = encoder;
      const fieldNames = encoder.getGroupBys();

      const groups = groupBy(data, row =>
        fieldNames.map(f => `${f}=${row[f]}`).join(','),
      );

      const allSeries = values(groups).map(seriesData => {
        const firstDatum = seriesData[0];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const key = fieldNames.map(f => firstDatum[f]).join(',');
        const series: Series = {
          key: key.length === 0 ? channels.y.getTitle() : key,
          fill: channels.fill.encodeDatum(firstDatum, false),
          stroke: channels.stroke.encodeDatum(firstDatum, '#222'),
          strokeDasharray: channels.strokeDasharray.encodeDatum(firstDatum, ''),
          strokeWidth: channels.strokeWidth.encodeDatum(firstDatum, 1),
          values: [],
        };

        series.values = seriesData
          .map(v => ({
            x: channels.x.getValueFromDatum<Date | number>(v),
            y: channels.y.getValueFromDatum<number>(v),
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

      return allSeries;
    },
  );

  private createMargin = createMarginSelector();

  static defaultProps = defaultProps;

  // eslint-disable-next-line class-methods-use-this
  renderSeries(allSeries: Series[]) {
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
              strokeWidth={series.strokeWidth}
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
          strokeWidth={series.strokeWidth}
        />
      ));

    return filledSeries.concat(unfilledSeries);
  }

  renderChart = (dim: Dimension) => {
    const { width, height } = dim;
    const { data, margin, theme, TooltipRenderer, encoding } = this.props;

    const encoder = this.createEncoder(encoding);
    const { channels } = encoder;

    encoder.setDomainFromDataset(data);

    const allSeries = this.createAllSeries({ encoder, data });

    const layout = createXYChartLayoutWithTheme({
      width,
      height,
      margin: this.createMargin(margin),
      theme,
      xEncoder: channels.x,
      yEncoder: channels.y,
    });

    return layout.renderChartWithFrame((chartDim: Dimension) => (
      <WithTooltip
        renderTooltip={({
          datum,
          series,
        }: {
          datum: SeriesValue;
          series: {
            [key: string]: SeriesValue;
          };
        }) => (
          <TooltipRenderer
            encoder={encoder}
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
          onMouseLeave: (...args: unknown[]) => void;
          onMouseMove: (...args: unknown[]) => void;
          tooltipData: { datum: { y?: number } };
        }) => (
          <XYChart
            showYGrid
            snapTooltipToDataX
            width={chartDim.width}
            height={chartDim.height}
            ariaLabel="LineChart"
            eventTrigger="container"
            margin={layout.margin}
            renderTooltip={null}
            theme={theme}
            tooltipData={tooltipData}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            xScale={convertScaleToDataUIScale(
              channels.x.definition.scale as any,
            )}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            yScale={convertScaleToDataUIScale(
              channels.y.definition.scale as any,
            )}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
          >
            {layout.renderXAxis()}
            {layout.renderYAxis()}
            {this.renderSeries(allSeries)}
            <CrossHair
              fullHeight
              showCircle
              showMultipleCircles
              strokeDasharray=""
              showHorizontalLine={false}
              circleFill={(d: SeriesValue) =>
                d.y === tooltipData.datum.y ? d.parent.stroke : '#fff'
              }
              circleSize={(d: SeriesValue) =>
                d.y === tooltipData.datum.y ? 6 : 4
              }
              circleStroke={(d: SeriesValue) =>
                d.y === tooltipData.datum.y ? '#fff' : d.parent.stroke
              }
              circleStyles={CIRCLE_STYLE}
              stroke="#ccc"
            />
          </XYChart>
        )}
      </WithTooltip>
    ));
  };

  render() {
    const { className, data, width, height, encoding } = this.props;

    return (
      <WithLegend
        className={`superset-chart-line ${className}`}
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
