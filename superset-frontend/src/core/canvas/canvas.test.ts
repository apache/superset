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
import type { canvas as canvasApi } from '@apache-superset/core';
import { logging } from '@apache-superset/core/utils';
import {
  canvas,
  fireDraftEvent,
  getWidgetRenderer,
  preparePublish,
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

test('what the page does to its draft reaches every listener, past one that throws', () => {
  const logged = jest.spyOn(logging, 'error').mockImplementation(() => {});
  const failing = canvas.onDidChangeDraft(() => {
    throw new Error('listener bug');
  });
  const listener = jest.fn();
  const subscription = canvas.onDidChangeDraft(listener);
  const event: canvasApi.CanvasDraftEvent = {
    kind: 'undone',
    canvasId: 7,
    token: 'tok-123',
    steppedWidgetIds: ['w-1'],
  };

  fireDraftEvent(event);
  subscription.dispose();
  fireDraftEvent({ ...event, kind: 'redone' });

  expect(listener.mock.calls).toEqual([[event]]);
  expect(logged).toHaveBeenCalled();
  failing.dispose();
  logged.mockRestore();
});

const draft: canvasApi.CanvasDraftPublish = {
  canvasId: 7,
  token: 'tok-123',
  widgets: [{ nodeId: 'notes', widgetId: 'w-1', widgetType: 'acme.notes' }],
};

const part = (title: string): canvasApi.CanvasPublishPart => ({
  title,
  lines: [`${title} goes public`],
  publish: () => Promise.resolve(),
});

test('publish participants say what a draft publishes, until disposed', async () => {
  const notes = canvas.registerPublishParticipant({
    prepare: async ({ widgets }) =>
      widgets.some(widget => widget.widgetType === 'acme.notes')
        ? [part('Notes')]
        : [],
  });
  const quiet = canvas.registerPublishParticipant({
    prepare: async () => [],
  });

  expect((await preparePublish(draft)).map(({ title }) => title)).toEqual([
    'Notes',
  ]);

  notes.dispose();
  quiet.dispose();
  expect(await preparePublish(draft)).toEqual([]);
});

test('a participant that fails fails the whole publish, before anything is published', async () => {
  const fine = jest.fn(async () => [part('Notes')]);
  const first = canvas.registerPublishParticipant({ prepare: fine });
  const broken = canvas.registerPublishParticipant({
    prepare: () => Promise.reject(new Error('Notes are unreachable')),
  });

  await expect(preparePublish(draft)).rejects.toThrow('Notes are unreachable');
  expect(fine).toHaveBeenCalledWith(draft);

  first.dispose();
  broken.dispose();
});
