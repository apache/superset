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
import rison from 'rison';
import { LayerInfo } from './types';

interface SliceResponse {
  id: number;
  slice_name: string;
  viz_type: string;
}

export const useDeckLayerMetadata = (
  sliceIds: number[],
): {
  layers: LayerInfo[];
  isLoading: boolean;
  error: string | null;
} => {
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sliceIds || sliceIds.length === 0) {
      setLayers([]);
      return;
    }

    const fetchMetadata = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const queryParams = rison.encode({
          columns: ['id', 'slice_name', 'viz_type'],
          filters: [{ col: 'id', opr: 'in', value: sliceIds }],
        });
        const endpoint = `/api/v1/chart/?q=${queryParams}`;

        const response = await SupersetClient.get({ endpoint });

        const slices: SliceResponse[] = response.json.result || [];

        const layerInfos: LayerInfo[] = slices.map(slice => ({
          sliceId: slice.id,
          name: slice.slice_name,
          type: slice.viz_type,
        }));

        setLayers(layerInfos);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');

        const fallbackLayers = sliceIds.map(id => ({
          sliceId: id,
          name: `Layer ${id}`,
          type: 'unknown',
        }));
        setLayers(fallbackLayers);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [sliceIds.join(',')]);

  return { layers, isLoading, error };
};
