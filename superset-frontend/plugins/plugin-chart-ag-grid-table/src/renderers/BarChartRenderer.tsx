/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useMemo } from 'react';
import { styled, useTheme } from '@apache-superset/core/ui';
import { formatNumber } from '@superset-ui/core';
import { CustomCellRendererProps } from '@superset-ui/core/components/ThemedAgGridReact';
import { XYChart, BarSeries, buildChartTheme, Axis } from '@visx/xychart';
import { GridRows } from '@visx/grid';
import { scaleLinear } from '@visx/scale';
import { InputColumn } from '../types';
import { parseArrayValue } from '../utils/formatValue';
import {
  getSparklineTextWidth,
  createYScaleConfig,
} from '../utils/sparklineHelpers';
import { rgbToHex } from '../utils/chartRenderers';

interface VisxData {
  x: number;
  y: number;
}

function transformBarChartData(dataArray: Array<number | null>): VisxData[] {
  return dataArray
    .filter((value): value is number => value !== null)
    .map((y, x) => ({ x, y }));
}

const CellContainer = styled.div<{ align?: string }>`
  display: flex;
  align-items: center;
  justify-content: ${({ align }) => align || 'left'};
  width: 100%;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
`;

const MARGIN = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
} as const;

export const BarChartRenderer = (
  params: CustomCellRendererProps & {
    col: InputColumn;
  },
) => {
  const { data, col } = params;
  const value = parseArrayValue(data);
  const theme = useTheme();

  if (!Array.isArray(value)) {
    return <CellContainer>N/A</CellContainer>;
  }

  // Chart configuration is now processed in transformProps with proper defaults
  const chartConfig = col?.config || {};
  const {
    width = 300, // Default from transformProps
    height = 60, // Default from transformProps
    color,
    showValues = true, // Default from transformProps
  } = chartConfig;

  const dataKey = col?.metricName || col?.key || 'value';
  const ariaLabel = `Bar chart for ${col?.label || dataKey}`;
  const numberFormat = '.2f';

  const validData = useMemo(() => parseArrayValue(value), [value]);

  const chartData = useMemo(
    () => transformBarChartData(validData),
    [validData],
  );

  const { min, max } = useMemo(
    () => createYScaleConfig(validData, [undefined, undefined]),
    [validData],
  );

  const { margin } = useMemo(() => {
    if (!showValues)
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
  }, [showValues, numberFormat, min, max]);

  const innerWidth = width - margin.left - margin.right;
  const finalSeriesColor = (typeof color === 'object') ? rgbToHex(color) : color || theme.colorText;

  const xyTheme = useMemo(
    () =>
      buildChartTheme({
        backgroundColor: 'transparent',
        colors: [`${finalSeriesColor}`],
        gridColor: theme.colorSplit,
        gridColorDark: theme.colorBorder,
        tickLength: 6,
      }),
    [finalSeriesColor, theme],
  );

  return (
    <CellContainer align={'left'}>
      <div style={{ width, height, overflow: 'hidden' }}>
        <XYChart
          accessibilityLabel={ariaLabel}
          width={width}
          height={height}
          margin={margin}
          xScale={{
            type: 'band',
            paddingInner: 0.5,
            paddingOuter: 0.1,
          }}
          yScale={{
            type: 'linear',
            domain: [min, max],
            // Don't set range - let XYChart handle it
          }}
          theme={xyTheme}
        >
          {showValues && (
            <>
              <Axis
                hideAxisLine
                hideTicks
                numTicks={2}
                orientation="right"
                tickFormat={(value: number) =>
                  formatNumber(numberFormat, value)
                }
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
          <BarSeries
            dataKey={dataKey}
            data={chartData}
            xAccessor={d => (d as VisxData).x}
            yAccessor={d => (d as VisxData).y}
            colorAccessor={() => finalSeriesColor}
          />
        </XYChart>
      </div>
    </CellContainer>
  );
};
