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
import { useEffect, useState } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { DataBinding, fetchRows, withFilters } from './echarts/chartData';
import type { DataRow } from './echarts/resolveBindings';

export interface WidgetRows {
  rows: DataRow[];
  loading: boolean;
  error?: string;
}

/**
 * Rows for a widget's `dataBinding`, narrowed by the filter values that
 * reach it and refetched on refresh. A widget without a binding gets none.
 */
export function useWidgetRows(
  bound: DataBinding | undefined,
  filters: canvasApi.FilterValue[],
  refreshKey: number,
): WidgetRows {
  const binding = bound?.datasetId ? withFilters(bound, filters) : undefined;
  const bindingKey = JSON.stringify(binding ?? null);
  const [state, setState] = useState<WidgetRows>({
    rows: [],
    loading: Boolean(binding),
  });

  useEffect(() => {
    if (!binding) {
      setState({ rows: [], loading: false });
      return undefined;
    }
    let cancelled = false;
    setState(previous => ({ ...previous, loading: true }));
    fetchRows(binding)
      .then(rows => {
        if (!cancelled) setState({ rows, loading: false });
      })
      .catch(e => {
        if (!cancelled) {
          setState({
            rows: [],
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // The key stands in for the binding, which is recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingKey, refreshKey]);

  return state;
}
