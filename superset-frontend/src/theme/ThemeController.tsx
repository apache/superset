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

import {
  Theme,
  AnyThemeConfig,
  ThemeStorage,
  ThemeControllerOptions,
  themeObject,
} from '@superset-ui/core';
import { ThemeMode } from '@superset-ui/core/theme/types';

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
  private themeObject: Theme;

  private storage: ThemeStorage;

  private storageKey: string;

  private modeStorageKey: string;

  private defaultTheme: AnyThemeConfig;

  private systemMode: ThemeMode.DARK | ThemeMode.LIGHT;

  private currentMode: ThemeMode;

  private customizations: AnyThemeConfig = {};

  private onChangeCallbacks: Set<(theme: Theme) => void> = new Set();

  private canUpdateThemeFn: () => boolean;

  private canUpdateModeFn: () => boolean;

  private mediaQuery: MediaQueryList;

  constructor(options: ThemeControllerOptions = { themeObject }) {
    this.storage = options.storage || new LocalStorageAdapter();
    this.storageKey = options.storageKey || 'superset-theme';
    this.modeStorageKey = options.modeStorageKey || `${this.storageKey}-mode`;
    this.defaultTheme = options.defaultTheme || {};
    this.themeObject = options.themeObject;

    // Load customizations from storage
    const savedThemeJson = this.storage.getItem(this.storageKey);
    if (savedThemeJson) {
      try {
        this.customizations = JSON.parse(savedThemeJson);
      } catch (e) {
        console.error('Failed to parse saved theme:', e);
        this.storage.removeItem(this.storageKey);
      }
    }

    // Determine initial mode
    this.systemMode = ThemeController.getSystemMode();
    const savedMode = this.storage.getItem(this.modeStorageKey) as ThemeMode;
    this.currentMode = savedMode || ThemeMode.SYSTEM;

    // Apply the initial theme and mode
    this.applyTheme();

    if (options.onChange) {
      this.onChangeCallbacks.add(options.onChange);
    }
    this.canUpdateThemeFn = options.canUpdateTheme || (() => true);
    this.canUpdateModeFn = options.canUpdateMode || (() => true);

    // Listen for system theme changes to enable dynamic `SYSTEM` mode
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);
  }

  /**
   * Cleans up listeners. Should be called when the controller is no longer needed.
   */
  public destroy(): void {
    this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange);
  }

  public canUpdateTheme(): boolean {
    return this.canUpdateThemeFn();
  }

  public canUpdateMode(): boolean {
    return this.canUpdateModeFn();
  }

  public getTheme(): Theme {
    return this.themeObject;
  }

  public getCurrentMode(): ThemeMode {
    return this.currentMode;
  }

  /**
   * Sets new theme customizations (e.g., from a JSON editor).
   * This method updates the theme's appearance but preserves the current mode.
   */
  public setTheme(newCustomizations: AnyThemeConfig): void {
    if (!this.canUpdateTheme()) {
      throw new Error('User does not have permission to update the theme');
    }
    this.customizations = newCustomizations;

    if (!newCustomizations.algorithm) {
      this.currentMode = ThemeMode.LIGHT;
    }

    if (newCustomizations?.algorithm) {
      this.currentMode = newCustomizations.algorithm as ThemeMode;
    }

    this.applyTheme();
    this.persist();
    this.notifyListeners();
  }

  /**
   * Changes the theme mode (light, dark, or system).
   * This is for the mode switch.
   */
  public changeThemeMode(newMode: ThemeMode): void {
    if (!this.canUpdateMode()) {
      throw new Error('User does not have permission to update the theme mode');
    }
    if (this.currentMode === newMode) return;

    this.currentMode = newMode;

    this.applyTheme();
    this.persist();
    this.notifyListeners();
  }

  public resetTheme(): void {
    this.customizations = this.defaultTheme;
    this.applyTheme();
    this.persist();
    this.notifyListeners();
  }

  public onChange(callback: (theme: Theme) => void): () => void {
    this.onChangeCallbacks.add(callback);
    return () => {
      this.onChangeCallbacks.delete(callback);
    };
  }

  private handleSystemThemeChange = (): void => {
    const newSystemMode = ThemeController.getSystemMode();
    if (this.systemMode === newSystemMode) return;

    this.systemMode = newSystemMode;
    // If the current mode is SYSTEM, we need to re-apply the theme
    if (this.currentMode === ThemeMode.SYSTEM) {
      this.applyTheme();
      this.notifyListeners();
    }
  };

  /**
   * Centralized method to apply the current customizations and mode.
   */
  private applyTheme(): void {
    const newConfig = { ...this.customizations };

    switch (this.currentMode) {
      case ThemeMode.DARK:
        newConfig.algorithm = 'dark';
        break;
      case ThemeMode.LIGHT:
        newConfig.algorithm = 'default';
        break;
      case ThemeMode.SYSTEM:
        newConfig.algorithm =
          this.systemMode === ThemeMode.DARK ? 'dark' : 'default';
        break;
      case ThemeMode.COMPACT:
        newConfig.algorithm = 'compact';
        break;
      default:
        newConfig.algorithm = 'default';
        break;
    }

    this.themeObject.setConfig(newConfig);
  }

  private persist(): void {
    this.storage.setItem(this.modeStorageKey, this.currentMode);

    const { algorithm, ...persistedCustomizations } = this.customizations;
    this.storage.setItem(
      this.storageKey,
      JSON.stringify(persistedCustomizations),
    );
  }

  private notifyListeners(): void {
    this.onChangeCallbacks.forEach(callback => {
      try {
        callback(this.themeObject);
      } catch (e) {
        console.error('Error in theme change callback:', e);
      }
    });
  }

  static getSystemMode(): ThemeMode.DARK | ThemeMode.LIGHT {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? ThemeMode.DARK : ThemeMode.LIGHT;
  }
}
