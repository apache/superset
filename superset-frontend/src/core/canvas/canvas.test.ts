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
  canvas,
  getSavedWidgetRenderer,
  getWidgetRenderer,
  setActiveCanvas,
} from 'src/core';

const Kpi = () => null;

afterEach(() => setActiveCanvas(undefined));

test('widget renderers register and unregister by type', () => {
  const registration = canvas.registerWidgetRenderer('test.kpi', Kpi);

  expect(getWidgetRenderer('test.kpi')).toBe(Kpi);

  registration.dispose();

  expect(getWidgetRenderer('test.kpi')).toBeUndefined();
});

test('replacing a registered renderer warns', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  const first = canvas.registerWidgetRenderer('test.kpi', Kpi);
  const second = canvas.registerWidgetRenderer('test.kpi', () => null);

  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('"test.kpi" is already registered'),
  );
  second.dispose();
  first.dispose();
  warn.mockRestore();
});

test('disposing a replaced renderer keeps the newer one', () => {
  const Other = () => null;
  const first = canvas.registerWidgetRenderer('test.kpi', Kpi);
  const second = canvas.registerWidgetRenderer('test.kpi', Other);

  first.dispose();

  expect(getWidgetRenderer('test.kpi')).toBe(Other);
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

test('active canvas changes fire on the open draft and a version preview', () => {
  const listener = jest.fn();
  const subscription = canvas.onDidChangeActiveCanvas(listener);
  const published = { id: 1, title: 'Exec overview', revision: 2 };
  const settled = (token: string, revision: number) => ({
    ...published,
    draft: { token, pending: false as const, revision },
  });
  const pending = (token: string) => ({
    ...published,
    draft: { token, pending: true as const },
  });
  const previewing = (uuid: string, number: number) => ({
    ...published,
    previewedVersion: { uuid, number },
  });

  setActiveCanvas(undefined);
  setActiveCanvas(published);
  setActiveCanvas(settled('tok-1', 0));
  // A fresh object with the same values, draft included, is no change.
  setActiveCanvas({ ...published, draft: { ...settled('tok-1', 0).draft } });
  setActiveCanvas(pending('tok-1'));
  setActiveCanvas(pending('tok-1'));
  setActiveCanvas(settled('tok-1', 1));
  setActiveCanvas(settled('tok-2', 1));
  setActiveCanvas(pending('tok-2'));
  setActiveCanvas(published);
  setActiveCanvas(previewing('v-1', 1));
  setActiveCanvas({ ...previewing('v-1', 1) });
  setActiveCanvas(previewing('v-2', 2));
  // Either part of the version changing is a change.
  setActiveCanvas(previewing('v-2', 3));
  setActiveCanvas(previewing('v-3', 3));
  setActiveCanvas(published);

  expect(listener.mock.calls).toEqual([
    [published],
    [settled('tok-1', 0)],
    [pending('tok-1')],
    [settled('tok-1', 1)],
    [settled('tok-2', 1)],
    [pending('tok-2')],
    [published],
    [previewing('v-1', 1)],
    [previewing('v-2', 2)],
    [previewing('v-2', 3)],
    [previewing('v-3', 3)],
    [published],
  ]);
  subscription.dispose();
});

test('extensions get the widget host with the rest of the canvas namespace', () => {
  expect(typeof canvas.WidgetHost).toBe('function');
});

test('saved widget renderers register apart from canvas renderers', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  const OnItsOwn = () => null;
  const placed = canvas.registerWidgetRenderer('test.kpi', Kpi);
  const saved = canvas.registerSavedWidgetRenderer('test.kpi', OnItsOwn);

  expect(getWidgetRenderer('test.kpi')).toBe(Kpi);
  expect(getSavedWidgetRenderer('test.kpi')).toBe(OnItsOwn);

  // A canvas renderer alone doesn't make a type show outside a canvas.
  saved.dispose();
  expect(getSavedWidgetRenderer('test.kpi')).toBeUndefined();
  expect(getWidgetRenderer('test.kpi')).toBe(Kpi);

  const first = canvas.registerSavedWidgetRenderer('test.kpi', OnItsOwn);
  const second = canvas.registerSavedWidgetRenderer('test.kpi', () => null);
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('"test.kpi" is already registered'),
  );
  first.dispose();
  expect(getSavedWidgetRenderer('test.kpi')).not.toBe(OnItsOwn);
  second.dispose();
  placed.dispose();
  warn.mockRestore();
});
