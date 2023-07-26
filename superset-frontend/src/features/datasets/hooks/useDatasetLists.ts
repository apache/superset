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
import { useState, useEffect, useCallback, useMemo } from 'react';
import { SupersetClient, logging, t } from '@superset-ui/core';
import rison from 'rison';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { DatasetObject } from 'src/features/datasets/AddDataset/types';
import { DatabaseObject } from 'src/components/DatabaseSelector';

/**
 * Retrieves all pages of dataset results
 */
const useDatasetsList = (
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

  const datasetNames = useMemo(
    () => datasets?.map(dataset => dataset.table_name),
    [datasets],
  );

  return { datasets, datasetNames };
};

export default useDatasetsList;
