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

import { useCallback, useState } from 'react';
import { formatTimeRangeLabel } from '@superset-ui/core';
import { WhatIfFilter } from 'src/dashboard/types';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { Clauses } from 'src/explore/components/controls/FilterControl/types';
import { OPERATOR_ENUM_TO_OPERATOR_TYPE } from 'src/explore/constants';

export interface UseWhatIfFiltersReturn {
  filters: WhatIfFilter[];
  filterPopoverVisible: boolean;
  editingFilterIndex: number | null;
  currentAdhocFilter: AdhocFilter | null;
  setFilterPopoverVisible: (visible: boolean) => void;
  handleOpenFilterPopover: () => void;
  handleEditFilter: (index: number) => void;
  handleFilterChange: (adhocFilter: AdhocFilter) => void;
  handleRemoveFilter: (e: React.MouseEvent, index: number) => void;
  handleFilterPopoverClose: () => void;
  handleFilterPopoverResize: () => void;
  clearFilters: () => void;
  formatFilterLabel: (filter: WhatIfFilter) => string;
}

/**
 * Custom hook for managing what-if filter state and operations.
 * Encapsulates all filter-related logic including:
 * - Filter CRUD operations
 * - AdhocFilter <-> WhatIfFilter conversions
 * - Popover state management
 * - Filter label formatting
 */
export function useWhatIfFilters(): UseWhatIfFiltersReturn {
  const [filters, setFilters] = useState<WhatIfFilter[]>([]);
  const [filterPopoverVisible, setFilterPopoverVisible] = useState(false);
  const [editingFilterIndex, setEditingFilterIndex] = useState<number | null>(
    null,
  );
  const [currentAdhocFilter, setCurrentAdhocFilter] =
    useState<AdhocFilter | null>(null);

  // Convert AdhocFilter to WhatIfFilter
  const adhocFilterToWhatIfFilter = useCallback(
    (adhocFilter: AdhocFilter): WhatIfFilter | null => {
      if (!adhocFilter.isValid()) return null;

      const { subject, operator, comparator } = adhocFilter;
      if (!subject || !operator) return null;

      // Map operator to WhatIfFilterOperator
      let op = operator as WhatIfFilter['op'];

      // Handle operator mapping
      if (operator === 'TEMPORAL_RANGE') {
        op = 'TEMPORAL_RANGE';
      } else if (operator === 'IN' || operator === 'in') {
        op = 'IN';
      } else if (operator === 'NOT IN' || operator === 'not in') {
        op = 'NOT IN';
      }

      return {
        col: subject,
        op,
        val: comparator,
      };
    },
    [],
  );

  // Convert WhatIfFilter to AdhocFilter for editing
  const whatIfFilterToAdhocFilter = useCallback(
    (filter: WhatIfFilter): AdhocFilter => {
      // Find the operatorId from the operator
      let operatorId: string | undefined;
      for (const [key, value] of Object.entries(
        OPERATOR_ENUM_TO_OPERATOR_TYPE,
      )) {
        if (value.operation === filter.op) {
          operatorId = key;
          break;
        }
      }

      return new AdhocFilter({
        expressionType: 'SIMPLE',
        subject: filter.col,
        operator: filter.op,
        operatorId,
        comparator: filter.val,
        clause: Clauses.Where,
      });
    },
    [],
  );

  const handleOpenFilterPopover = useCallback(() => {
    // Create a new empty AdhocFilter
    const newFilter = new AdhocFilter({
      expressionType: 'SIMPLE',
      clause: Clauses.Where,
      subject: null,
      operator: null,
      comparator: null,
      isNew: true,
    });
    setCurrentAdhocFilter(newFilter);
    setEditingFilterIndex(null);
    setFilterPopoverVisible(true);
  }, []);

  const handleEditFilter = useCallback(
    (index: number) => {
      const filter = filters[index];
      const adhocFilter = whatIfFilterToAdhocFilter(filter);
      setCurrentAdhocFilter(adhocFilter);
      setEditingFilterIndex(index);
      setFilterPopoverVisible(true);
    },
    [filters, whatIfFilterToAdhocFilter],
  );

  const handleFilterChange = useCallback(
    (adhocFilter: AdhocFilter) => {
      const whatIfFilter = adhocFilterToWhatIfFilter(adhocFilter);
      if (!whatIfFilter) return;

      setFilters(prevFilters => {
        if (editingFilterIndex !== null) {
          // Update existing filter
          const newFilters = [...prevFilters];
          newFilters[editingFilterIndex] = whatIfFilter;
          return newFilters;
        }
        // Add new filter
        return [...prevFilters, whatIfFilter];
      });
      setFilterPopoverVisible(false);
      setCurrentAdhocFilter(null);
      setEditingFilterIndex(null);
    },
    [adhocFilterToWhatIfFilter, editingFilterIndex],
  );

  const handleRemoveFilter = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      setFilters(prevFilters => prevFilters.filter((_, i) => i !== index));
    },
    [],
  );

  const handleFilterPopoverClose = useCallback(() => {
    setFilterPopoverVisible(false);
    setCurrentAdhocFilter(null);
    setEditingFilterIndex(null);
  }, []);

  // Intentionally empty: AdhocFilterEditPopover requires an onResize callback,
  // but we don't need dynamic resizing in this fixed-width panel context.
  const handleFilterPopoverResize = useCallback(() => {}, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  // Helper to format filter for display (matching Explore filter label format)
  const formatFilterLabel = useCallback((filter: WhatIfFilter): string => {
    const { col, op, val } = filter;

    // Special handling for TEMPORAL_RANGE to match Explore format
    if (op === 'TEMPORAL_RANGE' && typeof val === 'string') {
      return formatTimeRangeLabel(val, col);
    }

    let valStr: string;
    if (Array.isArray(val)) {
      valStr = val.join(', ');
    } else if (typeof val === 'boolean') {
      valStr = val ? 'true' : 'false';
    } else {
      valStr = String(val);
    }
    // Truncate long values
    if (valStr.length > 20) {
      valStr = `${valStr.substring(0, 17)}...`;
    }
    return `${col} ${op} ${valStr}`;
  }, []);

  return {
    filters,
    filterPopoverVisible,
    editingFilterIndex,
    currentAdhocFilter,
    setFilterPopoverVisible,
    handleOpenFilterPopover,
    handleEditFilter,
    handleFilterChange,
    handleRemoveFilter,
    handleFilterPopoverClose,
    handleFilterPopoverResize,
    clearFilters,
    formatFilterLabel,
  };
}

export default useWhatIfFilters;
