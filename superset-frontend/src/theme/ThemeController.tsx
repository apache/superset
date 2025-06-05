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
import { theme as antdThemeImport } from 'antd';
import {
  Theme,
  AnyThemeConfig,
  ThemeStorage,
  ThemeControllerOptions,
} from '@superset-ui/core';

export class LocalStorageAdapter implements ThemeStorage {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
}

export class ThemeController {
  private theme: Theme;

  private storage: ThemeStorage;

  private storageKey: string;

  private defaultTheme: AnyThemeConfig;

  private customizations: AnyThemeConfig = {};

  private onChangeCallbacks: Set<(theme: Theme) => void> = new Set();

  private canUpdateThemeFn: () => boolean;

  private canChangeDarkModeFn: () => boolean;

  constructor(options: ThemeControllerOptions = {}) {
    this.storage = options.storage || new LocalStorageAdapter();
    this.storageKey = options.storageKey || 'superset-theme';
    this.defaultTheme = options.defaultTheme || {};

    const savedThemeJson = this.storage.getItem(this.storageKey);
    let initialCustomizations: AnyThemeConfig = {};

    if (savedThemeJson) {
      try {
        initialCustomizations = JSON.parse(savedThemeJson);
        this.customizations = initialCustomizations;
      } catch (e) {
        console.error('Failed to parse saved theme:', e);
        initialCustomizations = {};
      }
    }

    this.theme = Theme.fromConfig(initialCustomizations);

    if (options.onChange) {
      this.onChangeCallbacks.add(options.onChange);
    }
    this.canUpdateThemeFn = options.canUpdateTheme || (() => true);
    this.canChangeDarkModeFn = options.canChangeDarkMode || (() => true);
  }

  public canUpdateTheme(): boolean {
    return this.canUpdateThemeFn();
  }

  public canChangeDarkMode(): boolean {
    return this.canChangeDarkModeFn();
  }

  /**
   * Get the current theme
   */
  public getTheme(): Theme {
    return this.theme;
  }

  /**
   * Set a new theme configuration
   */
  public setTheme(config: AnyThemeConfig): void {
    if (!this.canUpdateTheme()) {
      throw new Error('User does not have permission to update the theme');
    }
    this.customizations = config;
    this.theme.setConfig(config);
    this.persistTheme();
    this.notifyListeners();
  }

  /**
   * Toggle dark mode
   */
  public toggleDarkMode(isDark: boolean): void {
    if (!this.canChangeDarkMode()) {
      throw new Error('User does not have permission to update the theme');
    }
    this.customizations.algorithm = isDark
      ? antdThemeImport.darkAlgorithm
      : antdThemeImport.defaultAlgorithm;

    if (isDark) {
      this.customizations = {
        ...this.customizations,
        algorithm: 'dark',
      };
    } else {
      const { algorithm, ...rest } = this.customizations;
      this.customizations = Object.keys(rest).length > 0 ? { ...rest } : {};
    }

    this.theme.setConfig(this.customizations);

    this.persistTheme();
    this.notifyListeners();
  }

  /**
   * Reset to default theme
   */
  public resetTheme(): void {
    this.customizations = {};
    this.theme.setConfig(this.defaultTheme);
    this.persistTheme();
    this.notifyListeners();
  }

  /**
   * Register a callback to be called when theme changes
   */
  public onChange(callback: (theme: Theme) => void): () => void {
    this.onChangeCallbacks.add(callback);

    return () => {
      this.onChangeCallbacks.delete(callback);
    };
  }

  private persistTheme(): void {
    this.storage.setItem(this.storageKey, JSON.stringify(this.customizations));
  }

  private notifyListeners(): void {
    this.onChangeCallbacks.forEach(callback => {
      try {
        callback(this.theme);
      } catch (e) {
        console.error('Error in theme change callback:', e);
      }
    });
  }
}
