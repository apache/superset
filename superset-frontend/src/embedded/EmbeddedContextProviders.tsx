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
import { Route } from 'react-router-dom';
import { getExtensionsRegistry } from '@superset-ui/core';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryParamProvider } from 'use-query-params';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { FlashProvider, DynamicPluginProvider } from 'src/components';
import { EmbeddedUiConfigProvider } from 'src/components/UiConfigContext';
import { SupersetThemeProvider } from 'src/theme/ThemeProvider';
import { ThemeController } from 'src/theme/ThemeController';
import type { ThemeStorage } from '@superset-ui/core';
import { store } from 'src/views/store';
import getBootstrapData from 'src/utils/getBootstrapData';

/**
 * In-memory implementation of ThemeStorage interface for embedded contexts.
 * Persistent storage is not required for embedded dashboards.
 */
class ThemeMemoryStorageAdapter implements ThemeStorage {
  private storage = new Map<string, string>();

  getItem(key: string): string | null {
    return this.storage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }
}

const themeController = new ThemeController({
  storage: new ThemeMemoryStorageAdapter(),
});

export const getThemeController = (): ThemeController => themeController;

const { common } = getBootstrapData();
const extensionsRegistry = getExtensionsRegistry();

export const EmbeddedContextProviders: React.FC = ({ children }) => {
  const RootContextProviderExtension = extensionsRegistry.get(
    'root.context.provider',
  );

  return (
    <SupersetThemeProvider themeController={themeController}>
      <ReduxProvider store={store}>
        <DndProvider backend={HTML5Backend}>
          <FlashProvider messages={common.flash_messages}>
            <EmbeddedUiConfigProvider>
              <DynamicPluginProvider>
                <QueryParamProvider
                  ReactRouterRoute={Route}
                  stringifyOptions={{ encode: false }}
                >
                  {RootContextProviderExtension ? (
                    <RootContextProviderExtension>
                      {children}
                    </RootContextProviderExtension>
                  ) : (
                    children
                  )}
                </QueryParamProvider>
              </DynamicPluginProvider>
            </EmbeddedUiConfigProvider>
          </FlashProvider>
        </DndProvider>
      </ReduxProvider>
    </SupersetThemeProvider>
  );
};
