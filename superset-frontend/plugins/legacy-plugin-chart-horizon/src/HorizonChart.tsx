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
import { memo, useMemo } from 'react';
import { extent as d3Extent } from 'd3-array';
import { ensureIsArray } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import HorizonRow, { DEFAULT_COLORS } from './HorizonRow';

interface DataValue {
  y: number;
}

interface DataSeries {
  key: string[];
  values: DataValue[];
}

interface HorizonChartProps {
  className?: string;
  width?: number;
  height?: number;
  seriesHeight?: number;
  data: DataSeries[];
  bands?: number;
  colors?: string[];
  colorScale?: string;
  mode?: string;
  offsetX?: number;
}

const StyledDiv = styled.div`
  ${({ theme }) => `
    .superset-legacy-chart-horizon {
      overflow: auto;
      position: relative;
    }

    .superset-legacy-chart-horizon .horizon-row {
      border-bottom: solid 1px ${theme.colorBorderSecondary};
      border-top: 0;
      padding: 0;
      margin: 0;
    }

    .superset-legacy-chart-horizon .horizon-row span.title {
      position: absolute;
      color: ${theme.colorText};
      font-size: ${theme.fontSizeSM}px;
      margin: 0;
    }
  `}
`;

function HorizonChart({
  className = '',
  width = 800,
  height = 600,
  seriesHeight = 20,
  data,
  bands = Math.floor(DEFAULT_COLORS.length / 2),
  colors = DEFAULT_COLORS,
  colorScale = 'series',
  mode = 'offset',
  offsetX = 0,
}: HorizonChartProps) {
  const yDomain = useMemo((): [number, number] | undefined => {
    if (colorScale === 'overall') {
      const allValues = data.reduce<DataValue[]>(
        (acc, current) => acc.concat(current.values),
        [],
      );
      const rawExtent = d3Extent(allValues, d => d.y);
      // Only set yDomain if we have valid min and max values
      if (rawExtent[0] != null && rawExtent[1] != null) {
        return [rawExtent[0], rawExtent[1]];
      }
    }
    return undefined;
  }, [colorScale, data]);

  return (
    <StyledDiv>
      <div
        className={`superset-legacy-chart-horizon ${className}`}
        style={{ height }}
      >
        {data.map(row => (
          <HorizonRow
            key={row.key.join(',')}
            width={width}
            height={seriesHeight}
            title={ensureIsArray(row.key).join(', ')}
            data={row.values}
            bands={bands}
            colors={colors}
            colorScale={colorScale}
            mode={mode}
            offsetX={offsetX}
            yDomain={yDomain}
          />
        ))}
      </div>
    </StyledDiv>
  );
}

export default memo(HorizonChart);
