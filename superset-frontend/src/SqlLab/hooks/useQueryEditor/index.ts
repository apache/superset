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
import { useMemo } from 'react';
import pick from 'lodash/pick';
import { shallowEqual, useSelector } from 'react-redux';
import { SqlLabRootState, QueryEditor } from 'src/SqlLab/types';

export default function useQueryEditor<T extends keyof QueryEditor>(
  sqlEditorId: string,
  attributes: ReadonlyArray<T>,
) {
  const queryEditor = useSelector<
    SqlLabRootState,
    Pick<QueryEditor, T | 'id' | 'schema'>
  >(
    ({ sqlLab: { unsavedQueryEditor, queryEditors } }) =>
      pick(
        {
          ...queryEditors.find(({ id }) => id === sqlEditorId),
          ...(sqlEditorId === unsavedQueryEditor.id && unsavedQueryEditor),
        },
        ['id'].concat(attributes),
      ) as Pick<QueryEditor, T | 'id' | 'schema'>,
    shallowEqual,
  );
  const { schema, schemaOptions } = useSelector<
    SqlLabRootState,
    Pick<QueryEditor, 'schema' | 'schemaOptions'>
  >(
    ({ sqlLab: { unsavedQueryEditor, queryEditors } }) =>
      pick(
        {
          ...queryEditors.find(({ id }) => id === sqlEditorId),
          ...(sqlEditorId === unsavedQueryEditor.id && unsavedQueryEditor),
        },
        ['schema', 'schemaOptions'],
      ) as Pick<QueryEditor, T | 'schema' | 'schemaOptions'>,
    shallowEqual,
  );

  const schemaOptionsMap = useMemo(
    () => new Set(schemaOptions?.map(({ value }) => value)),
    [schemaOptions],
  );

  if ('schema' in queryEditor && schema && !schemaOptionsMap.has(schema)) {
    delete queryEditor.schema;
  }

  return queryEditor as Pick<QueryEditor, T | 'id'>;
}
