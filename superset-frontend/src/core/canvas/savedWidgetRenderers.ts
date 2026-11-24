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
 * @fileoverview Saved widget renderers: what the widget host runs for a
 * saved widget whose type isn't one of its built-ins, which is how an
 * extension's widget type shows outside a canvas.
 *
 * Left out of `@apache-superset/core` on purpose, and reachable only on the
 * runtime `canvas` namespace: a second registry for the same types has no
 * place once renderers take their context from SIP-231's hooks, so it is no
 * API to build on.
 */

import { ComponentType, useSyncExternalStore } from 'react';
import { logging } from '@apache-superset/core/utils';
import { Disposable } from '../models';
import type { SavedRendererProps } from './types';

type SavedWidgetRenderer = ComponentType<SavedRendererProps>;

const renderers = new Map<string, SavedWidgetRenderer>();
const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version += 1;
  listeners.forEach(listener => listener());
};

/** Registers the saved widget renderer of a type, replacing any it had. */
export const registerSavedWidgetRenderer = (
  widgetType: string,
  component: SavedWidgetRenderer,
): Disposable => {
  if (renderers.has(widgetType)) {
    logging.warn(
      `Saved widget renderer "${widgetType}" is already registered. Overwriting the existing renderer.`,
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

export const getSavedWidgetRenderer = (
  widgetType: string,
): SavedWidgetRenderer | undefined => renderers.get(widgetType);

/** Re-renders the caller when saved widget renderers change. */
export const useSavedWidgetRenderers = (): typeof getSavedWidgetRenderer => {
  useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
  return getSavedWidgetRenderer;
};
