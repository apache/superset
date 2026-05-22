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
import { ComponentType, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  ensureIsArray,
  QueryData,
  QueryFormData,
  BinaryQueryObjectFilterClause,
} from '@superset-ui/core';
import { css } from '@apache-superset/core/theme';
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
 *  2. Computes "effective" form_data for the current level (replacing the
 *     groupby and adding accumulated filters)
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

  // eslint-disable-next-line no-console
  console.log('[DrillDown] DrillDownHost formData.drilldown_hierarchy =',
    (formData as Record<string, unknown>).drilldown_hierarchy,
    'formData.viz_type =', formData.viz_type,
  );

  const {
    isDrilling,
    drillStack,
    effectiveFormData,
    effectiveQueriesResponse,
    isLoading,
    error,
    hasHierarchy,
    hasMoreLevels,
    drillDown,
    resetTo,
  } = useDrillDownState({
    formData,
    baseQueriesResponse: queriesResponse,
  });

  const hierarchy = useMemo(
    () => {
      const fd = formData as Record<string, unknown>;
      return ensureIsArray(fd.drilldown_hierarchy ?? fd.drilldownHierarchy) as string[];
    },
    [formData],
  );

  // Plugins receive a no-op handler when drilling is unavailable so the
  // click logic in eventHandlers.ts can detect "no drill" and fall back
  // to cross-filter behavior.
  const onDrillDown = useMemo<OnDrillDownHook | undefined>(() => {
    // eslint-disable-next-line no-console
    console.log('[DrillDown] DrillDownHost computing onDrillDown', {
      hasHierarchy,
      hasMoreLevels,
      hierarchy,
    });
    if (!hasHierarchy || !hasMoreLevels) {
      return undefined;
    }
    return (filters, label) => {
      // eslint-disable-next-line no-console
      console.log('[DrillDown] drillDown called', { filters, label });
      drillDown(filters, label);
    };
  }, [hasHierarchy, hasMoreLevels, drillDown, hierarchy]);

  const overlayProps = useMemo<Partial<ChartRendererProps>>(() => {
    if (!isDrilling) {
      return {};
    }
    // eslint-disable-next-line no-console
    console.log('[DrillDown] overlayProps', {
      isDrilling,
      isLoading,
      hasEffectiveData: !!effectiveQueriesResponse,
      effectiveDataLength: effectiveQueriesResponse?.length,
    });
    return {
      formData: effectiveFormData as QueryFormData,
      // Tell the upstream renderer to use our drill-fetched data.
      // We pass it via queriesResponse; the ChartRenderer clones it internally.
      queriesResponse: (effectiveQueriesResponse ?? null) as
        | QueryData[]
        | null,
      // Keep the chart status as "rendered" so the renderer doesn't bail out;
      // we render our own loading overlay instead.
      chartStatus: isLoading ? 'loading' : 'rendered',
      latestQueryFormData: effectiveFormData,
      // Drill data is "owned" by the host; do not let the dashboard's stale
      // detection swap it back to the original.
      chartIsStale: false,
      // Drill mode emits no cross-filters; the click is consumed by drill.
      emitCrossFilters: false,
    };
  }, [isDrilling, effectiveFormData, effectiveQueriesResponse, isLoading]);

  const handleResetTo = useCallback(
    (depth: number) => {
      resetTo(depth);
    },
    [resetTo],
  );

  if (!hasHierarchy) {
    return <ChartRendererComponent {...rendererProps} />;
  }

  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const [breadcrumbHeight, setBreadcrumbHeight] = useState(0);

  useEffect(() => {
    if (breadcrumbRef.current) {
      setBreadcrumbHeight(breadcrumbRef.current.offsetHeight);
    } else {
      setBreadcrumbHeight(0);
    }
  }, [drillStack.length]);

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
          onJumpTo={handleResetTo}
        />
      </div>
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
