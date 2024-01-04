/* eslint-disable class-methods-use-this */
/**
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
import moment from 'moment';
import {
  formatNumber,
  formatTime,
  getTextDimension,
  useTheme,
} from '@superset-ui/core';
import { GridRows } from '@visx/grid';
import { LinearScaleConfig, scaleLinear } from '@visx/scale';
import { AxisScaleOutput } from '@visx/axis';
import {
  Axis,
  LineSeries,
  Tooltip,
  XYChart,
  buildChartTheme,
} from '@visx/xychart';

interface Props {
  ariaLabel: string;
  dataKey: string;
  className?: string;
  data: Array<number>;
  entries: Array<any>;
  height: number;
  numberFormat: string;
  dateFormat: string;
  renderTooltip: ({ index }: { index: number }) => React.ReactNode;
  showYAxis: boolean;
  width: number;
  yAxisBounds: Array<number | undefined>;
}

const MARGIN = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
};

function getSparklineTextWidth(text: string) {
  return (
    getTextDimension({
      text,
      style: {
        fontSize: '12px',
        fontWeight: 200,
        letterSpacing: 0.4,
      },
    }).width + 5
  );
}

function isValidBoundValue(value?: number | string) {
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    !Number.isNaN(value)
  );
}

const SparklineCell = ({
  ariaLabel,
  dataKey,
  data,
  width = 300,
  height = 50,
  numberFormat = '',
  dateFormat = '',
  yAxisBounds = [undefined, undefined],
  showYAxis = false,
  entries = [],
}: Props) => {
  const theme = useTheme();
  const xyTheme = buildChartTheme({
    backgroundColor: `${theme.colors.grayscale.light5}`,
    colors: [`${theme.colors.grayscale.base}`],
    gridColor: `${theme.colors.grayscale.light1}`,
    gridColorDark: `${theme.colors.grayscale.base}`,
    tickLength: 6,
  });

  const yScaleConfig: LinearScaleConfig<AxisScaleOutput> = {
    type: 'linear',
    zero: false,
  };
  let hasMinBound = false;
  let hasMaxBound = false;
  let min: number = data.reduce(
    (acc, current) => Math.min(acc, current),
    data[0],
  );
  let max: number = data.reduce(
    (acc, current) => Math.max(acc, current),
    data[0],
  );

  if (yAxisBounds) {
    const [minBound, maxBound] = yAxisBounds;
    hasMinBound = isValidBoundValue(minBound);
    if (hasMinBound) {
      if (minBound !== undefined && minBound <= 0) {
        yScaleConfig.zero = true;
      }
      min = minBound || min;
    }

    hasMaxBound = isValidBoundValue(maxBound);
    if (hasMaxBound) {
      max = maxBound || max;
    }
    yScaleConfig.domain = [min, max];
  }

  let minLabel: string;
  let maxLabel: string;
  let labelLength = 0;
  if (showYAxis) {
    yScaleConfig.domain = [min, max];
    minLabel = formatNumber(numberFormat, min);
    maxLabel = formatNumber(numberFormat, max);
    labelLength = Math.max(
      getSparklineTextWidth(minLabel),
      getSparklineTextWidth(maxLabel),
    );
  }

  const margin = {
    ...MARGIN,
    right: MARGIN.right + labelLength,
  };
  const innerWidth = width - margin.left - margin.right;
  const chartData = data.map((num, idx) => ({
    x: idx,
    y: num,
  }));

  const xAccessor = (d: any) => d.x;
  const yAccessor = (d: any) => d.y;

  return (
    <>
      <XYChart
        accessibilityLabel={ariaLabel}
        width={width}
        height={height}
        margin={margin}
        yScale={{
          ...yScaleConfig,
        }}
        xScale={{ type: 'band', paddingInner: 0.5 }}
        theme={xyTheme}
      >
        {showYAxis && (
          <Axis
            hideAxisLine
            hideTicks
            numTicks={2}
            orientation="right"
            tickFormat={(d: any) => formatNumber(numberFormat, d)}
            tickValues={[min, max]}
          />
        )}
        {showYAxis && min !== undefined && max !== undefined && (
          <GridRows
            left={margin.left}
            scale={scaleLinear({
              range: [height - margin.top, margin.bottom],
              domain: [min, max],
            })}
            width={innerWidth}
            strokeDasharray="3 3"
            stroke={`${theme.colors.grayscale.light1}`}
            tickValues={[min, max]}
          />
        )}
        <LineSeries
          data={chartData}
          dataKey={dataKey}
          xAccessor={xAccessor}
          yAccessor={yAccessor}
        />
        <Tooltip
          glyphStyle={{ strokeWidth: 1 }}
          showDatumGlyph
          showVerticalCrosshair
          snapTooltipToDatumX
          snapTooltipToDatumY
          verticalCrosshairStyle={{
            stroke: `${theme.colors.grayscale.dark1}`,
            strokeDasharray: '3 3',
            strokeWidth: 1,
          }}
          renderTooltip={({ tooltipData }) => {
            const idx = tooltipData?.datumByKey[dataKey].index;
            return (
              <div>
                <strong>
                  {idx !== undefined && formatNumber(numberFormat, data[idx])}
                </strong>
                <div>
                  {idx !== undefined &&
                    formatTime(
                      dateFormat,
                      moment.utc(entries[idx].time).toDate(),
                    )}
                </div>
              </div>
            );
          }}
        />
      </XYChart>
      <style>
        {`svg:not(:root) {
            overflow: visible;
          }`}
      </style>
    </>
  );
};

export default SparklineCell;
