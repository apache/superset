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
import { environment as environmentType } from '@apache-superset/core';
const LogLevel = environmentType.LogLevel;

const clipboard: typeof environmentType.clipboard = {
  readText: async () => {
    throw new Error('Not implemented yet');
  },
  writeText: async () => {
    throw new Error('Not implemented yet');
  },
};

const language: typeof environmentType.language = navigator.language || 'en-US';

const logLevel: typeof environmentType.logLevel = LogLevel.Info;

const onDidChangeLogLevel: typeof environmentType.onDidChangeLogLevel = () => {
  throw new Error('Not implemented yet');
};

const openExternal: typeof environmentType.openExternal = async () => {
  throw new Error('Not implemented yet');
};

const getEnvironmentVariable: typeof environmentType.getEnvironmentVariable =
  () => {
    throw new Error('Not implemented yet');
  };

export const environment: typeof environmentType = {
  clipboard,
  language,
  logLevel,
  onDidChangeLogLevel,
  openExternal,
  getEnvironmentVariable,
  LogLevel,
};
