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

import { SupersetClient, t } from '@superset-ui/core';
import Tag from 'src/types/TagType';

import rison from 'rison';
import { cacheWrapper } from 'src/utils/cacheWrapper';
import {
  ClientErrorObject,
  getClientErrorObject,
} from 'src/utils/getClientErrorObject';

const localCache = new Map<string, any>();

const cachedSupersetGet = cacheWrapper(
  SupersetClient.get,
  localCache,
  ({ endpoint }) => endpoint || '',
);

type SelectTagsValue = {
  value: string | number | undefined;
  label: string;
  key: string | number | undefined;
};

export const tagToSelectOption = (
  item: Tag & { table_name: string },
): SelectTagsValue => ({
  value: item.name,
  label: item.name,
  key: item.id,
});

export const loadTags = async (
  search: string,
  page: number,
  pageSize: number,
) => {
  const searchColumn = 'name';
  const query = rison.encode({
    filters: [{ col: searchColumn, opr: 'ct', value: search }],
    page,
    page_size: pageSize,
    order_column: searchColumn,
    order_direction: 'asc',
  });

  const getErrorMessage = ({ error, message }: ClientErrorObject) => {
    let errorText = message || error || t('An error has occurred');
    if (message === 'Forbidden') {
      errorText = t('You do not have permission to read tags');
    }
    return errorText;
  };

  return cachedSupersetGet({
    endpoint: `/api/v1/tag/?q=${query}`,
  })
    .then(response => {
      const data: {
        label: string;
        value: string | number;
      }[] = response.json.result
        .filter((item: Tag & { table_name: string }) => item.type === 1)
        .map(tagToSelectOption);
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
