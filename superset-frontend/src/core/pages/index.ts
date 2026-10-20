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
 * @fileoverview Host-side registry for extension-contributed pages.
 *
 * Mirrors `src/core/views`: module-level state, a `useSyncExternalStore`
 * subscription so a registration arriving after first render still lands, and
 * an `ExtensionPlaceholder` for a page whose component has not arrived.
 *
 * The one thing this adds is namespacing. An extension registers a bare slug;
 * the host prefixes it with the extension's identity to produce both the id
 * and the URL. The extension never supplies a path, so it cannot claim a URL
 * belonging to the host or to another extension.
 */

import React, { ComponentType, useSyncExternalStore } from 'react';
import type { pages as pagesApi } from '@apache-superset/core';
import { logging } from '@apache-superset/core/utils';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import ExtensionPlaceholder from 'src/extensions/ExtensionPlaceholder';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';

type Page = pagesApi.Page;
type ResolvedPage = pagesApi.ResolvedPage;

/** Slugs are a single path segment, in the same shape as an extension name. */
const SLUG_PATTERN = /^[a-z]([a-z0-9]*(-[a-z0-9]+)*)?$/;

/** The namespace every contributed page is served under. */
export const pagePath = (extensionId: string, slug: string): string =>
  `/extensions/${extensionId}/${slug}`;

const pageRegistry: Map<string, { page: ResolvedPage; component: ComponentType }> =
  new Map();

const syncListeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
};

const registerEmitter = createEventEmitter<ResolvedPage>();
const unregisterEmitter = createEventEmitter<ResolvedPage>();

// `useSyncExternalStore` requires a referentially stable snapshot between
// notifications, so the array is rebuilt only when the registry changes.
let snapshot: ResolvedPage[] = [];
const refresh = () => {
  snapshot = Array.from(pageRegistry.values(), entry => entry.page);
  syncListeners.forEach(listener => listener());
};

/**
 * Registers a page on behalf of a specific extension.
 *
 * Not part of the public API: the loader binds `extensionId` per extension
 * before handing the namespace to extension code, so an extension cannot
 * name another extension's id. See `ExtensionsLoader.loadModule`.
 */
export const registerPageFor = (
  extensionId: string,
  page: Page,
  component: ComponentType,
): Disposable => {
  if (!page?.slug || !SLUG_PATTERN.test(page.slug)) {
    throw new Error(
      `Page slug "${page?.slug ?? '<missing>'}" must be lowercase letters, ` +
        `digits and single hyphens. A slug names a page within an extension; ` +
        `the host supplies the rest of the URL.`,
    );
  }

  const id = `${extensionId}.${page.slug}`;
  const resolved: ResolvedPage = {
    ...page,
    extensionId,
    path: pagePath(extensionId, page.slug),
  };

  const replaced = pageRegistry.get(id);
  if (replaced) {
    // Within one extension only -- ids are namespaced, so this can never be
    // another extension's page. Silent replacement would simply make the
    // first registration stop rendering with nothing said about it.
    logging.warn(
      `Page "${id}" is already registered; it has been replaced and the ` +
        `earlier component no longer renders.`,
    );
  }

  const entry = { page: resolved, component };
  pageRegistry.set(id, entry);
  refresh();
  registerEmitter.fire(resolved);

  return new Disposable(() => {
    // Only while this registration still holds the id: disposing one that has
    // since been replaced would remove the replacement instead.
    if (pageRegistry.get(id) !== entry) {
      return;
    }
    pageRegistry.delete(id);
    refresh();
    unregisterEmitter.fire(resolved);
  });
};

export const getPages = (): ResolvedPage[] => snapshot;

export const usePages = (): ResolvedPage[] =>
  useSyncExternalStore(subscribe, getPages, getPages);

/** The page registered for a path, or undefined when nothing claims it. */
export const findPageByPath = (path: string): ResolvedPage | undefined =>
  snapshot.find(page => page.path === path || path.startsWith(`${page.path}/`));

export const resolvePage = (id: string): React.ReactElement => {
  const entry = pageRegistry.get(id);
  if (!entry) {
    return React.createElement(ExtensionPlaceholder, { id });
  }
  return React.createElement(
    ErrorBoundary,
    null,
    React.createElement(entry.component),
  );
};

export const onDidRegisterPage = (listener: (e: ResolvedPage) => void) =>
  registerEmitter.subscribe(listener);

export const onDidUnregisterPage = (listener: (e: ResolvedPage) => void) =>
  unregisterEmitter.subscribe(listener);

/**
 * The namespace handed to extension code, with `registerPage` unbound.
 *
 * The loader replaces `registerPage` per extension; this shape exists so the
 * host's own `window.superset.pages` is complete and type-compatible.
 */
export const pages = {
  registerPage: (() => {
    throw new Error(
      'pages.registerPage is bound per extension by the loader and cannot ' +
        'be called on the host namespace directly.',
    );
  }) as unknown as typeof pagesApi.registerPage,
  getPages,
  onDidRegisterPage,
  onDidUnregisterPage,
} as unknown as typeof pagesApi;
