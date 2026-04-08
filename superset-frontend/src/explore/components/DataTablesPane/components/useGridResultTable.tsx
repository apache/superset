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
import { getTimeFormatter, safeHtmlSpan, TimeFormats } from '@superset-ui/core';
import { Constants } from '@superset-ui/core/components';
import { GenericDataType } from '@apache-superset/core/common';
import type { IRowNode } from 'ag-grid-community';

const timeFormatter = getTimeFormatter(TimeFormats.DATABASE_DATETIME);

export function useGridColumns(
  colnames: string[] | undefined,
  coltypes: GenericDataType[] | undefined,
  data: Record<string, any>[] | undefined,
  columnDisplayNames?: Record<string, string>,
) {
  return useMemo(
    () =>
      colnames && data?.length
        ? colnames
            .filter((column: string) => Object.keys(data[0]).includes(column))
            .map((key, index) => {
              const colType = coltypes?.[index];
              const headerLabel = columnDisplayNames?.[key] ?? key;
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
                  if (typeof value === 'string') {
                    return safeHtmlSpan(value);
                  }
                  return String(value);
                },
              };
            })
        : [],
    [colnames, data, coltypes, columnDisplayNames],
  );
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

  const measuredRef = useCallback(
    (el: HTMLDivElement | null) => {
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
    },
    [],
  );

  return { gridHeight, measuredRef };
}
