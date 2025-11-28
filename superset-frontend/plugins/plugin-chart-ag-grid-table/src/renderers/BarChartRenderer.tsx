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
import { ChartConfig, InputColumn } from '../types';
import { parseArrayValue } from '../utils/formatValue';
import {
  getSparklineTextWidth,
  createYScaleConfig,
} from '../../../../src/visualizations/TimeTable/utils';

//const dummyData = [150, 152, 155, 153, null, 'hehexd', 162, 165, 163, 168, 170, 172, 175, 173, 178, 180, 182, 185, 183, 188, 190, 192, 195, 193, 198, 200, 202, 205, 203, 208];

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
  const { value, col } = params;
  const theme = useTheme();

  if (!Array.isArray(value)) {
    return <CellContainer>N/A</CellContainer>;
  }

  // 1. Get Configuration and Set Defaults
  const chartConfig: ChartConfig = col?.config?.chartConfig || {};
  const {
    width = 300,
    height = 50,
    color,
    showValues = false,
  } = chartConfig;

  const dataKey = col?.metricName || col?.key || 'value';
  const ariaLabel = `Bar chart for ${col?.label || dataKey}`;
  const numberFormat = '.2f';

  const validData = useMemo(
    () => parseArrayValue(value),
    [value],
  );

  const chartData = useMemo(() => transformBarChartData(validData), [validData]);

  const { yScaleConfig, min, max } = useMemo(
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
  const finalSeriesColor = color || theme.colorText;

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
            ...yScaleConfig,
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
                tickFormat={(value: number) => formatNumber(numberFormat, value)}
                tickValues={[min, max]}
              />
              <GridRows
                left={margin.left}
                scale={scaleLinear({
                  range: [height - margin.top - margin.bottom, 0],
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
            xAccessor={(d) => (d as VisxData).x}
            yAccessor={(d) => (d as VisxData).y}
            colorAccessor={() => color}
          />
        </XYChart>
      </div>
    </CellContainer>
  );
};