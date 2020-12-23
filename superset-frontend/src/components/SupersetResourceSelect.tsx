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
import React, { useEffect } from 'react';
import rison from 'rison';
import { SupersetClient } from '@superset-ui/core';
import { AsyncSelect } from 'src/components/Select';
import {
  ClientErrorObject,
  getClientErrorObject,
} from 'src/utils/getClientErrorObject';
import { cacheWrapper } from 'src/utils/cacheWrapper';

export type Value<V> = { value: V; label: string };

export interface SupersetResourceSelectProps<T = unknown, V = string> {
  value?: Value<V> | null;
  initialId?: number | string;
  onChange?: (value: Value<V>) => void;
  isMulti?: boolean;
  searchColumn?: string;
  resource?: string; // e.g. "dataset", "dashboard/related/owners"
  transformItem?: (item: T) => Value<V>;
  onError: (error: ClientErrorObject) => void;
}

/**
 * This is a special-purpose select component for when you're selecting
 * items from one of the standard Superset resource APIs.
 * Such as selecting a datasource, a chart, or users.
 *
 * If you're selecting a "related" resource (such as dashboard/related/owners),
 * leave the searchColumn prop unset.
 * The api doesn't do columns on related resources for some reason.
 *
 * If you're doing anything more complex than selecting a standard resource,
 * we'll all be better off if you use AsyncSelect directly instead.
 */

const localCache = new Map<string, any>();

const cachedSupersetGet = cacheWrapper(
  SupersetClient.get,
  localCache,
  ({ endpoint }) => endpoint || '',
);

export default function SupersetResourceSelect<T, V>({
  value,
  initialId,
  onChange,
  isMulti,
  resource,
  searchColumn,
  transformItem,
  onError,
}: SupersetResourceSelectProps<T, V>) {
  useEffect(() => {
    if (initialId == null) return;
    cachedSupersetGet({
      endpoint: `/api/v1/${resource}/${initialId}`,
    }).then(response => {
      const { result } = response.json;
      const value = transformItem ? transformItem(result) : result;
      if (onChange) onChange(value);
    });
  }, [resource, initialId]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadOptions(input: string) {
    const query = searchColumn
      ? rison.encode({
          filters: [{ col: searchColumn, opr: 'ct', value: input }],
        })
      : rison.encode({ filter: value });
    return cachedSupersetGet({
      endpoint: `/api/v1/${resource}/?q=${query}`,
    }).then(
      response => {
        return response.json.result
          .map(transformItem)
          .sort((a: Value<V>, b: Value<V>) => a.label.localeCompare(b.label));
      },
      async badResponse => {
        onError(await getClientErrorObject(badResponse));
        return [];
      },
    );
  }

  return (
    <AsyncSelect
      value={value}
      onChange={onChange}
      isMulti={isMulti}
      loadOptions={loadOptions}
      defaultOptions // load options on render
      cacheOptions
      filterOption={null} // options are filtered at the api
    />
  );
}
