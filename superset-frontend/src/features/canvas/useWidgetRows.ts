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
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { getClientErrorObject } from '@superset-ui/core';
import {
  DataBinding,
  fetchPlacementData,
  PlacementData,
  runtimeFilters,
} from './echarts/chartData';

/** The draft a canvas page shows, if any; its placements read from it. */
export const CanvasDraftContext = createContext<string | undefined>(undefined);

export interface WidgetRows extends PlacementData {
  loading: boolean;
  error?: string;
  /** The binding's dataset as `<id>__table`, for opening it elsewhere. */
  datasource?: string;
}

/**
 * A placement's rows, queried on the server from its stored `dataBinding`,
 * narrowed by the filter values that reach it and refetched on refresh. A
 * widget without a binding gets none.
 */
export function useWidgetRows(
  {
    canvasId,
    nodeId,
    props,
  }: Pick<canvasApi.CanvasWidgetProps, 'canvasId' | 'nodeId' | 'props'>,
  filters: canvasApi.FilterValue[],
  refreshKey: number,
): WidgetRows {
  const draftToken = useContext(CanvasDraftContext);
  const binding = props?.dataBinding as DataBinding | undefined;
  const bound = Boolean(binding?.datasetId);
  const selected = runtimeFilters(filters);
  // The binding is in the key so an edit refetches; the server reads it from
  // the stored definition.
  const key = JSON.stringify([binding ?? null, selected, draftToken ?? null]);
  const [state, setState] = useState<WidgetRows>({
    rows: [],
    loading: bound,
  });

  useEffect(() => {
    if (!bound) {
      setState({ rows: [], loading: false });
      return undefined;
    }
    let cancelled = false;
    setState(previous => ({ ...previous, loading: true }));
    fetchPlacementData({
      canvasId,
      placementId: nodeId,
      draftToken,
      filters: selected,
    })
      .then(data => {
        if (!cancelled) setState({ ...data, loading: false });
      })
      .catch(async e => {
        if (cancelled) return;
        const { error } = await getClientErrorObject(e);
        if (!cancelled) {
          setState({ rows: [], loading: false, error: error ?? String(e) });
        }
      });
    return () => {
      cancelled = true;
    };
    // The key stands in for the binding and filters, recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, nodeId, key, refreshKey]);

  const datasource = bound ? `${binding?.datasetId}__table` : undefined;
  // Stable between renders, so callers can depend on it in effects.
  return useMemo(() => ({ ...state, datasource }), [state, datasource]);
}
