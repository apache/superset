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
import { SupersetClient, t } from '@superset-ui/core';
import { EmbeddedChartData } from './hydrateEmbedded';

interface State {
  data: EmbeddedChartData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the one chart this iframe renders, in the shape `hydrateEmbedded`
 * expects. Uses the explore endpoint because it returns the slice and its
 * dataset together, which is exactly the pair the fabricated dashboard state
 * needs and avoids a second round trip for the datasource.
 */
export default function useExploreData(chartId: string | number): State {
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    SupersetClient.get({
      endpoint: `/api/v1/explore/?slice_id=${chartId}`,
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
            slice: {
              ...result.slice,
              // `form_data` on the explore payload already carries the
              // datasource and viz_type the chart stack keys off.
              form_data: result.form_data ?? result.slice.form_data,
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
