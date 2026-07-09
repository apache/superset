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
import {
  ComponentType,
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import {
  QueryData,
  QueryFormData,
  BinaryQueryObjectFilterClause,
} from '@superset-ui/core';
import { css } from '@apache-superset/core/theme';
import { ChartSource } from 'src/types/ChartSource';
import { useDrillDownState } from './useDrillDownState';
import { DrillDownBreadcrumb } from './DrillDownBreadcrumb';
import type { ChartRendererProps } from '../ChartRenderer';

/**
 * Hook payload contract: chart plugins call `onDrillDown(filters, label)`
 * via the chart's hooks bag when the user clicks a data point and a
 * drill-down hierarchy is configured.
 */
export type OnDrillDownHook = (
  filters: BinaryQueryObjectFilterClause[],
  label: string,
) => void;

interface DrillDownHostProps extends ChartRendererProps {
  /** The wrapped renderer component */
  ChartRendererComponent: ComponentType<
    ChartRendererProps & { onDrillDown?: OnDrillDownHook }
  >;
}

/**
 * Wraps `<ChartRenderer>` with drill-down behavior. When the chart's
 * form_data declares a `drilldown_hierarchy`, this host:
 *
 *  1. Tracks how deep the user has drilled (a stack of levels)
 *  2. Computes "effective" form_data for the current level (swapping the
 *     grouping dimension — groupby or x_axis — and adding accumulated filters)
 *  3. Re-fetches chart data for that level
 *  4. Renders a breadcrumb above the chart for navigating back up
 *
 * If the chart has no hierarchy, this is a thin pass-through.
 */
export function DrillDownHost({
  ChartRendererComponent,
  ...rendererProps
}: DrillDownHostProps) {
  const { formData, queriesResponse } = rendererProps;

  const {
    isDrilling,
    drillStack,
    selectedLeaf,
    hierarchy,
    effectiveFormData,
    effectiveQueriesResponse,
    isLoading,
    error,
    hasHierarchy,
    drillDown,
    resetTo,
  } = useDrillDownState({
    chartId: rendererProps.chartId,
    formData,
    baseQueriesResponse: queriesResponse,
  });

  // Drill-down is a dashboard interaction. In Explore the control panel and the
  // rendered chart would disagree (and clicks there mean something else), so
  // only enable it when rendered inside a dashboard.
  const drillEnabled =
    hasHierarchy && rendererProps.source === ChartSource.Dashboard;

  const onDrillDown = useMemo<OnDrillDownHook | undefined>(() => {
    if (!drillEnabled) {
      return undefined;
    }
    return (filters, label) => {
      // Emit a cross-filter for the FULL drill path — every level reached so
      // far plus this click — so other dashboard charts are scoped to exactly
      // what the drilled chart shows, not just the deepest clicked column.
      const pathFilters = [
        ...drillStack.flatMap(level => level.filters),
        ...filters,
      ];
      const pathLabels = [...drillStack.map(level => level.label), label];
      drillDown(filters, label);
      if (
        rendererProps.emitCrossFilters &&
        rendererProps.actions?.updateDataMask
      ) {
        rendererProps.actions.updateDataMask(rendererProps.chartId, {
          extraFormData: {
            filters: pathFilters.map(f => ({
              col: f.col,
              op: 'IN' as const,
              val: [f.val] as (string | number | boolean)[],
            })),
          },
          filterState: {
            value: pathLabels,
            selectedValues: pathLabels,
          },
        });
      }
    };
  }, [
    drillEnabled,
    drillDown,
    drillStack,
    rendererProps.emitCrossFilters,
    rendererProps.actions,
    rendererProps.chartId,
  ]);

  const overlayProps = useMemo<Partial<ChartRendererProps>>(() => {
    if (!isDrilling) {
      // At the base level, render the chart unchanged.
      return {};
    }
    return {
      formData: effectiveFormData as QueryFormData,
      queriesResponse: (effectiveQueriesResponse ?? null) as QueryData[] | null,
      // Treat "no data yet" as loading. On the first render after a drill the
      // fetch effect hasn't run (isLoading is still false, drillData is null);
      // without this the renderer would briefly paint a "No results" state.
      chartStatus:
        isLoading || effectiveQueriesResponse == null ? 'loading' : 'rendered',
      latestQueryFormData: effectiveFormData,
      chartIsStale: false,
    };
  }, [isDrilling, effectiveFormData, effectiveQueriesResponse, isLoading]);

  const handleResetTo = useCallback(
    (depth: number) => {
      resetTo(depth);
      // Update cross-filter to match the level we're jumping to — but only if
      // the chart is configured to emit cross-filters, mirroring onDrillDown.
      if (
        !rendererProps.emitCrossFilters ||
        !rendererProps.actions?.updateDataMask
      ) {
        return;
      }
      if (depth === 0) {
        // Going back to root — clear cross-filter entirely
        rendererProps.actions.updateDataMask(rendererProps.chartId, {
          extraFormData: { filters: [] },
          filterState: { value: null, selectedValues: null },
        });
        // While drilled, the dashboard may have skipped re-querying this
        // chart's base when other charts' cross-filters changed (e.g. one
        // was cleared), leaving the Redux base query result stale/filtered.
        // Trigger a fresh base query so returning to the top level shows the
        // full chart.
        rendererProps.actions.triggerQuery?.(true, rendererProps.chartId);
      } else {
        // Going to an intermediate level — rebuild accumulated filters
        // from all levels up to the target depth (mirroring effectiveFormData)
        const accumulatedFilters = drillStack.slice(0, depth).flatMap(level =>
          level.filters.map(f => ({
            col: f.col,
            op: 'IN' as const,
            val: [f.val] as (string | number | boolean)[],
          })),
        );
        const labels = drillStack.slice(0, depth).map(l => l.label);
        rendererProps.actions.updateDataMask(rendererProps.chartId, {
          extraFormData: { filters: accumulatedFilters },
          filterState: {
            value: labels,
            selectedValues: labels,
          },
        });
      }
    },
    [
      resetTo,
      rendererProps.emitCrossFilters,
      rendererProps.actions,
      rendererProps.chartId,
      drillStack,
    ],
  );

  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const [breadcrumbHeight, setBreadcrumbHeight] = useState(0);

  useEffect(() => {
    if (breadcrumbRef.current) {
      setBreadcrumbHeight(breadcrumbRef.current.offsetHeight);
    } else {
      setBreadcrumbHeight(0);
    }
  }, [drillStack.length, selectedLeaf, error]);

  if (!drillEnabled) {
    return <ChartRendererComponent {...rendererProps} />;
  }

  // Reduce chart height by the breadcrumb height
  const adjustedHeight =
    rendererProps.height && breadcrumbHeight > 0
      ? rendererProps.height - breadcrumbHeight
      : rendererProps.height;

  return (
    <div
      data-test="drill-down-host"
      css={css`
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
      `}
    >
      <div ref={breadcrumbRef}>
        <DrillDownBreadcrumb
          hierarchy={hierarchy}
          drillStack={drillStack}
          selectedLeaf={selectedLeaf}
          onJumpTo={handleResetTo}
        />
        {error && (
          <div
            role="alert"
            css={theme => css`
              padding: ${theme.sizeUnit * 2}px;
              color: ${theme.colorErrorText};
              font-size: ${theme.fontSizeSM}px;
            `}
          >
            {error}
          </div>
        )}
      </div>
      <div
        css={css`
          flex: 1;
          min-height: 0;
          position: relative;
        `}
      >
        <ChartRendererComponent
          {...rendererProps}
          {...overlayProps}
          height={adjustedHeight}
          onDrillDown={onDrillDown}
        />
      </div>
    </div>
  );
}
