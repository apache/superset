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
import React from 'react';
import rison from 'rison';
import { t, SupersetClient } from '@superset-ui/core';
import { AsyncSelect } from 'src/components/Select';
import { useToasts } from 'src/messageToasts/enhancers/withToasts';
import getClientErrorObject from 'src/utils/getClientErrorObject';

export type Value<V> = { value: V; label: string };

export interface SupersetResourceSelectProps<T = unknown, V = string> {
  value?: Value<V> | null;
  onChange?: (value: Value<V>) => void;
  isMulti?: boolean;
  searchColumn?: string;
  resource: string; // e.g. "dataset", "dashboard/related/owners"
  transformItem: (item: T) => Value<V>;
}

/**
 * This is a special-purpose select component for when you're selecting
 * items from one of the standard Superset resource APIs.
 * Such as selecting a datasource, a chart, or users.
 *
 * If you're selecting a "related" resource, leave the searchColumn prop unset.
 * The api doesn't do columns on related resources for some reason.
 *
 * If you're doing anything more complex than selecting a standard resource,
 * we'll all be better off if you use AsyncSelect directly instead.
 */
export default function SupersetResourceSelect<T = unknown, V = string>({
  value,
  onChange,
  isMulti,
  resource,
  searchColumn,
  transformItem,
}: SupersetResourceSelectProps<T, V>) {
  const { addDangerToast } = useToasts();
  function loadOptions(input: string) {
    const query = searchColumn
      ? rison.encode({
          filters: [{ col: searchColumn, opr: 'ct', value: input }],
        })
      : rison.encode({ filter: value });
    return SupersetClient.get({
      endpoint: `/api/v1/${resource}/?q=${query}`,
    }).then(
      response => {
        return response.json.result.map(transformItem);
      },
      async badResponse => {
        const { error, message } = await getClientErrorObject(badResponse);
        let errorText = message || error || t('An error has occurred');
        if (message === 'Forbidden') {
          errorText = t('You do not have permission to edit this dashboard');
        }
        addDangerToast(errorText);
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
