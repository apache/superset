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
import { Filter, ChartCustomization } from '@superset-ui/core';
import { useTheme } from '@apache-superset/core/theme';
import {
  useDashboardSlicesStore,
  useNativeFiltersStore,
} from 'src/dashboard/stores';
import { useChartCustomizations } from 'src/dashboard/components/nativeFilters/state';
import {
  getRelatedCharts,
  getRelatedChartsForChartCustomization,
} from './getRelatedCharts';

const unfocusedChartStyles = {
  opacity: 0.3,
  pointerEvents: 'none' as const,
};

const EMPTY = {};

const useFilterFocusHighlightStyles = (chartId: number) => {
  const theme = useTheme();

  const focusedChartStyles = useMemo(
    () => ({
      borderColor: theme.colorPrimaryBorder,
      opacity: 1,
      boxShadow: `0px 0px ${theme.sizeUnit * 3}px ${theme.colorPrimary}`,
      pointerEvents: 'auto',
    }),
    [theme],
  );

  const filters = useNativeFiltersStore(s => s.filters);
  const focusedFilterId = useNativeFiltersStore(s => s.focusedFilterId);
  const hoveredFilterId = useNativeFiltersStore(s => s.hoveredFilterId);
  const highlightedChartCustomizationId = useNativeFiltersStore(
    s => s.hoveredChartCustomizationId,
  );
  const slices = useDashboardSlicesStore(s => s.slices);
  const chartCustomizationItems = useChartCustomizations();

  const highlightedFilterId = focusedFilterId || hoveredFilterId;

  if (!highlightedFilterId && !highlightedChartCustomizationId) {
    return EMPTY;
  }

  if (highlightedFilterId) {
    // A focused/hovered filter id can briefly outlive its filter (e.g. the
    // filter was just deleted or edited), leaving filters[id] undefined.
    // Skip the highlight in that window rather than dereferencing undefined.
    const highlightedFilter = filters[highlightedFilterId];
    if (highlightedFilter) {
      const relatedCharts = getRelatedCharts(
        highlightedFilterId,
        highlightedFilter as Filter,
        slices,
      );

      if (relatedCharts.includes(chartId)) {
        return focusedChartStyles;
      }
    }
  }

  if (highlightedChartCustomizationId) {
    const customizationItem = chartCustomizationItems.find(
      item => item.id === highlightedChartCustomizationId,
    );

    if (customizationItem && 'targets' in customizationItem) {
      const relatedCharts = getRelatedChartsForChartCustomization(
        customizationItem as ChartCustomization,
        slices,
      );

      if (relatedCharts.includes(chartId)) {
        return focusedChartStyles;
      }
    }
  }

  // inline styles are used here due to a performance issue when adding/changing a class, which causes a reflow
  return unfocusedChartStyles;
};

export default useFilterFocusHighlightStyles;
