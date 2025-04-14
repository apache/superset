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
import { Filter, useTheme } from '@superset-ui/core';
import { useSelector } from 'react-redux';

import { RootState } from 'src/dashboard/types';
import { getRelatedCharts } from './getRelatedCharts';

const unfocusedChartStyles = { opacity: 0.3, pointerEvents: 'none' };
const EMPTY = {};

const useFilterFocusHighlightStyles = (chartId: number) => {
  const theme = useTheme();

  const focusedChartStyles = useMemo(
    () => ({
      borderColor: theme.colors.primary.light2,
      opacity: 1,
      boxShadow: `0px 0px ${theme.gridUnit * 2}px ${theme.colors.primary.base}`,
      pointerEvents: 'auto',
    }),
    [theme],
  );

  const nativeFilters = useSelector((state: RootState) => state.nativeFilters);

  const slices =
    useSelector((state: RootState) => state.sliceEntities.slices) || {};

  const highlightedFilterId =
    nativeFilters?.focusedFilterId || nativeFilters?.hoveredFilterId;

  if (!highlightedFilterId) {
    return EMPTY;
  }

  const relatedCharts = getRelatedCharts(
    highlightedFilterId as string,
    nativeFilters.filters[highlightedFilterId as string] as Filter,
    slices,
  );

  if (highlightedFilterId && relatedCharts.includes(chartId)) {
    return focusedChartStyles;
  }

  // inline styles are used here due to a performance issue when adding/changing a class, which causes a reflow
  return unfocusedChartStyles;
};

export default useFilterFocusHighlightStyles;
