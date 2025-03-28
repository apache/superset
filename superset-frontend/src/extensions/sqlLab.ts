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
import { Disposable } from '@apache-superset/primitives';
import { core } from '@apache-superset/types';
import {
  QUERY_FAILED,
  QUERY_SUCCESS,
  querySuccess,
} from 'src/SqlLab/actions/sqlLab';
import { createActionListener } from './utils';

// TODO: Refactor to return all needed parameters. Add them to the interface.
export const onDidQueryRun: core.Event<string> = (
  listener: (e: string) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    QUERY_SUCCESS,
    listener,
    (action: ReturnType<typeof querySuccess>) => action.query.sql,
    thisArgs,
  );

export const onDidQueryFail: core.Event<string> = (
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
};
