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

import { ComponentType, useSyncExternalStore } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { Disposable } from '../models';
import { createValueEventEmitter } from '../utils';

type WidgetRenderer = ComponentType<canvasApi.CanvasWidgetProps>;

const renderers = new Map<string, WidgetRenderer>();
const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version += 1;
  listeners.forEach(listener => listener());
};

const registerWidgetRenderer: typeof canvasApi.registerWidgetRenderer = (
  widgetType,
  component,
) => {
  renderers.set(widgetType, component);
  notify();
  return new Disposable(() => {
    if (renderers.get(widgetType) === component) {
      renderers.delete(widgetType);
      notify();
    }
  });
};

const getWidgetRenderer: typeof canvasApi.getWidgetRenderer = widgetType =>
  renderers.get(widgetType);

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

/** Called by the canvas page as the user opens, updates or leaves a canvas. */
export const setActiveCanvas = (value: canvasApi.ActiveCanvas | undefined) => {
  const current = activeCanvas.getCurrent();
  if (
    current?.id === value?.id &&
    current?.title === value?.title &&
    current?.revision === value?.revision
  ) {
    return;
  }
  activeCanvas.fire(value);
};

export const canvas: typeof canvasApi = {
  registerWidgetRenderer,
  getWidgetRenderer,
  getActiveCanvas: activeCanvas.getCurrent,
  onDidChangeActiveCanvas: activeCanvas.subscribe,
};
