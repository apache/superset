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
  themeObject,
} from '@superset-ui/core';
import { SupersetTheme, ThemeMode } from '@superset-ui/core/theme/types';

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

  constructor(options: ThemeControllerOptions = { themeObject }) {
    this.storage = options.storage || new LocalStorageAdapter();
    this.storageKey = options.storageKey || 'superset-theme';
    this.modeStorageKey = options.modeStorageKey || `${this.storageKey}-mode`;
    this.defaultTheme = options.defaultTheme || {};
    this.themeObject = options.themeObject;
    this.systemMode = ThemeController.getSystemMode(); // Determine system mode once

    // Load initial mode from storage, or default to system
    const savedMode = this.storage.getItem(this.modeStorageKey) as ThemeMode;
    this.currentMode = savedMode || ThemeMode.SYSTEM;

    const savedThemeJson = this.storage.getItem(this.storageKey);
    let initialCustomizations: AnyThemeConfig = {};

    if (savedThemeJson) {
      try {
        initialCustomizations = JSON.parse(savedThemeJson);
      } catch (e) {
        console.error('Failed to parse saved theme:', e);
        // Fallback to default if parsing fails
        initialCustomizations = {};
        this.storage.removeItem(this.storageKey); // Clear corrupted data
      }
    }

    this.customizations = this.applyModeToCustomizations(
      initialCustomizations,
      this.currentMode,
    );
    this.themeObject.setConfig(this.customizations);

    if (options.onChange) {
      this.onChangeCallbacks.add(options.onChange);
    }
    this.canUpdateThemeFn = options.canUpdateTheme || (() => true);
    this.canUpdateModeFn = options.canUpdateMode || (() => true);

    // Ensure the initial theme is persisted and listeners are notified if needed
    // (though usually, the constructor sets up the initial state, and rendering frameworks
    // will pick it up without an explicit notifyListeners call immediately)
    // this.persistTheme(); // Only if you want to immediately write initial state back
  }

  public canUpdateTheme(): boolean {
    return this.canUpdateThemeFn();
  }

  public canUpdateMode(): boolean {
    return this.canUpdateModeFn();
  }

  /**
   * Get the current theme
   */
  public getTheme(): Theme {
    return this.themeObject;
  }

  /**
   * Get the current theme mode
   */
  public getThemeMode(): ThemeMode {
    return this.currentMode;
  }

  /**
   * Get the current theme mode (light, dark, or system)
   */
  public getCurrentMode(): ThemeMode {
    return this.currentMode;
  }

  /**
   * Get the effective theme mode (light or dark) based on currentMode and systemMode
   */
  public getEffectiveMode(): ThemeMode.DARK | ThemeMode.LIGHT {
    if (this.currentMode === ThemeMode.SYSTEM) {
      return this.systemMode;
    }
    return this.currentMode;
  }

  /**
   * Set a new theme configuration
   */
  public setTheme(config: AnyThemeConfig): void {
    if (!this.canUpdateTheme()) {
      throw new Error('User does not have permission to update the theme');
    }

    // Apply the current mode algorithm to the new config
    const newCustomizations = this.applyModeToCustomizations(
      config,
      this.currentMode,
    );
    this.customizations = newCustomizations; // Update internal state

    // Set the theme with the *new* configuration object
    this.themeObject.setConfig(this.customizations);

    if (newCustomizations.algorithm) {
      this.changeThemeMode(newCustomizations.algorithm as ThemeMode);
    }
    this.changeThemeMode(ThemeMode.SYSTEM);

    this.persistTheme();
    this.notifyListeners();
  }

  /**
   * Get the default theme mode from media query (light/dark)
   */
  static getSystemMode(): ThemeMode.DARK | ThemeMode.LIGHT {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? ThemeMode.DARK : ThemeMode.LIGHT;
  }

  /**
   * Internal helper to apply the correct algorithm based on mode
   */
  private applyModeToCustomizations(
    config: AnyThemeConfig,
    mode: ThemeMode,
  ): AnyThemeConfig {
    const effectiveMode = mode === ThemeMode.SYSTEM ? this.systemMode : mode;

    const newConfig = { ...config }; // Create a shallow copy to avoid mutating the original config input

    if (effectiveMode === ThemeMode.DARK) {
      newConfig.algorithm = antdThemeImport.darkAlgorithm; // Assign the actual algorithm function
    } else {
      newConfig.algorithm = antdThemeImport.defaultAlgorithm; // Assign the actual algorithm function
    }
    return newConfig;
  }

  /**
   * Change the theme mode (light/dark/system)
   */
  public changeThemeMode(newMode: ThemeMode): void {
    if (!this.canUpdateMode()) {
      throw new Error('User does not have permission to update the theme mode');
    }

    if (this.currentMode === newMode) {
      return; // No change needed
    }

    this.currentMode = newMode; // Update the user-selected mode

    // Reapply mode-specific customizations to the existing base customizations
    this.customizations = this.applyModeToCustomizations(
      this.customizations,
      newMode,
    );

    // Set the theme with the updated customizations
    this.themeObject.setConfig(this.customizations);

    this.persistTheme();
    this.notifyListeners();
  }

  /**
   * Reset to default theme
   */
  public resetTheme(): void {
    // Reset customizations to default, then reapply current mode
    this.customizations = this.applyModeToCustomizations(
      this.defaultTheme,
      this.currentMode,
    );
    this.themeObject.setConfig(this.customizations);
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
    // Only persist the chosen mode and the base customizations (without algorithm function)
    this.storage.setItem(this.modeStorageKey, this.currentMode);

    // Remove the algorithm function before stringifying, as functions cannot be stringified
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
}
