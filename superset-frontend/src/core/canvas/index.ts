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
 * @fileoverview Host implementation of the `canvas` extension namespace:
 * widget renderers by type, and the canvas the user has open.
 */

import {
  ComponentType,
  createElement,
  lazy,
  Suspense,
  useSyncExternalStore,
} from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { logging } from '@apache-superset/core/utils';
import { Disposable } from '../models';
import { createValueEventEmitter } from '../utils';
import type { CanvasRendererProps } from './types';

type WidgetRenderer = ComponentType<CanvasRendererProps>;

const renderers = new Map<string, WidgetRenderer>();
const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version += 1;
  listeners.forEach(listener => listener());
};

/**
 * Registers a renderer. Typed with the host's full props so the built-in
 * renderers can register here too; an extension's renderer, typed with the
 * core subset, is assignable to it.
 */
export const registerWidgetRenderer = (
  widgetType: string,
  component: WidgetRenderer,
): Disposable => {
  if (renderers.has(widgetType)) {
    logging.warn(
      `Widget renderer "${widgetType}" is already registered. Overwriting the existing renderer.`,
    );
  }
  renderers.set(widgetType, component);
  notify();
  return new Disposable(() => {
    if (renderers.get(widgetType) === component) {
      renderers.delete(widgetType);
      notify();
    }
  });
};

export const getWidgetRenderer = (
  widgetType: string,
): WidgetRenderer | undefined => renderers.get(widgetType);

/** Re-renders the caller when widget renderers are registered or removed. */
export const useWidgetRenderers = (): typeof getWidgetRenderer => {
  useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
  return getWidgetRenderer;
};

const activeCanvas = createValueEventEmitter<
  canvasApi.ActiveCanvas | undefined
>(undefined);

// Undefined while the draft is pending, so this also tells pending apart.
const draftRevision = (draft: canvasApi.ActiveCanvasDraft | undefined) =>
  draft?.pending === false ? draft.revision : undefined;

const sameActiveCanvas = (
  a: canvasApi.ActiveCanvas | undefined,
  b: canvasApi.ActiveCanvas | undefined,
): boolean =>
  a?.id === b?.id &&
  a?.title === b?.title &&
  a?.revision === b?.revision &&
  a?.draft?.token === b?.draft?.token &&
  draftRevision(a?.draft) === draftRevision(b?.draft) &&
  a?.previewedVersion?.uuid === b?.previewedVersion?.uuid &&
  a?.previewedVersion?.number === b?.previewedVersion?.number;

/** Called by the canvas page as the user opens, updates or leaves a canvas. */
export const setActiveCanvas = (value: canvasApi.ActiveCanvas | undefined) => {
  if (sameActiveCanvas(activeCanvas.getCurrent(), value)) return;
  activeCanvas.fire(value);
};

// Loaded on first use, with the canvas code it shares, so that a page that
// never shows a widget doesn't load it.
const LazyWidgetHost = lazy(() => import('src/features/canvas/WidgetHost'));

const WidgetHost: typeof canvasApi.WidgetHost = props =>
  createElement(
    Suspense,
    { fallback: null },
    createElement(LazyWidgetHost, props),
  );

export const canvas: typeof canvasApi = {
  registerWidgetRenderer,
  getActiveCanvas: activeCanvas.getCurrent,
  onDidChangeActiveCanvas: activeCanvas.subscribe,
  WidgetHost,
};
