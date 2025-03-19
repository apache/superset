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
import { useCallback, useMemo, ReactNode } from 'react';
import rison from 'rison';
import {
  t,
  JsonResponse,
  ClientErrorObject,
  getClientErrorObject,
} from '@superset-ui/core';
import { AsyncSelect } from 'src/components';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import {
  Dataset,
  DatasetSelectLabel,
} from 'src/features/datasets/DatasetSelectLabel';

interface DatasetSelectProps {
  onChange: (value: { label: string; value: number }) => void;
  value?: { label: string; value: number };
}

const DatasetSelect = ({ onChange, value }: DatasetSelectProps) => {
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

  const loadDatasetOptions = async (
    search: string,
    page: number,
    pageSize: number,
  ) => {
    const query = rison.encode({
      columns: ['id', 'table_name', 'database.database_name', 'schema'],
      filters: [{ col: 'table_name', opr: 'ct', value: search }],
      page,
      page_size: pageSize,
      order_column: 'table_name',
      order_direction: 'asc',
    });
    return cachedSupersetGet({
      endpoint: `/api/v1/dataset/?q=${query}`,
    })
      .then((response: JsonResponse) => {
        const list: {
          customLabel: ReactNode;
          label: string;
          value: string | number;
        }[] = response.json.result.map((item: Dataset) => ({
          customLabel: DatasetSelectLabel(item),
          label: item.table_name,
          value: item.id,
        }));
        return {
          data: list,
          totalCount: response.json.count,
        };
      })
      .catch(async error => {
        const errorMessage = getErrorMessage(await getClientErrorObject(error));
        throw new Error(errorMessage);
      });
  };

  return (
    <AsyncSelect
      ariaLabel={t('Dataset')}
      value={value}
      options={loadDatasetOptions}
      onChange={onChange}
      notFoundContent={t('No compatible datasets found')}
      placeholder={t('Select a dataset')}
    />
  );
};

const MemoizedSelect = (props: DatasetSelectProps) =>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => <DatasetSelect {...props} />, []);

export default MemoizedSelect;
