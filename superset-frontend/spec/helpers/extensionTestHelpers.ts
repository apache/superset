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
import type { ReactElement } from 'react';
import { views, menus, commands } from 'src/core';
import { resetContributions } from 'src/core/commands';

const disposables: Array<{ dispose: () => void }> = [];

/**
 * Cleans up all tracked extension registrations (views, menus, commands).
 * Call in afterEach to prevent state leaks between tests.
 */
export const cleanupExtensions = () => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
  resetContributions();
};

/**
 * Registers a test view at a given location and tracks it for cleanup.
 */
export const registerTestView = (
  location: string,
  id: string,
  name: string,
  provider: () => ReactElement,
) => {
  const disposable = views.registerView({ id, name }, location, provider);
  disposables.push(disposable);
  return disposable;
};

/**
 * Registers a toolbar action (command + menu item) and tracks both for cleanup.
 * Primary actions require an icon to render in PanelToolbar.
 */
export const registerToolbarAction = (
  viewId: string,
  commandId: string,
  title: string,
  callback: () => void,
  group: 'primary' | 'secondary' = 'primary',
) => {
  const cmdDisposable = commands.registerCommand(
    { id: commandId, title, icon: 'FileOutlined' },
    callback,
  );
  const menuDisposable = menus.registerMenuItem(
    { command: commandId, view: `test-view-${commandId}` },
    viewId,
    group,
  );
  disposables.push(cmdDisposable, menuDisposable);
};
