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

import { memo } from 'react';
import { styled } from '../../../theme';
import { MatrixifyGridCell as GridCellData } from '../../types/matrixify';
import StatefulChart from '../StatefulChart';

const CellContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colorBorder};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  overflow: hidden;
`;

const CellHeader = styled.div`
  flex-shrink: 0;
  padding: ${({ theme }) => theme.sizeUnit}px
    ${({ theme }) => theme.sizeUnit * 2}px;
  background-color: ${({ theme }) => theme.colorFillAlter};
  border-bottom: 1px solid ${({ theme }) => theme.colorBorder};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ChartWrapper = styled.div`
  flex: 1;
  min-height: 0;
  padding: 0;

  /* Remove any padding/margins that might be causing title height issues */
  & .chart-container {
    padding-top: 0 !important;
  }

  /* Target title elements inside the chart container */
  & .superchart-container .header-title,
  & .superchart-container [class*='title'] {
    display: none !important;
  }
`;

interface MatrixifyGridCellProps {
  cell: GridCellData;
  rowHeight: number;
  datasource?: any;
  hooks?: any;
}

/**
 * Individual grid cell component - memoized to prevent unnecessary re-renders
 */
const MatrixifyGridCell = memo(
  ({ cell, rowHeight, datasource, hooks }: MatrixifyGridCellProps) => {
    // Use computed title from template (will be empty string if no template)
    const cellLabel = cell.title || '';

    // Only show label if it has content
    const showLabel = cellLabel && cellLabel.trim() !== '';

    return (
      <CellContainer
        className="matrixify-cell"
        data-row={cell.row}
        data-col={cell.col}
        data-row-label={cell.rowLabel}
        data-col-label={cell.colLabel}
      >
        {showLabel && <CellHeader title={cellLabel}>{cellLabel}</CellHeader>}
        <ChartWrapper>
          <StatefulChart
            id={cell.id}
            formData={cell.formData}
            width="100%"
            height="100%"
            enableNoResults={false}
            showLoading
          />
        </ChartWrapper>
      </CellContainer>
    );
  },
  // Custom comparison function to prevent unnecessary re-renders
  // Returns true to skip re-render, false to re-render
  (prevProps, nextProps) => {
    // Always re-render if formData changes
    if (
      JSON.stringify(prevProps.cell.formData) !==
      JSON.stringify(nextProps.cell.formData)
    ) {
      return false;
    }

    // Re-render if rowHeight changes
    if (prevProps.rowHeight !== nextProps.rowHeight) {
      return false;
    }

    // Re-render if cell position changes (shouldn't happen, but just in case)
    if (prevProps.cell.id !== nextProps.cell.id) {
      return false;
    }

    // Re-render if title changes
    if (prevProps.cell.title !== nextProps.cell.title) {
      return false;
    }

    // Skip re-render if nothing important changed
    return true;
  },
);

MatrixifyGridCell.displayName = 'MatrixifyGridCell';

export default MatrixifyGridCell;
