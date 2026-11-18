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
import {
  canvas,
  registerBuiltinWidgetRenderer,
  setActiveCanvas,
} from 'src/core';

const Kpi = () => null;

afterEach(() => setActiveCanvas(undefined));

test('widget renderers register and unregister by type', () => {
  const registration = canvas.registerWidgetRenderer('test.kpi', Kpi);

  expect(canvas.getWidgetRenderer('test.kpi')).toBe(Kpi);

  registration.dispose();

  expect(canvas.getWidgetRenderer('test.kpi')).toBeUndefined();
});

test('a widget type that has a renderer refuses another', () => {
  const Other = () => null;
  const first = canvas.registerWidgetRenderer('test.kpi', Kpi);

  expect(() => canvas.registerWidgetRenderer('test.kpi', Other)).toThrow(
    'Widget type "test.kpi" already has a renderer',
  );
  expect(canvas.getWidgetRenderer('test.kpi')).toBe(Kpi);

  // Once its renderer is disposed, the type takes another.
  first.dispose();
  const second = canvas.registerWidgetRenderer('test.kpi', Other);
  expect(canvas.getWidgetRenderer('test.kpi')).toBe(Other);
  second.dispose();
});

test('an extension cannot take a built-in type, before the canvas loads too', () => {
  const Builtin = () => null;

  // Extensions load at startup; the built-ins once the Canvas page does.
  expect(() => canvas.registerWidgetRenderer('echarts', Kpi)).toThrow(
    'Widget type "echarts" is built in',
  );
  const builtin = registerBuiltinWidgetRenderer('echarts', Builtin);

  expect(canvas.getWidgetRenderer('echarts')).toBe(Builtin);
  builtin.dispose();
});

test('registering the same renderer again is allowed', () => {
  const first = canvas.registerWidgetRenderer('test.kpi', Kpi);
  const again = canvas.registerWidgetRenderer('test.kpi', Kpi);

  expect(canvas.getWidgetRenderer('test.kpi')).toBe(Kpi);
  again.dispose();
  first.dispose();
});

test('active canvas changes fire only when something changed', () => {
  const listener = jest.fn();
  const subscription = canvas.onDidChangeActiveCanvas(listener);
  const open = { id: 1, title: 'Exec overview', revision: 2 };

  setActiveCanvas(open);
  setActiveCanvas({ ...open });
  setActiveCanvas({ ...open, revision: 3 });
  setActiveCanvas(undefined);

  expect(listener.mock.calls).toEqual([
    [open],
    [{ ...open, revision: 3 }],
    [undefined],
  ]);
  expect(canvas.getActiveCanvas()).toBeUndefined();
  subscription.dispose();
});
