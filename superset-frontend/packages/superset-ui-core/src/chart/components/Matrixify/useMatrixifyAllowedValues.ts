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

import { useEffect, useMemo, useState } from 'react';
import { SupersetClient } from '../../..';
import { getMatrixifyConfig, MatrixifyFormData } from '../../types/matrixify';

export type MatrixifyAllowedValuesStatus = 'success' | 'loading' | 'error';

export interface MatrixifyAllowedValuesState {
  status: MatrixifyAllowedValuesStatus;
  /**
   * Map of dimension column name -> set of string-normalized values the
   * current viewer is allowed to see (RLS applied by the backend).
   */
  allowedByColumn: Record<string, Set<string>>;
}

/**
 * Collect the distinct dimension columns referenced by the matrixify axes.
 */
function getDimensionColumns(formData: MatrixifyFormData): string[] {
  const config = getMatrixifyConfig(formData as any);
  if (!config) {
    return [];
  }
  const columns = new Set<string>();
  [config.rows, config.columns].forEach(axis => {
    if (axis.mode === 'dimensions' && axis.dimension?.dimension) {
      columns.add(axis.dimension.dimension);
    }
  });
  return Array.from(columns);
}

/**
 * Fetch the distinct values a viewer is permitted to see for a column. This
 * reuses the datasource ``/column/<col>/values/`` endpoint, which applies the
 * requesting user's row-level security filters server-side.
 */
async function fetchAllowedValues(
  datasource: string,
  column: string,
  signal: AbortSignal,
): Promise<any[]> {
  const [id, type] = String(datasource).split('__');
  const endpoint = `/api/v1/datasource/${type}/${id}/column/${encodeURIComponent(
    column,
  )}/values/`;
  const { json } = await SupersetClient.get({ endpoint, signal });
  return json?.result || [];
}

/**
 * Resolve, per render, which dimension values the current viewer is allowed to
 * see. Matrixify axis values are frozen into ``formData`` at design time, so
 * without this the grid would be built from the chart author's RLS context and
 * leak values (as subplot headers + empty cells) to restricted viewers. The
 * renderer intersects the stored values against the returned allow-list.
 *
 * Fails closed: while loading the grid must not render, and on error the
 * allow-list is treated as empty rather than falling back to the unfiltered
 * (leaking) list.
 */
export function useMatrixifyAllowedValues(
  formData: MatrixifyFormData,
): MatrixifyAllowedValuesState {
  const datasource = (formData as any)?.datasource as string | undefined;
  // Serialize the dimension columns to a primitive key. ``formData`` is a fresh
  // object on most renders, so the effect must depend on this stable string
  // rather than the (always-new) array, otherwise it would refetch in a loop.
  const columnsKey = useMemo(
    () => JSON.stringify([...getDimensionColumns(formData)].sort()),
    [formData],
  );

  const [state, setState] = useState<MatrixifyAllowedValuesState>({
    status: columnsKey === '[]' ? 'success' : 'loading',
    allowedByColumn: {},
  });

  useEffect(() => {
    const dimensionColumns: string[] = JSON.parse(columnsKey);

    // Metrics-only matrixify has no dimension axes: nothing to resolve.
    if (dimensionColumns.length === 0) {
      setState({ status: 'success', allowedByColumn: {} });
      return undefined;
    }

    if (!datasource) {
      setState({ status: 'error', allowedByColumn: {} });
      return undefined;
    }

    const controller = new AbortController();
    setState(prev => ({ ...prev, status: 'loading' }));

    (async () => {
      try {
        const results = await Promise.all(
          dimensionColumns.map(column =>
            fetchAllowedValues(datasource, column, controller.signal).then(
              values => [column, values] as const,
            ),
          ),
        );
        if (controller.signal.aborted) {
          return;
        }
        const allowedByColumn: Record<string, Set<string>> = {};
        results.forEach(([column, values]) => {
          allowedByColumn[column] = new Set(values.map(v => String(v)));
        });
        setState({ status: 'success', allowedByColumn });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ status: 'error', allowedByColumn: {} });
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [datasource, columnsKey]);

  return state;
}
