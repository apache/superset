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
/**
 * Controllable in-memory stand-in for the `@apache-superset/core` runtime
 * that the Superset host injects via module federation. Tests drive it with
 * the `__testing` helpers.
 */
import type { ComponentType } from 'react';

type Listener<T> = (value: T) => void;

interface Disposable {
  dispose: () => void;
}

function makeEmitter<T>() {
  const listeners = new Set<Listener<T>>();
  return {
    subscribe(listener: Listener<T>): Disposable {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    fire(value: T) {
      listeners.forEach(listener => listener(value));
    },
    count: () => listeners.size,
  };
}

export type Page =
  | 'dashboard'
  | 'dashboard_list'
  | 'explore'
  | 'chart_list'
  | 'sqllab'
  | 'query_history'
  | 'saved_queries'
  | 'dataset'
  | 'dataset_list'
  | 'home';

type DisplayMode = 'floating' | 'panel';

const state = {
  page: 'home' as Page,
  open: false,
  mode: 'floating' as DisplayMode,
  registered: null as {
    chat: { id: string; name: string; description?: string };
    trigger: ComponentType;
    panel: ComponentType;
  } | null,
  csrfToken: 'test-csrf-token' as string | undefined,
  storageData: new Map<string, unknown>(),
};

const pageEmitter = makeEmitter<Page>();
const openEmitter = makeEmitter<void>();
const closeEmitter = makeEmitter<void>();
const modeEmitter = makeEmitter<DisplayMode>();

export const navigation = {
  getPage: (): Page => state.page,
  onDidChangePage: (listener: Listener<Page>): Disposable =>
    pageEmitter.subscribe(listener),
};

export const chat = {
  registerChat: (
    descriptor: { id: string; name: string; description?: string },
    trigger: ComponentType,
    panel: ComponentType,
  ): Disposable => {
    state.registered = { chat: descriptor, trigger, panel };
    return {
      dispose: () => {
        state.registered = null;
      },
    };
  },
  getChat: () => state.registered?.chat,
  open: () => {
    if (!state.open) {
      state.open = true;
      openEmitter.fire(undefined);
    }
  },
  close: () => {
    if (state.open) {
      state.open = false;
      closeEmitter.fire(undefined);
    }
  },
  isOpen: () => state.open,
  getDisplayMode: (): DisplayMode => state.mode,
  setDisplayMode: (mode: DisplayMode) => {
    if (state.mode !== mode) {
      state.mode = mode;
      modeEmitter.fire(mode);
    }
  },
  onDidOpen: (listener: Listener<void>): Disposable =>
    openEmitter.subscribe(listener),
  onDidClose: (listener: Listener<void>): Disposable =>
    closeEmitter.subscribe(listener),
  onDidChangeDisplayMode: (listener: Listener<DisplayMode>): Disposable =>
    modeEmitter.subscribe(listener),
};

function sprintf(template: string, args: unknown[]): string {
  let index = 0;
  return template.replace(/%s/g, () => String(args[index++] ?? ''));
}

export const translation = {
  t: (template: string, ...args: unknown[]) => sprintf(template, args),
  tn: (singular: string, plural: string, num: number, ...args: unknown[]) =>
    sprintf(num === 1 ? singular : plural, [num, ...args]),
};

export const authentication = {
  getCSRFToken: jest.fn(async () => state.csrfToken),
};

/**
 * The host injects the live Superset theme through this namespace. Tests only
 * need the tokens the components read, with the numeric spacing scale antd
 * uses so style assertions stay meaningful.
 */
export const theme = {
  useTheme: () => ({
    colorPrimary: '#2893B3',
    colorText: '#000000',
    colorTextSecondary: '#575757',
    colorWhite: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorBorderSecondary: '#E0E0E0',
    colorFillTertiary: '#F5F5F5',
    colorSuccess: '#4CAF50',
    colorError: '#E04355',
    colorWarning: '#FF7F44',
    borderRadiusLG: 8,
    boxShadowSecondary: '0 6px 16px 0 rgba(0, 0, 0, 0.08)',
    margin: 16,
    marginXS: 8,
    marginXXS: 4,
    marginSM: 12,
    padding: 16,
    paddingXS: 8,
    paddingSM: 12,
    fontSizeSM: 12,
  }),
};

const storageAccessor = {
  get: jest.fn(async <T,>(key: string): Promise<T | null> => {
    const value = state.storageData.get(key);
    return value === undefined ? null : (value as T);
  }),
  set: jest.fn(async <T,>(key: string, value: T): Promise<void> => {
    state.storageData.set(key, value);
  }),
  remove: jest.fn(async (key: string): Promise<void> => {
    state.storageData.delete(key);
  }),
};

export const extensions = {
  getContext: () => ({
    extension: {
      id: 'apache-superset.ai-chat',
      name: 'ai-chat',
      description: '',
      version: '0.1.0',
      dependencies: [],
    },
    storage: {
      local: storageAccessor,
      session: storageAccessor,
      ephemeral: storageAccessor,
      persistent: storageAccessor,
    },
  }),
};

export const __testing = {
  state,
  setPage(page: Page) {
    state.page = page;
    pageEmitter.fire(page);
  },
  reset() {
    state.page = 'home';
    state.open = false;
    state.mode = 'floating';
    state.registered = null;
    state.csrfToken = 'test-csrf-token';
    state.storageData.clear();
    storageAccessor.get.mockClear();
    storageAccessor.set.mockClear();
    storageAccessor.remove.mockClear();
    authentication.getCSRFToken.mockClear();
  },
  pageListenerCount: () => pageEmitter.count(),
  modeListenerCount: () => modeEmitter.count(),
  storage: storageAccessor,
};
