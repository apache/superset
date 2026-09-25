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
 * Loads the widget types a Superset extension contributes, on demand, into a
 * host page.
 *
 * A widget type registered by an extension is namespaced by the host as
 * `extensions.<publisher>.<name>.<type>` (see `inject_widget_implementations`),
 * so the type on a node — or on a saved widget — is all the host needs to find
 * the extension that draws it. Its frontend is a Module Federation container
 * served by Superset; this loads that container and hands it a
 * `@apache-superset/core` backed by the embedded widget runtime.
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { createContext, useContext, useEffect, useState } from 'react';
import { getWidgetComponent } from '../registry';
import type { WidgetComponent } from '../types';
import { createApiFetch, type ApiFetchOptions } from './httpClient';
import { createExtensionCore, type ExtensionInfo } from './extensionHost';

const EXTENSION_WIDGET_TYPE = /^extensions\.([^.]+)\.([^.]+)\..+$/;

/** The extension that owns `type`, or undefined if it is not an extension's. */
export function parseExtensionWidgetType(
  type: string,
): { publisher: string; name: string; id: string } | undefined {
  const match = EXTENSION_WIDGET_TYPE.exec(type);
  if (!match) return undefined;
  const [, publisher, name] = match;
  return { publisher, name, id: `${publisher}.${name}` };
}

export const isExtensionWidgetType = (type: string): boolean =>
  EXTENSION_WIDGET_TYPE.test(type);

/** Resolves the component for an extension's widget type, loading it if needed. */
export type ExtensionWidgetLoader = (type: string) => Promise<WidgetComponent>;

export interface ExtensionWidgetLoaderOptions extends ApiFetchOptions {
  /**
   * Modules added to the container's share scope, beyond the `react`,
   * `react-dom`, `antd` and `@apache-superset/core` every extension declares.
   */
  shared?: Record<string, unknown>;
}

/** The runtime half of a Module Federation container, as `window[name]` holds it. */
interface FederationContainer {
  init(shareScope: Record<string, unknown>): void | Promise<void>;
  get(module: string): Promise<() => unknown>;
}

function isFederationContainer(value: unknown): value is FederationContainer {
  const container = value as Partial<FederationContainer> | null;
  return (
    typeof container?.init === 'function' &&
    typeof container?.get === 'function'
  );
}

function shareEntry(module: unknown, version: string) {
  return {
    [version]: {
      get: () => Promise.resolve(() => module),
      loaded: true,
      eager: true,
      from: '@apache-superset/widgets',
    },
  };
}

const versionOf = (module: unknown): string =>
  (module as { version?: string }).version ?? '0.0.0';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Could not load the extension bundle at ${src}.`));
    document.head.appendChild(script);
  });
}

/**
 * In flight or done, keyed by deployment and extension: a page with several
 * providers on the same Superset must not evaluate one extension twice, and
 * its container can only be initialized once.
 */
const loading = new Map<string, Promise<void>>();

/** Test seam, and for a host that swaps deployments without a reload. */
export function clearLoadedExtensions(): void {
  loading.clear();
}

/**
 * Loads extension widget types from `supersetDomain`.
 *
 * The extension's code runs in the host page's JavaScript context, with the
 * host's React — the same trust boundary the widgets themselves have. Its
 * bundle must be readable by whoever the page renders as (see
 * `EMBEDDED_EXTENSION_ASSETS_PUBLIC` for guest tokens, which a `<script>` tag
 * cannot carry).
 */
export function createExtensionWidgetLoader(
  options: ExtensionWidgetLoaderOptions,
): ExtensionWidgetLoader {
  const api = createApiFetch(options);
  const base = options.supersetDomain.replace(/\/+$/, '');

  const url = (path: string) =>
    /^https?:\/\//.test(path) ? path : `${base}${path}`;

  async function loadExtension(publisher: string, name: string): Promise<void> {
    const id = `${publisher}.${name}`;
    const extension = await api<ExtensionInfo>(
      `/api/v1/extensions/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}`,
    );
    if (!extension.remoteEntry) {
      throw new Error(`Extension ${id} has no frontend to load.`);
    }
    await loadScript(url(extension.remoteEntry));
    // Only a page that actually loads an extension pays for antd's full
    // surface; the widgets themselves import the components they use.
    const antd = await import('antd');

    const containerName = extension.moduleFederationName || id;
    const container = (window as unknown as Record<string, unknown>)[
      containerName
    ];
    if (!isFederationContainer(container)) {
      throw new Error(
        `Extension ${id} did not register the container "${containerName}".`,
      );
    }
    const core = createExtensionCore(extension);
    // Superset's own loader puts the platform API on `window.superset`, and an
    // extension built with `externals: {'@apache-superset/core': 'superset'}`
    // reads it from there rather than from the share scope below. One global
    // for the page: with several extensions loaded, the last one's context
    // wins, exactly as it does in the host.
    (window as unknown as Record<string, unknown>).superset ??= core;

    await container.init({
      react: shareEntry(React, versionOf(React)),
      'react-dom': shareEntry(ReactDOM, versionOf(ReactDOM)),
      antd: shareEntry(antd, versionOf(antd)),
      '@apache-superset/core': shareEntry(
        core,
        '0.1.0',
      ),
      ...options.shared,
    });
    const factory = await container.get('./index');
    // The extension registers its widgets as a side effect of this call.
    factory();
  }

  return async function loadExtensionWidget(type) {
    const parsed = parseExtensionWidgetType(type);
    if (!parsed) throw new Error(`Unknown widget type "${type}".`);

    const key = `${base}|${parsed.id}`;
    let pending = loading.get(key);
    if (!pending) {
      pending = loadExtension(parsed.publisher, parsed.name);
      loading.set(key, pending);
    }
    try {
      await pending;
    } catch (error) {
      // Keeping a rejected load would make every later widget from this
      // extension fail with the first widget's error.
      loading.delete(key);
      throw error;
    }

    const component = getWidgetComponent(type);
    if (!component) {
      throw new Error(
        `Extension ${parsed.id} does not contribute the widget "${type}".`,
      );
    }
    return component;
  };
}

export const ExtensionWidgetLoaderContext = createContext<
  ExtensionWidgetLoader | undefined
>(undefined);

export interface ExtensionWidgetState {
  component?: WidgetComponent;
  error?: Error;
  loading: boolean;
}

const IDLE: ExtensionWidgetState = { loading: false };

interface LoadResult {
  type?: string;
  component?: WidgetComponent;
  error?: Error;
}

/**
 * Loads `type` from the extension that contributes it. Pass `undefined` for a
 * type the registry already has (or for no widget at all): the hook then does
 * nothing. An extension type with no result yet reads as loading from the
 * first render, so nothing flashes "unknown widget type" on the way.
 */
export function useExtensionWidget(
  type: string | undefined,
): ExtensionWidgetState {
  const loader = useContext(ExtensionWidgetLoaderContext);
  const [result, setResult] = useState<LoadResult>({});

  useEffect(() => {
    if (!type || !isExtensionWidgetType(type)) return undefined;
    if (!loader) {
      setResult({
        type,
        error: new Error(
          `"${type}" is contributed by a Superset extension, which this page cannot load.`,
        ),
      });
      return undefined;
    }
    let cancelled = false;
    loader(type).then(
      component => {
        if (!cancelled) setResult({ type, component });
      },
      error => {
        if (!cancelled) {
          setResult({
            type,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loader, type]);

  if (!type || !isExtensionWidgetType(type)) return IDLE;
  if (result.type !== type) return { loading: true };
  return { loading: false, component: result.component, error: result.error };
}
