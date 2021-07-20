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
import React, { useCallback, useMemo } from 'react';
import rison from 'rison';
import { t, SupersetClient } from '@superset-ui/core';
import { Select } from 'src/components';
import { cacheWrapper } from 'src/utils/cacheWrapper';
import {
  ClientErrorObject,
  getClientErrorObject,
} from 'src/utils/getClientErrorObject';
import { datasetToSelectOption } from './utils';

const PAGE_SIZE = 50;

const localCache = new Map<string, any>();

const cachedSupersetGet = cacheWrapper(
  SupersetClient.get,
  localCache,
  ({ endpoint }) => endpoint || '',
);

interface DatasetSelectProps {
  datasetDetails: Record<string, any> | undefined;
  datasetId: number;
  onChange: (value: number) => void;
  value?: { value: number | undefined };
}

const DatasetSelect = ({
  datasetDetails,
  datasetId,
  onChange,
  value,
}: DatasetSelectProps) => {
  const getErrorMessage = useCallback(
    ({ error, message }: ClientErrorObject) => {
      let errorText = message || error || t('An error has occurred');
      if (message === 'Forbidden') {
        errorText = t('You do not have permission to edit this dashboard');
      }
      return errorText;
    },
    [],
  );

  // TODO Change offset and limit to page and pageSize
  const loadDatasetOptions = async (
    search: string,
    offset: number,
    limit: number, // eslint-disable-line @typescript-eslint/no-unused-vars
  ) => {
    const searchColumn = 'table_name';
    const query = rison.encode({
      filters: [{ col: searchColumn, opr: 'ct', value: search }],
      page: Math.floor(offset / PAGE_SIZE),
      page_size: PAGE_SIZE,
      order_column: searchColumn,
      order_direction: 'asc',
    });
    return cachedSupersetGet({
      endpoint: `/api/v1/dataset/?q=${query}`,
    })
      .then(response => {
        const data: {
          label: string;
          value: string | number;
        }[] = response.json.result
          .map(datasetToSelectOption)
          .sort((a: { label: string }, b: { label: string }) =>
            a.label.localeCompare(b.label),
          );
        if (!search) {
          const found = data.find(element => element.value === datasetId);
          if (!found && datasetDetails?.table_name) {
            data.push({
              label: datasetDetails.table_name,
              value: datasetId,
            });
          }
        }
        return {
          data,
          totalCount: response.json.count,
        };
      })
      .catch(async error => {
        const errorMessage = getErrorMessage(await getClientErrorObject(error));
        throw new Error(errorMessage);
      });
  };

  return (
    <Select
      ariaLabel={t('Dataset')}
      value={value?.value}
      pageSize={PAGE_SIZE}
      options={loadDatasetOptions}
      onChange={onChange}
    />
  );
};

const MemoizedSelect = (props: DatasetSelectProps) =>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => <DatasetSelect {...props} />, []);

export default MemoizedSelect;
