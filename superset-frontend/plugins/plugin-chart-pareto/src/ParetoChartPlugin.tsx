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
import { getNumberFormatter, styled } from '@superset-ui/core';
import React from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { type ParetoChartPluginProps, type ParetoChartPluginStylesProps } from './types';

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/theme/index.ts

const Styles = styled.div<ParetoChartPluginStylesProps>`
  background-color: ${({ theme }) => theme?.colors?.grayscale?.light5 || '#f5f5f5'};
  padding: ${({ theme }) => (theme?.gridUnit || 4) * 4}px;
  border-radius: ${({ theme }) => theme?.borderRadius || 4}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  display: flex;
  flex-direction: column;

  .pareto-chart-container {
    flex: 1;
    min-height: 0;
  }

  .pareto-header {
    margin-bottom: ${({ theme }) => (theme?.gridUnit || 4) * 2}px;
    font-weight: ${({ boldText }) => (boldText ? '700' : '400')};
    font-size: 16px;
    color: ${({ theme }) => theme?.colors?.grayscale?.dark1 || '#000'};
  }

  .pareto-tooltip {
    background-color: white;
    border: 1px solid #ccc;
    padding: 10px;
    border-radius: 4px;
  }

  .pareto-tooltip-label {
    margin: 0;
    font-weight: bold;
  }

  .pareto-tooltip-value {
    margin: 4px 0 0 0;
    color: #1f77b4;
  }

  .pareto-tooltip-cumulative {
    margin: 4px 0 0 0;
    color: #ff7f0e;
  }

  .pareto-empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #999;
  }
`;

/**
 * Tooltip payload interface
 */
interface TooltipPayload {
  payload: {
    category: string;
    value: number;
    cumulativePercent: number;
    cumulativeValue: number;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  formatter?: (value: number) => string;
}

/**
 * ******************* PARETO CHART *******************
 * Displays a sorted bar chart with cumulative percentage line
 * Key features:
 * - Bars sorted by value (descending)
 * - Cumulative percentage line on secondary Y-axis
 * - Optional threshold line (e.g., 80% rule)
 * - Interactive tooltips
 * - Responsive design
 */
export default function ParetoChartPlugin(props: ParetoChartPluginProps) {
  const {
    height,
    width,
    paretoData,
    barColor = '#1f77b4',
    lineColor = '#ff7f0e',
    showThresholdLine = true,
    thresholdValue = 80,
    showCumulativeLine = true,
    xAxisLabel = '',
    yAxisLabel = 'Value',
    y2AxisLabel = 'Cumulative %',
    headerText,
    yAxisFormat = '',
  } = props;

  // Create formatter function - handle both duration and d3 formats
  const formatYAxis = (value: number): string => {
    if (!yAxisFormat) {
      return String(value);
    }

    // Handle duration formats (string)
    if (yAxisFormat.startsWith('DURATION_')) {
      let seconds = value;

      // Convert to seconds based on input format
      if (yAxisFormat === 'DURATION_MS') {
        seconds = value / 1000;
      } else if (yAxisFormat === 'DURATION_M') {
        seconds = value * 60;
      } else if (yAxisFormat === 'DURATION_H') {
        seconds = value * 3600;
      }
      // DURATION_S is already in seconds

      // Convert to D H M S
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

      return parts.join(' ');
    }

    // Fall back to standard number formatting for d3 format strings
    try {
      return getNumberFormatter(yAxisFormat)(value);
    } catch {
      return String(value);
    }
  };

  // Handle empty data
  if (!paretoData || paretoData.length === 0) {
    return (
      <Styles
        boldText={props.boldText}
        headerFontSize={props.headerFontSize}
        height={height}
        width={width}
      >
        {headerText && <div className="pareto-header">{headerText}</div>}
        <div className="pareto-empty-state">No data available</div>
      </Styles>
    );
  }

  // Custom tooltip component that uses the formatter
  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (!active || !payload?.length) {
      return null;
    }

    const data = payload[0].payload;

    return (
      <div className="pareto-tooltip">
        <p className="pareto-tooltip-label">{data.category}</p>
        <p className="pareto-tooltip-value">Value: {formatYAxis(data.value)}</p>
        <p className="pareto-tooltip-cumulative">
          Cumulative: {data.cumulativePercent?.toFixed(2)}%
        </p>
      </div>
    );
  };

  return (
    <Styles
      boldText={props.boldText}
      headerFontSize={props.headerFontSize}
      height={height}
      width={width}
    >
      {headerText && <div className="pareto-header">{headerText}</div>}
      <div className="pareto-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={paretoData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            accessibilityLayer={true}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />

            {/* X-Axis for categories */}
            <XAxis
              dataKey="category"
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
              tick={{ fontSize: 12 }}
              label={
                xAxisLabel
                  ? {
                      value: xAxisLabel,
                      position: 'insideBottom',
                      offset: -10,
                    }
                  : undefined
              }
            />

            {/* Left Y-Axis for values */}
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              tickFormatter={formatYAxis}
              label={
                yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined
              }
            />

            {/* Right Y-Axis for cumulative percentage */}
            {showCumulativeLine && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                label={
                  y2AxisLabel
                    ? {
                        value: y2AxisLabel,
                        angle: 90,
                        position: 'insideRight',
                      }
                    : undefined
                }
              />
            )}

            {/* Tooltip */}
            <Tooltip content={<CustomTooltip />} />

            {/* Legend */}
            <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="line" />

            {/* Threshold reference line */}
            {showThresholdLine && showCumulativeLine && (
              <ReferenceLine
                yAxisId="right"
                y={thresholdValue}
                stroke="red"
                strokeDasharray="5 5"
                label={{
                  value: `${thresholdValue}%`,
                  position: 'right',
                  fill: 'red',
                  fontSize: 12,
                }}
              />
            )}

            {/* Bar chart for values */}
            <Bar
              yAxisId="left"
              dataKey="value"
              fill={barColor}
              name="Value"
              radius={[4, 4, 0, 0]}
            />

            {/* Line chart for cumulative percentage */}
            {showCumulativeLine && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativePercent"
                stroke={lineColor}
                strokeWidth={2}
                name="Cumulative %"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Styles>
  );
}
