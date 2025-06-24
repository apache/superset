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
import { Disposable, Editor, Tab } from './core';
import { createActionListener } from './utils';

// TODO: Refactor to return all needed parameters. Add them to the interface.
export const onDidQueryRun: typeof sqlLabType.onDidQueryRun = (
  listener: (e: string) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    QUERY_SUCCESS,
    listener,
    (action: ReturnType<typeof querySuccess>) => action.query.sql,
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
export const onDidChangeTabState: typeof sqlLabType.onDidChangeTabState = (
  listener: (e: Tab) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    'QUERY_EDITOR_SETDB',
    listener,
    (action: { type: string; dbId: number }, state: RootState) => {
      const { sqlLab } = state;
      const { databases, queryEditors, lastUpdatedActiveTab } = sqlLab;
      const activeEditor = queryEditors.find(
        (editor: { id: string }) => editor.id === lastUpdatedActiveTab,
      );
      const database = databases[action.dbId];
      const editor = new Editor(activeEditor.sql, {
        ...database,
        name: database.database_name,
      });
      return new Tab(lastUpdatedActiveTab, activeEditor.name, editor);
    },
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
  onDidChangeTabState,
};
