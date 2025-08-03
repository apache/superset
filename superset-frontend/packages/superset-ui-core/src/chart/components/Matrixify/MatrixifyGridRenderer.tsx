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

import { useMemo } from 'react';
import styled from '@emotion/styled';
import { MatrixifyFormData } from '../../types/matrixify';
import { generateMatrixifyGrid } from './MatrixifyGridGenerator';
import MatrixifyGridCell from './MatrixifyGridCell';

const GridContainer = styled.div<{ height?: number }>`
  width: 100%;
  ${({ height }) => height && `height: ${height}px;`}
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
`;

const GridScrollContainer = styled.div`
  flex: 1;
  overflow: auto;
  min-height: 0;
`;

const GridLayout = styled.div<{
  columns: number;
  hasRowHeaders: boolean;
  rowHeight: number;
  hasColumnHeaders: boolean;
}>`
  display: grid;
  grid-template-columns: ${({ columns, hasRowHeaders }) =>
    hasRowHeaders
      ? `40px repeat(${columns}, minmax(0, 1fr))`
      : `repeat(${columns}, minmax(0, 1fr))`};
  ${({ hasColumnHeaders, rowHeight }) =>
    hasColumnHeaders
      ? `grid-template-rows: 40px; grid-auto-rows: ${rowHeight}px;`
      : `grid-auto-rows: ${rowHeight}px;`}
  gap: ${({ theme }) =>
    theme.sizeUnit * 2}px; /* 16px to match dashboard grid gutter */
  width: 100%;
  min-width: 0;
  min-height: 0;
`;

const GridHeader = styled.div`
  background-color: ${({ theme }) => theme.colorFillAlter};
  padding: ${({ theme }) => theme.sizeUnit}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  text-align: center;
  border: 1px solid ${({ theme }) => theme.colorBorder};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: ${({ theme }) => theme.fontSizeSM}px;

  &.matrixify-row-header {
    writing-mode: vertical-rl;
    transform: rotate(-180deg);
    padding: ${({ theme }) => theme.sizeUnit * 2}px
      ${({ theme }) => theme.sizeUnit / 2}px;
    min-width: 30px;
    max-width: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &.matrixify-col-header {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

interface MatrixifyGridRendererProps {
  formData: MatrixifyFormData;
  datasource?: any;
  width?: number;
  height?: number;
  hooks?: any;
}

function MatrixifyGridRenderer({
  formData,
  datasource,
  width,
  height,
  hooks,
}: MatrixifyGridRendererProps) {
  // Generate grid structure from form data
  const grid = useMemo(
    () => generateMatrixifyGrid(formData as any),
    [formData],
  );

  if (!grid) {
    return null;
  }

  const { rowHeaders, colHeaders, cells } = grid;

  // Determine layout parameters
  const showRowLabels = formData.matrixify_show_row_labels ?? true;
  const showColumnHeaders = formData.matrixify_show_column_headers ?? true;
  const rowHeight = formData.matrixify_row_height || 300;

  // Calculate number of columns
  const numColumns = colHeaders.length;
  const hasRowHeaders = showRowLabels && rowHeaders.length > 0;
  const hasColumnHeaders = showColumnHeaders && colHeaders.length > 0;

  return (
    <GridContainer height={height}>
      <GridScrollContainer>
        <GridLayout
          columns={numColumns}
          hasRowHeaders={hasRowHeaders}
          rowHeight={rowHeight}
          hasColumnHeaders={hasColumnHeaders}
        >
          {/* Corner cell (empty) */}
          {hasColumnHeaders && hasRowHeaders && <div />}

          {/* Column headers */}
          {hasColumnHeaders &&
            colHeaders.map((header, idx) => (
              <GridHeader
                key={`col-header-${idx}`}
                className="matrixify-col-header"
                title={header}
              >
                {header}
              </GridHeader>
            ))}

          {/* Grid rows */}
          {cells.map((row, rowIdx) => (
            <>
              {/* Row header */}
              {hasRowHeaders && (
                <GridHeader
                  key={`row-header-${rowIdx}`}
                  className="matrixify-row-header"
                  title={rowHeaders[rowIdx]}
                >
                  {rowHeaders[rowIdx]}
                </GridHeader>
              )}

              {/* Row cells */}
              {row.map((cell, colIdx) =>
                cell ? (
                  <MatrixifyGridCell
                    key={cell.id}
                    cell={cell}
                    rowHeight={rowHeight}
                    datasource={datasource}
                    hooks={hooks}
                  />
                ) : null,
              )}
            </>
          ))}
        </GridLayout>
      </GridScrollContainer>
    </GridContainer>
  );
}

export default MatrixifyGridRenderer;
