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
import { styled } from '@superset-ui/core';
import { CustomCellRendererProps } from '@superset-ui/core/components/ThemedAgGridReact';
import { BasicColorFormatterType, InputColumn } from '../types';
import { useIsDark } from '../utils/useTableTheme';

const StyledTotalCell = styled.div`
  ${() => `
    font-weight: bold;
  `}
`;

const CellContainer = styled.div<{ backgroundColor?: string; align?: string }>`
  display: flex;
  background-color: ${({ backgroundColor }) =>
    backgroundColor || 'transparent'};
  justify-content: ${({ align }) => align || 'left'};
`;

const ArrowContainer = styled.div<{ arrowColor?: string }>`
  margin-right: 10px;
  color: ${({ arrowColor }) => arrowColor || 'inherit'};
`;

const Bar = styled.div<{
  offset: number;
  percentage: number;
  background: string;
}>`
  position: absolute;
  left: ${({ offset }) => `${offset}%`};
  top: 0;
  height: 100%;
  width: ${({ percentage }) => `${percentage}%`};
  background-color: ${({ background }) => background};
  z-index: 1;
`;

type ValueRange = [number, number];

/**
 * Cell background width calculation for horizontal bar chart
 */
function cellWidth({
  value,
  valueRange,
  alignPositiveNegative,
}: {
  value: number;
  valueRange: ValueRange;
  alignPositiveNegative: boolean;
}) {
  const [minValue, maxValue] = valueRange;
  if (alignPositiveNegative) {
    const perc = Math.abs(Math.round((value / maxValue) * 100));
    return perc;
  }
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  const perc2 = Math.round((Math.abs(value) / tot) * 100);
  return perc2;
}

/**
 * Cell left margin (offset) calculation for horizontal bar chart elements
 * when alignPositiveNegative is not set
 */
function cellOffset({
  value,
  valueRange,
  alignPositiveNegative,
}: {
  value: number;
  valueRange: ValueRange;
  alignPositiveNegative: boolean;
}) {
  if (alignPositiveNegative) {
    return 0;
  }
  const [minValue, maxValue] = valueRange;
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  return Math.round((Math.min(negExtent + value, negExtent) / tot) * 100);
}

/**
 * Cell background color calculation for horizontal bar chart
 */
function cellBackground({
  value,
  colorPositiveNegative = false,
  isDarkTheme = false,
}: {
  value: number;
  colorPositiveNegative: boolean;
  isDarkTheme: boolean;
}) {
  if (!colorPositiveNegative) {
    return isDarkTheme ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'; // transparent or neutral
  }

  const r = value < 0 ? 150 : 0;
  const g = value >= 0 ? 150 : 0;
  return `rgba(${r},${g},0,0.2)`;
}

export const NumericCellRenderer = (
  params: CustomCellRendererProps & {
    allowRenderHtml: boolean;
    columns: InputColumn[];
    hasBasicColorFormatters: boolean | undefined;
    col: InputColumn;
    basicColorFormatters: {
      [Key: string]: BasicColorFormatterType;
    }[];
    valueRange: any;
    alignPositiveNegative: boolean;
    colorPositiveNegative: boolean;
  },
) => {
  const {
    value,
    valueFormatted,
    node,
    hasBasicColorFormatters,
    col,
    basicColorFormatters,
    valueRange,
    alignPositiveNegative,
    colorPositiveNegative,
  } = params;

  const isDarkTheme = useIsDark();

  if (node?.rowPinned === 'bottom') {
    return <StyledTotalCell>{valueFormatted ?? value}</StyledTotalCell>;
  }

  let arrow = '';
  let arrowColor = '';
  if (hasBasicColorFormatters && col?.metricName) {
    arrow =
      basicColorFormatters?.[node?.rowIndex as number]?.[col.metricName]
        ?.mainArrow;
    arrowColor =
      basicColorFormatters?.[node?.rowIndex as number]?.[
        col.metricName
      ]?.arrowColor?.toLowerCase();
  }

  const alignment =
    col?.config?.horizontalAlign || (col?.isNumeric ? 'right' : 'left');

  if (!valueRange) {
    return (
      <CellContainer align={alignment}>
        {arrow && (
          <ArrowContainer arrowColor={arrowColor}>{arrow}</ArrowContainer>
        )}
        <div>{valueFormatted ?? value}</div>
      </CellContainer>
    );
  }

  const CellWidth = cellWidth({
    value: value as number,
    valueRange,
    alignPositiveNegative,
  });
  const CellOffset = cellOffset({
    value: value as number,
    valueRange,
    alignPositiveNegative,
  });
  const background = cellBackground({
    value: value as number,
    colorPositiveNegative,
    isDarkTheme,
  });

  return (
    <div>
      <Bar offset={CellOffset} percentage={CellWidth} background={background} />
      {valueFormatted ?? value}
    </div>
  );
};
