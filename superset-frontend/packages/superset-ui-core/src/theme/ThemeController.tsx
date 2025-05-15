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
import { theme as antdThemeImport } from 'antd-v5';
import { Theme } from './Theme';
import { AnyThemeConfig } from './types';

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

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

export interface ThemeControllerOptions {
  storage?: ThemeStorage;
  storageKey?: string;
  defaultTheme?: AnyThemeConfig;
  onChange?: (theme: Theme) => void;
}

export class ThemeController {
  private static instance: ThemeController | null = null;

  private theme: Theme;

  private storage: ThemeStorage;

  private storageKey: string;

  private defaultTheme: AnyThemeConfig;

  private customizations: AnyThemeConfig = {};

  private onChangeCallbacks: Set<(theme: Theme) => void> = new Set();

  private constructor(options: ThemeControllerOptions = {}) {
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
  }

  /**
   * Get the singleton instance of ThemeController
   */
  public static getInstance(options?: ThemeControllerOptions): ThemeController {
    if (!ThemeController.instance) {
      ThemeController.instance = new ThemeController(options);
    } else if (options) {
      if (options.storage) {
        ThemeController.instance.storage = options.storage;
      }
      if (options.storageKey) {
        ThemeController.instance.storageKey = options.storageKey;
      }
      if (options.defaultTheme) {
        ThemeController.instance.defaultTheme = options.defaultTheme;
      }
      if (options.onChange) {
        ThemeController.instance.onChangeCallbacks.add(options.onChange);
      }
    }
    return ThemeController.instance;
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
    this.customizations = config;
    this.theme.setConfig(config);
    this.persistTheme();
    this.notifyListeners();
  }

  /**
   * Toggle dark mode
   */
  public toggleDarkMode(isDark: boolean): void {
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
