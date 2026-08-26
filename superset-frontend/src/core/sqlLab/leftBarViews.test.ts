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
import { logging } from '@apache-superset/core/utils';
import {
  getLeftBarViews,
  registerLeftBarView,
  resetLeftBarViews,
} from './leftBarViews';

const trigger = () => null;
const panel = () => null;

beforeEach(() => {
  resetLeftBarViews();
});

test('getLeftBarViews returns an empty array when nothing is registered', () => {
  expect(getLeftBarViews()).toEqual([]);
});

test('registered views are returned by getLeftBarViews', () => {
  registerLeftBarView({ id: 'ext.a', name: 'A' }, trigger, panel);
  registerLeftBarView({ id: 'ext.b', name: 'B' }, trigger, panel);

  expect(getLeftBarViews()).toEqual([
    { id: 'ext.a', name: 'A' },
    { id: 'ext.b', name: 'B' },
  ]);
});

test('render order is deterministic regardless of registration order', () => {
  registerLeftBarView({ id: 'b.w', name: 'B' }, trigger, panel);
  registerLeftBarView({ id: 'a.w', name: 'A' }, trigger, panel);
  registerLeftBarView({ id: 'c.w', name: 'C', order: 1 }, trigger, panel);

  expect(getLeftBarViews().map(v => v.id)).toEqual(['c.w', 'a.w', 'b.w']);

  resetLeftBarViews();

  // Same views, registered in a different order: identical output.
  registerLeftBarView({ id: 'c.w', name: 'C', order: 1 }, trigger, panel);
  registerLeftBarView({ id: 'a.w', name: 'A' }, trigger, panel);
  registerLeftBarView({ id: 'b.w', name: 'B' }, trigger, panel);

  expect(getLeftBarViews().map(v => v.id)).toEqual(['c.w', 'a.w', 'b.w']);
});

test('ties without an explicit order sort by id', () => {
  registerLeftBarView({ id: 'z.w', name: 'Z' }, trigger, panel);
  registerLeftBarView({ id: 'm.w', name: 'M' }, trigger, panel);

  expect(getLeftBarViews().map(v => v.id)).toEqual(['m.w', 'z.w']);
});

test('an explicit order beats the default order of 100 in both directions', () => {
  registerLeftBarView({ id: 'default.w', name: 'Default' }, trigger, panel);
  registerLeftBarView({ id: 'low.w', name: 'Low', order: 1 }, trigger, panel);
  registerLeftBarView(
    { id: 'high.w', name: 'High', order: 200 },
    trigger,
    panel,
  );

  expect(getLeftBarViews().map(v => v.id)).toEqual([
    'low.w',
    'default.w',
    'high.w',
  ]);
});

test('a duplicate id is rejected: the first registration wins', () => {
  const warnSpy = jest.spyOn(logging, 'warn').mockImplementation(() => {});

  registerLeftBarView({ id: 'ext.a', name: 'First' }, trigger, panel);
  const secondDisposable = registerLeftBarView(
    { id: 'ext.a', name: 'Second' },
    trigger,
    panel,
  );

  expect(getLeftBarViews()).toEqual([{ id: 'ext.a', name: 'First' }]);
  expect(warnSpy).toHaveBeenCalledTimes(1);

  // Disposing the rejected registration must not remove the winner.
  secondDisposable.dispose();
  expect(getLeftBarViews()).toEqual([{ id: 'ext.a', name: 'First' }]);

  warnSpy.mockRestore();
});

test('dispose removes the view; a second dispose is a no-op', () => {
  const disposable = registerLeftBarView(
    { id: 'ext.a', name: 'A' },
    trigger,
    panel,
  );

  expect(getLeftBarViews()).toHaveLength(1);

  disposable.dispose();
  expect(getLeftBarViews()).toEqual([]);

  expect(() => disposable.dispose()).not.toThrow();
  expect(getLeftBarViews()).toEqual([]);
});

test('dispose after resetLeftBarViews does not throw or resurrect the view', () => {
  const disposable = registerLeftBarView(
    { id: 'ext.a', name: 'A' },
    trigger,
    panel,
  );

  resetLeftBarViews();
  expect(() => disposable.dispose()).not.toThrow();
  expect(getLeftBarViews()).toEqual([]);
});

test('getLeftBarViews returns a defensive copy', () => {
  registerLeftBarView({ id: 'ext.a', name: 'A' }, trigger, panel);

  const first = getLeftBarViews();
  first.push({ id: 'ext.injected', name: 'Injected' });

  expect(getLeftBarViews()).toEqual([{ id: 'ext.a', name: 'A' }]);
});
