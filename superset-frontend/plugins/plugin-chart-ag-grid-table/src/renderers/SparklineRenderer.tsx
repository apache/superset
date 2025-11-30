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
import { styled } from '@apache-superset/core/ui';
import { CustomCellRendererProps } from '@superset-ui/core/components/ThemedAgGridReact';
import { InputColumn } from '../types';
import SparklineCell from '../components/SparklineCell';
import { parseArrayValue } from '../utils/formatValue';
import { rgbToHex } from '../utils/chartRenderers';

const CellContainer = styled.div<{ align?: string }>`
  display: flex;
  align-items: center;
  justify-content: ${({ align }) => align || 'left'};
  width: 100%;
`;

export const SparklineRenderer = (
  params: CustomCellRendererProps & {
    col: InputColumn;
  },
) => {
  const { data, col } = params;
  const value = parseArrayValue(data);

  // Chart configuration is now processed in transformProps with proper defaults
  const chartConfig = col?.config || {};
  const {
    width = 100, // Default from transformProps
    height = 60, // Default from transformProps
    color,
    strokeWidth = 1.5, // Default from transformProps
    showValues = true, // Default from transformProps
    showPoints = true, // Default from transformProps
  } = chartConfig;

  if (!Array.isArray(value)) {
    return <CellContainer>N/A</CellContainer>;
  }

  const dataKey = col?.metricName || col?.key || 'value';
  const ariaLabel = `Sparkline chart for ${col?.label || dataKey}`;
  const chartColor =
    typeof color === 'object' ? rgbToHex(color) : color || '#FFFFFF';

  return (
    <CellContainer>
      <SparklineCell
        ariaLabel={ariaLabel}
        dataKey={dataKey}
        data={value}
        entries={value.map(_ => ({ time: '' }))}
        width={width}
        height={height}
        numberFormat={'.2f'}
        dateFormat={''}
        showYAxis={showValues}
        yAxisBounds={[undefined, undefined]}
        sparkType={'line'}
        color={chartColor}
        strokeWidth={strokeWidth}
        showPoints={showPoints}
      />
    </CellContainer>
  );
};
