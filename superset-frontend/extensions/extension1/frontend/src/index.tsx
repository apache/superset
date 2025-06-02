/*
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

// eslint-disable-next-line no-restricted-syntax
import React from 'react';
import { commands, core } from '@apache-superset/core';
import Component from './Component';
import { formatDatabase } from './formatter';
import { Extension1API } from './publicAPI';
import { copy_query, clear, prettify, refresh } from './commands';

const disposables: core.Disposable[] = [];

export const activate = () => {
  core.registerView('extension1.component', <Component />);

  disposables.push(
    commands.registerCommand('extension1.copy_query', copy_query),
    commands.registerCommand('extension1.clear', clear),
    commands.registerCommand('extension1.prettify', prettify),
    commands.registerCommand('extension1.refresh', refresh),
  );

  return {
    formatDatabase,
  } as Extension1API;
};

export const deactivate = () => {
  disposables.forEach(disposable => disposable.dispose());
  disposables.length = 0;
};
