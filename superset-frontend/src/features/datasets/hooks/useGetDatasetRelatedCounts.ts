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
import { useState, useEffect, useCallback } from 'react';
import { SupersetClient, logging, t } from '@superset-ui/core';
import { addDangerToast } from 'src/components/MessageToasts/actions';

const useGetDatasetRelatedCounts = (id: string) => {
  const [usageCount, setUsageCount] = useState(0);

  const getDatasetRelatedObjects = useCallback(
    () =>
      SupersetClient.get({
        endpoint: `/api/v1/dataset/${id}/related_objects`,
      })
        .then(({ json }) => {
          setUsageCount(json?.charts.count);
        })
        .catch(error => {
          addDangerToast(
            t(`There was an error fetching dataset's related objects`),
          );
          logging.error(error);
        }),
    [id],
  );

  useEffect(() => {
    // Todo: this useEffect should be used to call all count methods concurrently
    // when we populate data for the new tabs. For right separating out this
    // api call for building the usage page.
    if (id) {
      getDatasetRelatedObjects();
    }
  }, [id, getDatasetRelatedObjects]);

  return { usageCount };
};

export default useGetDatasetRelatedCounts;
