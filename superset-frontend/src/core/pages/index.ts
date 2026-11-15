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
 * @fileoverview Host implementation of the `pages` extension namespace: the
 * components that render extensions' standalone pages, by page id.
 */

import { ComponentType, useSyncExternalStore } from 'react';
import { logging } from '@apache-superset/core/utils';
import type { pages as pagesApi } from '@apache-superset/core';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';

type Page = ComponentType<pagesApi.PageProps>;

const registered = new Map<string, Page>();
const changes = createEventEmitter<void>();

const registerPage: typeof pagesApi.registerPage = (id, component) => {
  const existing = registered.get(id);
  if (existing !== undefined && existing !== component) {
    logging.warn(`Page "${id}" already has a component. Replacing it.`);
  }
  registered.set(id, component);
  changes.fire();
  return new Disposable(() => {
    if (registered.get(id) === component) {
      registered.delete(id);
      changes.fire();
    }
  });
};

const getPage: typeof pagesApi.getPage = id => registered.get(id);

const subscribe = (listener: () => void) => {
  const subscription = changes.subscribe(listener);
  return () => subscription.dispose();
};

/**
 * The component registered for page `id`, if any; re-renders the caller when
 * it is registered or removed.
 */
export const usePage = (id: string): Page | undefined =>
  useSyncExternalStore(subscribe, () => registered.get(id));

export const pages: typeof pagesApi = {
  registerPage,
  getPage,
};
