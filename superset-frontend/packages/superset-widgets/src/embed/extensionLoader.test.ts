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
import { unregisterWidgetComponent } from '../registry';
import { resetExtensionHost } from './extensionHost';
import {
  clearLoadedExtensions,
  createExtensionWidgetLoader,
  parseExtensionWidgetType,
} from './extensionLoader';

const TYPE = 'extensions.acme.widgets.chart';
const TABLE_TYPE = 'extensions.acme.widgets.table';
const CONTAINER = 'acme_widgets';
const DOMAIN = 'https://superset.example.com';

type ExtensionCore = {
  views: {
    registerView: (
      view: { id: string; name: string },
      location: string,
      component: () => null,
    ) => { dispose(): void };
  };
};

type ShareEntry = { get: () => Promise<() => ExtensionCore> };

const StubWidget = () => null;

/** Stands in for the extension's `./index`: what it registers when evaluated. */
let register: (core: ExtensionCore) => void;
let core: ExtensionCore;
let scriptUrls: string[];

const container = {
  init: jest.fn(async (scope: Record<string, Record<string, ShareEntry>>) => {
    const [entry] = Object.values(scope['@apache-superset/core']);
    core = (await entry.get())();
  }),
  get: jest.fn(async () => () => register(core)),
};

const extension = {
  id: 'acme.widgets',
  publisher: 'acme',
  name: 'widgets',
  remoteEntry: '/api/v1/extensions/acme/widgets/remoteEntry.abc.js',
  moduleFederationName: CONTAINER,
};

const registerChart = (loaded: ExtensionCore) =>
  loaded.views.registerView(
    { id: TYPE, name: 'Chart' },
    'dashboard.widgets',
    StubWidget,
  );

beforeEach(() => {
  scriptUrls = [];
  container.init.mockClear();
  container.get.mockClear();
  register = registerChart;
  (window as unknown as Record<string, unknown>)[CONTAINER] = container;
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ result: extension }),
  })) as unknown as typeof fetch;
  jest.spyOn(document.head, 'appendChild').mockImplementation(((
    node: HTMLScriptElement,
  ) => {
    scriptUrls.push(node.src);
    node.onload?.(new Event('load'));
    return node;
  }) as typeof document.head.appendChild);
});

afterEach(() => {
  jest.restoreAllMocks();
  clearLoadedExtensions();
  unregisterWidgetComponent(TYPE);
  unregisterWidgetComponent(TABLE_TYPE);
  resetExtensionHost();
});

test('an extension widget type names the extension that draws it', () => {
  expect(parseExtensionWidgetType(TYPE)).toEqual({
    publisher: 'acme',
    name: 'widgets',
    id: 'acme.widgets',
  });
  expect(parseExtensionWidgetType('echarts')).toBeUndefined();
  expect(parseExtensionWidgetType('extensions.acme.widgets')).toBeUndefined();
});

test('loading a type fetches its extension and returns the widget it registers', async () => {
  const load = createExtensionWidgetLoader({ supersetDomain: DOMAIN });

  const component = await load(TYPE);

  expect(global.fetch).toHaveBeenCalledWith(
    `${DOMAIN}/api/v1/extensions/acme/widgets`,
    expect.anything(),
  );
  expect(scriptUrls).toEqual([`${DOMAIN}${extension.remoteEntry}`]);
  expect(component).toBeDefined();
});

test('a second widget from the same extension reuses the one load', async () => {
  register = loaded => {
    registerChart(loaded);
    loaded.views.registerView(
      { id: TABLE_TYPE, name: 'Table' },
      'dashboard.widgets',
      StubWidget,
    );
  };
  const load = createExtensionWidgetLoader({ supersetDomain: DOMAIN });

  await Promise.all([load(TYPE), load(TABLE_TYPE)]);

  expect(container.init).toHaveBeenCalledTimes(1);
  expect(scriptUrls).toHaveLength(1);
});

test('a type the extension does not contribute says so', async () => {
  const load = createExtensionWidgetLoader({ supersetDomain: DOMAIN });

  await expect(load('extensions.acme.widgets.missing')).rejects.toThrow(
    'Extension acme.widgets does not contribute the widget',
  );
});

test('a failed load is not kept, so the next widget can retry', async () => {
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  const load = createExtensionWidgetLoader({ supersetDomain: DOMAIN });

  await expect(load(TYPE)).rejects.toThrow('offline');
  await expect(load(TYPE)).resolves.toBeDefined();
});
