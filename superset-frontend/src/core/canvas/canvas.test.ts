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
import { canvas, setActiveCanvas } from 'src/core';

const Kpi = () => null;

afterEach(() => setActiveCanvas(undefined));

test('widget renderers register and unregister by type', () => {
  const registration = canvas.registerWidgetRenderer('test.kpi', Kpi);

  expect(canvas.getWidgetRenderer('test.kpi')).toBe(Kpi);

  registration.dispose();

  expect(canvas.getWidgetRenderer('test.kpi')).toBeUndefined();
});

test('disposing a replaced renderer keeps the newer one', () => {
  const Other = () => null;
  const first = canvas.registerWidgetRenderer('test.kpi', Kpi);
  const second = canvas.registerWidgetRenderer('test.kpi', Other);

  first.dispose();

  expect(canvas.getWidgetRenderer('test.kpi')).toBe(Other);
  second.dispose();
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
