/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  this file that was agreed to
 * by you in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied.  See
 * the License for the specific language governing permissions
 * and limitations under the License.
 */

import { useCallback, useState } from 'react';
import type { DrillDownHierarchy } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { DrillDownLevel } from './types';

export interface DrillDownState {
  hierarchyId: string;
  currentLevelIndex: number;
  breadcrumbs: Array<{
    levelIndex: number;
    label: string;
    value: unknown;
    column: string;
    datasetId: number;
  }>;
  currentFilter: {
    datasetId: number;
    column: string;
    values: unknown[];
  } | null;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Hook that manages drill-down navigation through a hierarchy.
 *
 * Provides:
 * - `drillDown(value)`: navigate one level deeper for a given value
 * - `drillUp(targetLevel)`: navigate back to a specific level
 * - `reset()`: go back to the top level
 * - `breadcrumbs`: current navigation path
 */
export function useDrillDownNavigation(
  hierarchy: DrillDownHierarchy | null,
) {
  const [state, setState] = useState<DrillDownState | null>(null);

  const currentLevel = hierarchy && state
    ? hierarchy.levels[state.currentLevelIndex]
    : null;

  const nextLevel = hierarchy && state && state.currentLevelIndex < hierarchy.levels.length - 1
    ? hierarchy.levels[state.currentLevelIndex + 1]
    : null;

  /**
   * Initialize drill-down for a hierarchy.
   */
  const initDrillDown = useCallback(
    (h: DrillDownHierarchy) => {
      setState({
        hierarchyId: h.id,
        currentLevelIndex: 0,
        breadcrumbs: [],
        currentFilter: null,
      });
    },
    [],
  );

  /**
   * Navigate one level deeper.
   *
   * @param value The value clicked at the current level (e.g., "Brazil")
   */
  const drillDown = useCallback(
    (value: unknown) => {
      if (!hierarchy || !state) return;
      const nextIdx = state.currentLevelIndex + 1;
      if (nextIdx >= hierarchy.levels.length) return;

      const currentLvl = hierarchy.levels[state.currentLevelIndex];
      const nextLvl = hierarchy.levels[nextIdx];

      // Build filter for the next level
      const newFilter = {
        datasetId: nextLvl.dataset_id,
        column: nextLvl.column_name,
        values: [value],
      };

      setState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentLevelIndex: nextIdx,
          breadcrumbs: [
            ...prev.breadcrumbs,
            {
              levelIndex: prev.currentLevelIndex,
              label: currentLvl.label,
              value,
              column: currentLvl.column_name,
              datasetId: currentLvl.dataset_id,
            },
          ],
          currentFilter: newFilter,
        };
      });
    },
    [hierarchy, state],
  );

  /**
   * Navigate back to a specific level in the breadcrumb.
   */
  const drillUp = useCallback(
    (targetLevel: number) => {
      if (!state) return;
      setState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentLevelIndex: targetLevel,
          breadcrumbs: prev.breadcrumbs.slice(0, targetLevel),
          currentFilter:
            targetLevel > 0
              ? {
                  datasetId: prev.breadcrumbs[targetLevel - 1].datasetId,
                  column: prev.breadcrumbs[targetLevel - 1].column,
                  values: [prev.breadcrumbs[targetLevel - 1].value],
                }
              : null,
        };
      });
    },
    [state],
  );

  /**
   * Reset to the top level.
   */
  const reset = useCallback(() => {
    if (!hierarchy) return;
    setState({
      hierarchyId: hierarchy.id,
      currentLevelIndex: 0,
      breadcrumbs: [],
      currentFilter: null,
    });
  }, [hierarchy]);

  return {
    state,
    currentLevel,
    nextLevel,
    canDrillDown: nextLevel !== null,
    initDrillDown,
    drillDown,
    drillUp,
    reset,
  };
}
