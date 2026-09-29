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

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled, useTheme } from '@apache-superset/core/theme';
import { FeatureFlag, isFeatureEnabled } from '../../../utils/featureFlags';
import { MatrixifyGridCell as GridCellData } from '../../types/matrixify';
import StatefulChart from '../StatefulChart';
import {
  FORCE_IN_VIEW_EVENT,
  isForceInViewActiveForRow,
} from './virtualizationEvents';

// How far outside the viewport a cell can be before it starts loading. Keeps a
// small buffer so charts finish loading just before the user scrolls to them.
const LAZY_LOAD_ROOT_MARGIN = '200px 0px';

// A headless browser (e.g. the server-side screenshot/report/thumbnail
// worker) sets navigator.webdriver. In that case every cell must render
// immediately so that captures include the full matrix regardless of scroll
// position. This does NOT cover client-side "Download as Image/PDF", which
// runs in the user's normal (non-headless) browser; that path instead relies
// on FORCE_IN_VIEW_EVENT (see the effect below) to force off-screen cells to
// mount before the capture is taken.
const isHeadlessCapture = () =>
  typeof window !== 'undefined' && Boolean(window.navigator?.webdriver);

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
  position: relative;

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

const NoDataMessage = styled.div<{ theme: any }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: ${({ theme }) => theme.colorTextQuaternary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  text-align: center;
  user-select: none;
`;

// Reserves the cell's space while the chart has not yet scrolled into view, so
// the grid layout stays stable and no data query is fired for off-screen cells.
const ChartPlaceholder = styled.div`
  width: 100%;
  height: 100%;
`;

interface MatrixifyGridCellProps {
  cell: GridCellData;
  rowHeight: number;
  datasource?: any;
  hooks?: any;
}

// Simple No Data component for matrix cells
const MatrixNoDataComponent = () => {
  const theme = useTheme();
  return <NoDataMessage theme={theme}>{t('No data')}</NoDataMessage>;
};

/**
 * Individual grid cell component - memoized to prevent unnecessary re-renders
 */
const MatrixifyGridCell = memo(
  ({ cell, hooks }: MatrixifyGridCellProps) => {
    // Use computed title from template (will be empty string if no template)
    const cellLabel = cell.title || '';

    // Only show label if it has content
    const showLabel = cellLabel && cellLabel.trim() !== '';

    // Per-cell lazy loading: when dashboard virtualization is enabled, defer
    // mounting the chart (and therefore its data query) until the cell scrolls
    // into view. This prevents a large matrix from firing every cell's query at
    // once. Disabled flag or headless capture renders immediately.
    const containerRef = useRef<HTMLDivElement>(null);
    const lazyLoadEnabled =
      isFeatureEnabled(FeatureFlag.DashboardVirtualization) &&
      !isHeadlessCapture();
    // Latch: once a cell has entered the viewport it stays mounted, avoiding
    // refetch churn when scrolling back and forth within the grid.
    const [hasEnteredView, setHasEnteredView] = useState(!lazyLoadEnabled);

    useEffect(() => {
      if (hasEnteredView) {
        return undefined;
      }
      const element = containerRef.current;
      if (!element || typeof IntersectionObserver === 'undefined') {
        // No element or no observer support: fall back to rendering eagerly.
        setHasEnteredView(true);
        return undefined;
      }
      const observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            setHasEnteredView(true);
            observer.disconnect();
          }
        },
        { rootMargin: LAZY_LOAD_ROOT_MARGIN },
      );
      observer.observe(element);
      return () => observer.disconnect();
    }, [hasEnteredView]);

    // Client-side "Download as Image/PDF" runs in the user's normal
    // (non-headless) browser, so isHeadlessCapture() above never applies. It
    // instead forces lazily-loaded charts to mount by dispatching
    // FORCE_IN_VIEW_EVENT on window - optionally scoped to a batch of
    // dashboard row ids, see src/utils/downloadUtils.ts - then waits for
    // loading spinners to clear before capturing. Mirror the same row
    // scoping dashboard Row.tsx uses (via the nearest ancestor
    // [data-row-id]) so a Matrixify chart mounts in step with its own row's
    // batch instead of dumping every deferred cell's query into whichever
    // batch happens to fire first.
    useEffect(() => {
      if (!lazyLoadEnabled || hasEnteredView) {
        return undefined;
      }
      const ancestorRowId =
        containerRef.current
          ?.closest('[data-row-id]')
          ?.getAttribute('data-row-id') ?? null;
      if (isForceInViewActiveForRow(ancestorRowId)) {
        setHasEnteredView(true);
        return undefined;
      }
      const handleForceInView = (event: Event) => {
        const rowIds = (event as CustomEvent<{ rowIds?: string[] }>).detail
          ?.rowIds;
        if (
          rowIds &&
          (ancestorRowId === null || !rowIds.includes(ancestorRowId))
        ) {
          return;
        }
        setHasEnteredView(true);
      };
      window.addEventListener(FORCE_IN_VIEW_EVENT, handleForceInView);
      return () => {
        window.removeEventListener(FORCE_IN_VIEW_EVENT, handleForceInView);
      };
    }, [lazyLoadEnabled, hasEnteredView]);

    // Create enhanced hooks that merge cell filters with drill filters
    const enhancedHooks = useMemo(() => {
      if (!hooks) return undefined;

      // Create a new hooks object with wrapped onContextMenu
      const wrappedHooks = { ...hooks };

      if (hooks.onContextMenu) {
        wrappedHooks.onContextMenu = (
          offsetX: number,
          offsetY: number,
          filters?: any,
        ) => {
          // Get the cell's adhoc filters
          const cellFilters = cell.formData.adhoc_filters || [];

          // Merge the cell filters with any drill filters
          const enhancedFilters = {
            ...filters,
            // Add cell-specific context to help identify this is from a matrix cell
            matrixifyContext: {
              rowLabel: cell.rowLabel,
              colLabel: cell.colLabel,
              row: cell.row,
              col: cell.col,
              // Include the cell's filters so they can be applied to drill operations
              cellFilters,
              // Include the cell's formData which has adhoc_filters for drill-to-detail
              cellFormData: cell.formData,
            },
          };

          // Call the original handler with enhanced filters
          hooks.onContextMenu(offsetX, offsetY, enhancedFilters);
        };
      }

      return wrappedHooks;
    }, [hooks, cell]);

    return (
      <CellContainer
        ref={containerRef}
        className="matrixify-cell"
        data-row={cell.row}
        data-col={cell.col}
        data-row-label={cell.rowLabel}
        data-col-label={cell.colLabel}
      >
        {showLabel && <CellHeader title={cellLabel}>{cellLabel}</CellHeader>}
        <ChartWrapper>
          {hasEnteredView ? (
            <StatefulChart
              id={cell.id}
              formData={cell.formData}
              width="100%"
              height="100%"
              enableNoResults
              noDataComponent={MatrixNoDataComponent}
              showLoading
              hooks={enhancedHooks}
            />
          ) : (
            <ChartPlaceholder data-test="matrixify-cell-placeholder" />
          )}
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
