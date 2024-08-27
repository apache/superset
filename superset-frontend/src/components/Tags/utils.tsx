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

import {
  ClientErrorObject,
  getClientErrorObject,
  SupersetClient,
  t,
} from '@superset-ui/core';
import Tag from 'src/types/TagType';

import rison from 'rison';
import { cacheWrapper } from 'src/utils/cacheWrapper';

const localCache = new Map<string, any>();

const cachedSupersetGet = cacheWrapper(
  SupersetClient.get,
  localCache,
  ({ endpoint }) => endpoint || '',
);

type SelectTagsValue = {
  value: number | undefined;
  label: string | undefined;
  key: number | undefined;
};

export const tagToSelectOption = (
  tag: Tag & { table_name: string },
): SelectTagsValue => ({
  value: tag.id,
  label: tag.name,
  key: tag.id,
});

export const loadTags = async (
  search: string,
  page: number,
  pageSize: number,
) => {
  const searchColumn = 'name';
  const query = rison.encode({
    filters: [
      { col: searchColumn, opr: 'ct', value: search },
      { col: 'type', opr: 'custom_tag', value: true },
    ],
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
      }[] = response.json.result.map(tagToSelectOption);
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
