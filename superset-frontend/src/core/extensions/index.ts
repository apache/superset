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
import { extensions as extensionsApi } from '@apache-superset/core';
import { SupersetClient } from '@superset-ui/core';
import ExtensionsLoader from 'src/extensions/ExtensionsLoader';

const getExtension: typeof extensionsApi.getExtension = id =>
  ExtensionsLoader.getInstance().getExtension(id);

const getAllExtensions: typeof extensionsApi.getAllExtensions = () =>
  ExtensionsLoader.getInstance().getExtensions();

export const extensions: typeof extensionsApi = {
  getExtension,
  getAllExtensions,
};

/**
 * Deployment-wide extension admin settings. The keys are snake_case to match
 * the `/api/v1/extensions/settings` wire shape this store loads from.
 * Settings are read-only from the frontend; the admin write path has been
 * removed in favour of direct backend configuration.
 */
export type ExtensionSettings = {
  active_chatbot_id: string | null;
};

const SETTINGS_ENDPOINT = '/api/v1/extensions/settings';

const EMPTY_SETTINGS: ExtensionSettings = {
  active_chatbot_id: null,
};

/**
 * Single module-level store for extension admin settings. The chatbot mount
 * reads this one source via `useSyncExternalStore` so it re-resolves when the
 * store is updated — no bespoke second notification channel needed.
 */
let settings: ExtensionSettings = EMPTY_SETTINGS;
const settingsListeners = new Set<() => void>();

const emitSettingsChange = (): void => {
  settingsListeners.forEach(fn => fn());
};

/** Subscribe to settings changes (for `useSyncExternalStore`). */
export const subscribeToExtensionSettings = (
  listener: () => void,
): (() => void) => {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
};

/** Current settings snapshot (for `useSyncExternalStore`). */
export const getExtensionSettingsSnapshot = (): ExtensionSettings => settings;

/** Replace the settings snapshot and notify subscribers. Module-private; only loadExtensionSettings should call this. */
const applyExtensionSettings = (next: ExtensionSettings): void => {
  settings = next;
  emitSettingsChange();
};

/**
 * Fetch settings from the server into the store. Resolves to the loaded value;
 * on failure the store is left untouched and the error is rethrown so callers
 * can surface it.
 */
export const loadExtensionSettings = async (): Promise<ExtensionSettings> => {
  const { json } = await SupersetClient.get({ endpoint: SETTINGS_ENDPOINT });
  applyExtensionSettings(json.result ?? EMPTY_SETTINGS);
  return settings;
};
