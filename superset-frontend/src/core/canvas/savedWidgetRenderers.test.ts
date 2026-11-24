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
import { canvas, getWidgetRenderer } from 'src/core';
import { getSavedWidgetRenderer } from './savedWidgetRenderers';

const OnItsOwn = () => null;

test('saved widget renderers register apart from canvas renderers', () => {
  const Placed = () => null;
  const placed = canvas.registerWidgetRenderer('test.kpi', Placed);
  const saved = canvas.registerSavedWidgetRenderer('test.kpi', OnItsOwn);

  expect(getWidgetRenderer('test.kpi')).toBe(Placed);
  expect(getSavedWidgetRenderer('test.kpi')).toBe(OnItsOwn);

  saved.dispose();

  expect(getSavedWidgetRenderer('test.kpi')).toBeUndefined();
  expect(getWidgetRenderer('test.kpi')).toBe(Placed);
  placed.dispose();
});

test('replacing a saved widget renderer warns, and disposing the replaced one keeps the newer', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  const Newer = () => null;
  const first = canvas.registerSavedWidgetRenderer('test.kpi', OnItsOwn);
  const second = canvas.registerSavedWidgetRenderer('test.kpi', Newer);

  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('"test.kpi" is already registered'),
  );

  first.dispose();

  expect(getSavedWidgetRenderer('test.kpi')).toBe(Newer);

  second.dispose();

  expect(getSavedWidgetRenderer('test.kpi')).toBeUndefined();
  warn.mockRestore();
});
