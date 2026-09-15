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
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { EmbeddedChartData } from './hydrateEmbedded';

interface State {
  data: EmbeddedChartData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the one chart this iframe renders, in the shape `hydrateEmbedded`
 * expects: the slice and its dataset together, which is exactly the pair the
 * fabricated dashboard state needs.
 *
 * It reads them from the chart's own embedded-context endpoint rather than from
 * `/api/v1/explore/`. Explore sits under its own `Explore` permission, which an
 * embedded guest role does not hold, so a guest token would get a 403 and the
 * page would dead-end in its error state. This endpoint sits under the `Chart`
 * permission the guest already needs for `/api/v1/chart/data`, and it resolves
 * one fixed chart instead of assembling a payload from request-supplied form
 * data, which keeps the guest's reachable surface to what the embed needs.
 */
export default function useEmbeddedChartData(chartId: string | number): State {
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    SupersetClient.get({
      endpoint: `/api/v1/chart/${chartId}/embedded_context`,
    })
      .then(({ json }) => {
        if (cancelled) return;
        const result = json?.result;
        if (!result?.slice || !result?.dataset) {
          setState({
            data: null,
            loading: false,
            error: t('The chart could not be loaded.'),
          });
          return;
        }
        setState({
          data: {
            // `form_data` on the payload already carries the datasource and
            // viz_type the chart stack keys off.
            slice: {
              ...result.slice,
              // The payload identifies the chart as `id`; the rest of the
              // embedded chart stack keys off `slice_id`.
              slice_id: Number(chartId),
            },
            dataset: result.dataset,
          },
          loading: false,
          error: null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          data: null,
          loading: false,
          error: t('The chart could not be loaded.'),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [chartId]);

  return state;
}
