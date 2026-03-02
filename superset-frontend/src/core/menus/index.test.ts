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
import { menus } from './index';

const disposables: Array<{ dispose: () => void }> = [];

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
});

test('register stores a menu item', () => {
  disposables.push(
    menus.registerMenuItem(
      { command: 'ext.export', view: 'builtin.editor' },
      'sqllab.editor',
      'secondary',
    ),
  );

  const contributions = menus.getMenu('sqllab.editor');
  expect(contributions).toBeDefined();
  expect(contributions?.secondary).toEqual([
    { view: 'builtin.editor', command: 'ext.export' },
  ]);
});

test('getMenu returns undefined for unknown location', () => {
  expect(menus.getMenu('nonexistent')).toBeUndefined();
});

test('groups menu items by group field', () => {
  disposables.push(
    menus.registerMenuItem(
      { command: 'ext.primary_action', view: 'builtin.editor' },
      'sqllab.editor',
      'primary',
    ),
    menus.registerMenuItem(
      { command: 'ext.secondary_action', view: 'builtin.editor' },
      'sqllab.editor',
      'secondary',
    ),
    menus.registerMenuItem(
      { command: 'ext.context_action', view: 'builtin.editor' },
      'sqllab.editor',
      'context',
    ),
  );

  const contributions = menus.getMenu('sqllab.editor');
  expect(contributions?.primary).toHaveLength(1);
  expect(contributions?.secondary).toHaveLength(1);
  expect(contributions?.context).toHaveLength(1);
  expect(contributions?.primary?.[0].command).toBe('ext.primary_action');
  expect(contributions?.secondary?.[0].command).toBe('ext.secondary_action');
  expect(contributions?.context?.[0].command).toBe('ext.context_action');
});

test('multiple items in the same group are accumulated', () => {
  disposables.push(
    menus.registerMenuItem(
      { command: 'ext.action1', view: 'builtin.editor' },
      'sqllab.editor',
      'secondary',
    ),
    menus.registerMenuItem(
      { command: 'ext.action2', view: 'builtin.editor' },
      'sqllab.editor',
      'secondary',
    ),
  );

  const contributions = menus.getMenu('sqllab.editor');
  expect(contributions?.secondary).toHaveLength(2);
});

test('items at different locations are independent', () => {
  disposables.push(
    menus.registerMenuItem(
      { command: 'ext.action1', view: 'builtin.editor' },
      'sqllab.editor',
      'primary',
    ),
    menus.registerMenuItem(
      { command: 'ext.action2', view: 'builtin.results' },
      'sqllab.results',
      'primary',
    ),
  );

  expect(menus.getMenu('sqllab.editor')?.primary).toHaveLength(1);
  expect(menus.getMenu('sqllab.results')?.primary).toHaveLength(1);
});

test('dispose removes the menu registration', () => {
  const disposable = menus.registerMenuItem(
    { command: 'ext.export', view: 'builtin.editor' },
    'sqllab.editor',
    'secondary',
  );

  expect(menus.getMenu('sqllab.editor')).toBeDefined();

  disposable.dispose();

  expect(menus.getMenu('sqllab.editor')).toBeUndefined();
});
