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
import { sqlLab as sqlLabType } from '@apache-superset/core';
import {
  QUERY_FAILED,
  QUERY_SUCCESS,
  querySuccess,
} from 'src/SqlLab/actions/sqlLab';
import { RootState } from 'src/views/store';
import { Disposable, Editor } from './core';
import { createActionListener } from './utils';

// TODO: Refactor to return all needed parameters. Add them to the interface.
export const onDidQueryRun: typeof sqlLabType.onDidQueryRun = (
  listener: (editor: sqlLabType.Editor) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    QUERY_SUCCESS,
    listener,
    (action: ReturnType<typeof querySuccess>, state: RootState) => {
      const { query } = action;
      const { dbId, catalog, schema, sql } = query;
      return new Editor(sql, dbId, catalog, schema);
    },
    thisArgs,
  );

export const onDidQueryFail: typeof sqlLabType.onDidQueryFail = (
  listener: (e: string) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    QUERY_FAILED,
    listener,
    (action: {
      type: string;
      query: any;
      msg: string;
      link: any;
      errors: any;
    }) => action.msg,
    thisArgs,
  );

// TODO: This will monitor multiple Redux actions.
export const onDidChangeEditorDatabase: typeof sqlLabType.onDidChangeEditorDatabase =
  (listener: (e: number) => void, thisArgs?: any): Disposable =>
    createActionListener(
      'QUERY_EDITOR_SETDB',
      listener,
      (action: { type: string; queryEditor: { dbId: number } }) =>
        action.queryEditor.dbId,
    );

// TODO: Make it typeof sqlLabType
export const sqlLab = {
  databases: [
    {
      name: 'database1',
    },
    {
      name: 'database2',
    },
    {
      name: 'database3',
    },
  ],
  onDidQueryRun,
  onDidQueryFail,
  onDidChangeEditorDatabase,
};
