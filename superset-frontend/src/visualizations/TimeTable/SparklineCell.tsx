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
  css,
  formatNumber,
  formatTime,
  getTextDimension,
  useTheme,
} from '@superset-ui/core';
import {
  Sparkline,
  LineSeries,
  PointSeries,
  HorizontalReferenceLine,
  VerticalReferenceLine,
  WithTooltip,
} from '@data-ui/sparkline';
import { GridRows } from '@visx/grid';
import { scaleLinear } from '@visx/scale';
import {
  Axis,
  LineSeries as NewLineSeries,
  Tooltip,
  XYChart,
  buildChartTheme,
} from '@visx/xychart';

interface Props {
  ariaLabel: string;
  className?: string;
  data: Array<number>;
  entries: Array<any>;
  height: number;
  numberFormat?: string;
  dateFormat?: string;
  renderTooltip: ({ index }: { index: number }) => React.ReactNode;
  showYAxis: boolean;
  width: number;
  yAxisBounds: Array<number | undefined>;
}

interface TooltipProps {
  onMouseLeave: () => void;
  onMouseMove: () => void;
  tooltipData: {
    index: number;
  };
}

interface Yscale {
  min?: number;
  max?: number;
}

const MARGIN = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
};
const tooltipProps = {
  style: {
    opacity: 0.8,
  },
  offsetTop: 0,
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
  data,
  width = 300,
  height = 50,
  numberFormat = '',
  dateFormat = '',
  yAxisBounds = [undefined, undefined],
  showYAxis = false,
  entries = [],
  renderTooltip = () => <div />,
}: Props) => {
  const theme = useTheme();
  const xyTheme = buildChartTheme({
    backgroundColor: `${theme.colors.grayscale.light5}`,
    colors: [`${theme.colors.grayscale.base}`],
    gridColor: `${theme.colors.grayscale.light1}`,
    gridColorDark: `${theme.colors.grayscale.base}`,
    tickLength: 6,
  });

  function renderHorizontalReferenceLine(value?: number, label?: string) {
    return (
      <HorizontalReferenceLine
        reference={value}
        labelPosition="right"
        renderLabel={() => label}
        stroke="#bbb"
        strokeDasharray="3 3"
        strokeWidth={1}
      />
    );
  }

  const yScale: Yscale = {};
  let hasMinBound = false;
  let hasMaxBound = false;

  if (yAxisBounds) {
    const [minBound, maxBound] = yAxisBounds;
    hasMinBound = isValidBoundValue(minBound);
    if (hasMinBound) {
      yScale.min = minBound;
    }
    hasMaxBound = isValidBoundValue(maxBound);
    if (hasMaxBound) {
      yScale.max = maxBound;
    }
  }

  let min: number | undefined;
  let max: number | undefined;
  let minLabel: string;
  let maxLabel: string;
  let labelLength = 0;
  if (showYAxis) {
    const [minBound, maxBound] = yAxisBounds;
    min = hasMinBound
      ? minBound
      : data.reduce((acc, current) => Math.min(acc, current), data[0]);
    max = hasMaxBound
      ? maxBound
      : data.reduce((acc, current) => Math.max(acc, current), data[0]);

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

  const newData = data.map((num, idx) => ({
    x: idx,
    y: num,
  }));

  const xAccessor = (d: any) => d.x;
  const yAccessor = (d: any) => d.y;

  return (
    <>
      <WithTooltip
        tooltipProps={tooltipProps}
        hoverStyles={null}
        renderTooltip={renderTooltip}
      >
        {({ onMouseLeave, onMouseMove, tooltipData }: TooltipProps) => (
          <Sparkline
            ariaLabel={ariaLabel}
            width={width}
            height={height}
            margin={margin}
            data={data}
            onMouseLeave={onMouseLeave}
            onMouseMove={onMouseMove}
            {...yScale}
          >
            {showYAxis && renderHorizontalReferenceLine(min, minLabel)}
            {showYAxis && renderHorizontalReferenceLine(max, maxLabel)}
            <LineSeries showArea={false} stroke="#767676" />
            {tooltipData && (
              <VerticalReferenceLine
                reference={tooltipData.index}
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}
            {tooltipData && (
              <PointSeries
                points={[tooltipData.index]}
                fill="#767676"
                strokeWidth={1}
              />
            )}
          </Sparkline>
        )}
      </WithTooltip>

      <XYChart
        width={width}
        height={height}
        margin={margin}
        yScale={{ type: 'linear', zero: false }}
        xScale={{ type: 'band', paddingInner: 0.5 }}
        theme={xyTheme}
        css={css`
          svg:not(:root) {
            overflow: visible;
          }
        `}
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
        {showYAxis && min && max && (
          <GridRows
            left={margin.left}
            scale={scaleLinear({
              range: [height - margin.top, margin.bottom],
              domain: [min, max],
            })}
            width={width - margin.right - 7}
            strokeDasharray="3 3"
            stroke={`${theme.colors.grayscale.light1}`}
            tickValues={[min, max]}
          />
        )}
        <NewLineSeries
          data={newData}
          dataKey={ariaLabel}
          xAccessor={xAccessor}
          yAccessor={yAccessor}
        />
        <Tooltip
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
            const idx = tooltipData?.datumByKey[ariaLabel].index;
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
