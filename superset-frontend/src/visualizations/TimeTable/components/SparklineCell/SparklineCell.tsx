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
import { ReactElement, useMemo } from 'react';
import { formatNumber, formatTime, useTheme } from '@superset-ui/core';
import { GridRows } from '@visx/grid';
import { scaleLinear } from '@visx/scale';
import {
  Axis,
  LineSeries,
  Tooltip,
  XYChart,
  buildChartTheme,
} from '@visx/xychart';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import {
  getSparklineTextWidth,
  createYScaleConfig,
  transformChartData,
} from '../../utils';

interface Entry {
  time: string;
  [key: string]: any;
}

interface SparklineCellProps {
  ariaLabel: string;
  dataKey: string;
  className?: string;
  data: Array<number | null>;
  entries: Entry[];
  height?: number;
  numberFormat?: string;
  dateFormat?: string;
  showYAxis?: boolean;
  width?: number;
  yAxisBounds?: [number | undefined, number | undefined];
}

const MARGIN = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
} as const;

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
}: SparklineCellProps): ReactElement => {
  const theme = useTheme();

  const xyTheme = useMemo(
    () =>
      buildChartTheme({
        backgroundColor: `${theme.colorBgContainer}`,
        colors: [`${theme.colorText}`],
        gridColor: `${theme.colorSplit}`,
        gridColorDark: `${theme.colorBorder}`,
        tickLength: 6,
      }),
    [theme],
  );

  const validData = useMemo(
    () => data.filter((value): value is number => value !== null),
    [data],
  );

  const chartData = useMemo(() => transformChartData(data), [data]);

  const { yScaleConfig, min, max } = useMemo(
    () => createYScaleConfig(validData, yAxisBounds),
    [validData, yAxisBounds],
  );

  const { margin } = useMemo(() => {
    if (!showYAxis)
      return {
        margin: MARGIN,
        minLabel: '',
        maxLabel: '',
      };

    const minLbl = formatNumber(numberFormat, min);
    const maxLbl = formatNumber(numberFormat, max);
    const labelLength = Math.max(
      getSparklineTextWidth(minLbl),
      getSparklineTextWidth(maxLbl),
    );

    return {
      margin: {
        ...MARGIN,
        right: MARGIN.right + labelLength,
      },
      minLabel: minLbl,
      maxLabel: maxLbl,
    };
  }, [showYAxis, numberFormat, min, max]);

  const innerWidth = width - margin.left - margin.right;
  const xAccessor = (d: { x: number; y: number }) => d.x;
  const yAccessor = (d: { x: number; y: number }) => d.y;

  if (validData.length === 0) return <div style={{ width, height }} />;

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
          <>
            <Axis
              hideAxisLine
              hideTicks
              numTicks={2}
              orientation="right"
              tickFormat={(value: number) => formatNumber(numberFormat, value)}
              tickValues={[min, max]}
            />
            <GridRows
              left={margin.left}
              scale={scaleLinear({
                range: [height - margin.top, margin.bottom],
                domain: [min, max],
              })}
              width={innerWidth}
              strokeDasharray="3 3"
              stroke={theme.colorSplit}
              tickValues={[min, max]}
            />
          </>
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
            stroke: theme.colorText,
            strokeDasharray: '3 3',
            strokeWidth: 1,
          }}
          renderTooltip={({ tooltipData }) => {
            const idx = tooltipData?.datumByKey[dataKey]?.index;

            if (idx === undefined || !entries[idx]) {
              return null;
            }

            const value = data[idx] ?? 0;
            const timeValue = entries[idx]?.time;

            return (
              <div
                css={() => ({
                  color: theme.colorText,
                  padding: '8px',
                })}
              >
                <strong
                  css={() => ({
                    color: theme.colorText,
                    display: 'block',
                    marginBottom: '4px',
                  })}
                >
                  {formatNumber(numberFormat, value)}
                </strong>
                {timeValue && (
                  <div
                    css={() => ({
                      color: theme.colorTextSecondary,
                      fontSize: '12px',
                    })}
                  >
                    {formatTime(
                      dateFormat,
                      extendedDayjs.utc(timeValue).toDate(),
                    )}
                  </div>
                )}
              </div>
            );
          }}
        />
      </XYChart>
      <style>
        {`
          svg:not(:root) {
            overflow: visible;
          }
        `}
      </style>
    </>
  );
};

export default SparklineCell;
