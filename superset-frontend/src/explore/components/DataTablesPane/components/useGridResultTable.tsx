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
import { useMemo, useCallback, useRef, useState } from 'react';
import {
  getTimeFormatter,
  TimeFormats,
  getMetricLabel,
  QueryFormMetric,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Constants } from '@superset-ui/core/components';
import { GenericDataType } from '@apache-superset/core/common';
import type { IRowNode } from 'ag-grid-community';

const timeFormatter = getTimeFormatter(TimeFormats.DATABASE_DATETIME);
const CONTRIBUTION_SUFFIX = '__contribution';

/**
 * Turns a resolved column label into a readable header: a `__contribution`
 * suffix becomes a localized "(contribution)" and a JSON-encoded metric is
 * replaced by its metric label.
 */
export function formatColumnHeader(rawHeader: string): string {
  let cleaned = rawHeader;
  let suffix = '';

  if (rawHeader.endsWith(CONTRIBUTION_SUFFIX)) {
    cleaned = rawHeader.slice(0, rawHeader.length - CONTRIBUTION_SUFFIX.length);
    suffix = ` (${t('contribution')})`;
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      cleaned = getMetricLabel(parsed as QueryFormMetric);
    }
  } catch {
    /* not a JSON-encoded metric: keep the label as is */
  }

  return `${cleaned}${suffix}`;
}

/**
 * Builds Grid column definitions from query result metadata.
 * Assumes {@link colnames}, {@link coltypes} and {@link collabels}
 * have the same length and align. A missing or empty label falls back to the
 * column name. Only columns present in the first data row are included.
 */
export function useGridColumns(
  colnames: string[] | undefined,
  coltypes: GenericDataType[] | undefined,
  collabels: string[] | undefined,
  data: Record<string, any>[] | undefined,
) {
  return useMemo(() => {
    if (!colnames || !data?.length) {
      return [];
    }
    const firstRowKeys = new Set(Object.keys(data[0]));
    return colnames
      .map((column, originalIndex) => [column, originalIndex] as const)
      .filter(([column]) => firstRowKeys.has(column))
      .map(([key, originalIndex]) => {
        const colType = coltypes?.[originalIndex];
        const headerLabel = formatColumnHeader(
          collabels?.[originalIndex] || key,
        );

        return {
          label: key,
          headerName: headerLabel,
          render: ({ value }: { value: unknown }) => {
            if (value === true) {
              return Constants.BOOL_TRUE_DISPLAY;
            }
            if (value === false) {
              return Constants.BOOL_FALSE_DISPLAY;
            }
            if (value === null) {
              return (
                <span style={{ color: 'var(--ant-color-text-tertiary)' }}>
                  {Constants.NULL_DISPLAY}
                </span>
              );
            }
            if (
              colType === GenericDataType.Temporal &&
              typeof value === 'number'
            ) {
              return timeFormatter(value);
            }
            // Render string cells as plain text: this grid shows raw
            // query results (untrusted warehouse data) to any viewer,
            // so HTML must stay inert here even after sanitization.
            if (typeof value === 'string') {
              return value;
            }
            return String(value);
          },
        };
      });
  }, [colnames, data, coltypes, collabels]);
}

export function useKeywordFilter(filterText: string) {
  return useCallback(
    (node: IRowNode) => {
      if (filterText && node.data) {
        const lowerFilter = filterText.toLowerCase();
        return Object.values(node.data).some(
          (value: unknown) =>
            value != null && String(value).toLowerCase().includes(lowerFilter),
        );
      }
      return true;
    },
    [filterText],
  );
}

/**
 * Measures the height of an absolutely-positioned inner element that fills
 * its relative-positioned parent. Uses a callback ref so the ResizeObserver
 * is created when the element mounts (which may be after initial render if
 * the component conditionally renders a loading state first).
 */
export function useGridHeight(fallbackHeight = 400) {
  const [gridHeight, setGridHeight] = useState(fallbackHeight);
  const observerRef = useRef<ResizeObserver | null>(null);

  const measuredRef = useCallback((el: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const h = Math.floor(entry.contentRect.height);
        if (h > 0) {
          setGridHeight(prev => (prev !== h ? h : prev));
        }
      }
    });
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  return { gridHeight, measuredRef };
}
