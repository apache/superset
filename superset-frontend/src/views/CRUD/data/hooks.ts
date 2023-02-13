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
import rison from 'rison';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { DatasetObject } from 'src/views/CRUD/data/dataset/AddDataset/types';
import { DatabaseObject } from 'src/components/DatabaseSelector';

type BaseQueryObject = {
  id: number;
};

export function useQueryPreviewState<D extends BaseQueryObject = any>({
  queries,
  fetchData,
  currentQueryId,
}: {
  queries: D[];
  fetchData: (id: number) => any;
  currentQueryId: number;
}) {
  const index = queries.findIndex(query => query.id === currentQueryId);
  const [currentIndex, setCurrentIndex] = useState(index);
  const [disablePrevious, setDisablePrevious] = useState(false);
  const [disableNext, setDisableNext] = useState(false);

  function checkIndex() {
    setDisablePrevious(currentIndex === 0);
    setDisableNext(currentIndex === queries.length - 1);
  }

  function handleDataChange(previous: boolean) {
    const offset = previous ? -1 : 1;
    const index = currentIndex + offset;
    if (index >= 0 && index < queries.length) {
      fetchData(queries[index].id);
      setCurrentIndex(index);
      checkIndex();
    }
  }

  function handleKeyPress(ev: any) {
    if (currentIndex >= 0 && currentIndex < queries.length) {
      if (ev.key === 'ArrowDown' || ev.key === 'k') {
        ev.preventDefault();
        handleDataChange(false);
      } else if (ev.key === 'ArrowUp' || ev.key === 'j') {
        ev.preventDefault();
        handleDataChange(true);
      }
    }
  }

  useEffect(() => {
    checkIndex();
  });

  return {
    handleKeyPress,
    handleDataChange,
    disablePrevious,
    disableNext,
  };
}

/**
 * Retrieves all pages of dataset results
 */
export const useDatasetsList = (
  db:
    | (DatabaseObject & {
        owners: [number];
      })
    | undefined,
  schema: string | null | undefined,
) => {
  const [datasets, setDatasets] = useState<DatasetObject[]>([]);
  const encodedSchema = schema ? encodeURIComponent(schema) : undefined;

  const getDatasetsList = useCallback(async (filters: object[]) => {
    let results: DatasetObject[] = [];
    let page = 0;
    let count;

    // If count is undefined or less than results, we need to
    // asynchronously retrieve a page of dataset results
    while (count === undefined || results.length < count) {
      const queryParams = rison.encode_uri({ filters, page });
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await SupersetClient.get({
          endpoint: `/api/v1/dataset/?q=${queryParams}`,
        });

        // Reassign local count to response's count
        ({ count } = response.json);

        const {
          json: { result },
        } = response;

        results = [...results, ...result];

        page += 1;
      } catch (error) {
        addDangerToast(t('There was an error fetching dataset'));
        logging.error(t('There was an error fetching dataset'), error);
      }
    }

    setDatasets(results);
  }, []);

  useEffect(() => {
    const filters = [
      { col: 'database', opr: 'rel_o_m', value: db?.id },
      { col: 'schema', opr: 'eq', value: encodedSchema },
      { col: 'sql', opr: 'dataset_is_null_or_empty', value: true },
    ];

    if (schema) {
      getDatasetsList(filters);
    }
  }, [db?.id, schema, encodedSchema, getDatasetsList]);

  const datasetNames = datasets?.map(dataset => dataset.table_name);

  return { datasets, datasetNames };
};

export const useGetDatasetRelatedCounts = (id: string) => {
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
    // Todo: this useEffect should be used to call all count methods conncurently
    // when we populate data for the new tabs. For right separating out this
    // api call for building the usage page.
    if (id) {
      getDatasetRelatedObjects();
    }
  }, [id, getDatasetRelatedObjects]);

  return { usageCount };
};
