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
import { useState, useEffect } from 'react';
import { makeApi, t } from '@superset-ui/core';

export interface ExploreResponse {
  result: {
    slice: {
      slice_id: number;
      slice_url: string;
      slice_name: string;
      form_data: {
        viz_type: string;
        datasource: any;
        [key: string]: any;
      };
      description: string;
      description_markeddown: string;
      owners: any[];
      modified: string;
      changed_on: string;
    };
    dataset: {
      uid: string;
      [key: string]: any;
    };
  };
}

const useExploreData = (sliceId: number) => {
  const [data, setData] = useState<ExploreResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await makeApi<{}, ExploreResponse>({
          method: 'GET',
          endpoint: 'api/v1/explore/',
        })(new URLSearchParams({ slice_id: String(sliceId) }));

        setData(response);
      } catch (err) {
        setError(t('Failed to load explore data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [sliceId]);

  return { data, isLoading, error };
};

export default useExploreData;
