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
  themeObject as supersetThemeObject,
} from '@superset-ui/core';
import { ThemeAlgorithm, ThemeMode } from '@superset-ui/core/theme/types';
import type {
  BootstrapThemeData,
  BootstrapThemeDataConfig,
  SerializableThemeSettings,
} from 'src/types/bootstrapTypes';
import getBootstrapData from 'src/utils/getBootstrapData';

const DEFAULT_THEME_SETTINGS = {
  enforced: false,
  allowSwitching: true,
  allowOSPreference: true,
} as const;

const STORAGE_KEYS = {
  THEME_MODE: 'superset-theme-mode',
} as const;

const VALID_ALGORITHM_COMBINATIONS: ReadonlyArray<ReadonlySet<ThemeAlgorithm>> =
  [
    new Set([ThemeAlgorithm.DARK, ThemeAlgorithm.COMPACT]),
    new Set([ThemeAlgorithm.DEFAULT, ThemeAlgorithm.COMPACT]),
  ] as const;

const MEDIA_QUERY_DARK_SCHEME = '(prefers-color-scheme: dark)';

export class LocalStorageAdapter implements ThemeStorage {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Failed to write to localStorage:', error);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }
}

export class ThemeController {
  private themeObject: Theme;

  private storage: ThemeStorage;

  private modeStorageKey: string;

  private defaultTheme: AnyThemeConfig;

  private darkTheme: AnyThemeConfig | null;

  private themeSettings: SerializableThemeSettings;

  private systemMode: ThemeMode.DARK | ThemeMode.DEFAULT;

  private currentMode: ThemeMode;

  private readonly hasBootstrapThemes: boolean;

  private onChangeCallbacks: Set<(theme: Theme) => void> = new Set();

  private mediaQuery: MediaQueryList;

  constructor(options: ThemeControllerOptions = {}) {
    const {
      storage = new LocalStorageAdapter(),
      modeStorageKey = STORAGE_KEYS.THEME_MODE,
      themeObject: fallbackThemeObject = supersetThemeObject,
      defaultTheme = (supersetThemeObject.theme as AnyThemeConfig) ?? {},
      onChange = null,
    } = options;

    this.storage = storage;
    this.modeStorageKey = modeStorageKey;

    // Initialize bootstrap data and themes
    const {
      bootstrapDefaultTheme,
      bootstrapDarkTheme,
      bootstrapThemeSettings,
      hasBootstrapThemes,
    }: BootstrapThemeData = this.loadBootstrapData();

    this.hasBootstrapThemes = hasBootstrapThemes;
    this.themeSettings = bootstrapThemeSettings || {};

    // Set themes based on bootstrap data availability
    if (this.hasBootstrapThemes) {
      this.darkTheme = bootstrapDarkTheme || bootstrapDefaultTheme || null;
      this.defaultTheme =
        bootstrapDefaultTheme || bootstrapDarkTheme || defaultTheme;
    } else {
      this.darkTheme = null;
      this.defaultTheme = defaultTheme;
    }

    // Initialize system theme detection
    this.systemMode = ThemeController.getSystemPreferredMode();

    // Only initialize media query listener if OS preference is allowed
    if (this.shouldInitializeMediaQueryListener())
      this.initializeMediaQueryListener();

    // Initialize theme and mode
    this.currentMode = this.determineInitialMode();
    const { theme, themeObject } =
      this.createInitialThemeObject(fallbackThemeObject);

    this.themeObject = themeObject;

    // Setup change callback
    if (onChange) this.onChangeCallbacks.add(onChange);

    // Apply initial theme and persist mode
    this.applyTheme(theme);
    this.persistMode();
  }

  // Public Methods

  /**
   * Cleans up listeners and references. Should be called when the controller is no longer needed.
   */
  public destroy(): void {
    this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange);
    this.onChangeCallbacks.clear();
  }

  /**
   * Check if the user can update the theme.
   */
  public canSetTheme(): boolean {
    return !this.themeSettings?.enforced;
  }

  /**
   * Check if the user can update the theme mode.
   */
  public canSetMode(): boolean {
    return this.isModeUpdatable();
  }

  /**
   * Returns the current theme object.
   */
  public getTheme(): Theme {
    return this.themeObject;
  }

  /**
   * Returns the current theme mode.
   */
  public getCurrentMode(): ThemeMode {
    return this.currentMode;
  }

  /**
   * Sets new theme.
   * @param theme - The new theme to apply
   * @throws {Error} If the user does not have permission to update the theme
   */
  public setTheme(theme: AnyThemeConfig): void {
    this.validateThemeUpdatePermission();

    const { mode, normalizedTheme } = this.normalizeTheme(theme);
    this.currentMode = mode;

    this.updateTheme(normalizedTheme);
  }

  /**
   * Sets the theme mode (light, dark, or system).
   * @param mode - The new theme mode to apply
   * @throws {Error} If the user does not have permission to update the theme mode
   */
  public setThemeMode(mode: ThemeMode): void {
    this.validateModeUpdatePermission(mode);

    if (this.currentMode === mode) return;

    const theme: AnyThemeConfig | null = this.getThemeForMode(mode);
    if (!theme) {
      console.warn(`Theme for mode ${mode} not found, falling back to default`);
      this.fallbackToDefaultMode();
      return;
    }

    this.currentMode = mode;
    this.updateTheme(theme);
  }

  /**
   * Resets the theme to the default theme.
   */
  public resetTheme(): void {
    this.currentMode = ThemeMode.DEFAULT;
    const defaultTheme: AnyThemeConfig =
      this.getThemeForMode(ThemeMode.DEFAULT) || this.defaultTheme;

    this.updateTheme(defaultTheme);
  }

  /**
   * Handles system theme changes with error recovery.
   */
  private handleSystemThemeChange = (): void => {
    try {
      const newSystemMode: ThemeMode.DEFAULT | ThemeMode.DARK =
        ThemeController.getSystemPreferredMode();

      // Update systemMode regardless of current mode
      const oldSystemMode: ThemeMode.DEFAULT | ThemeMode.DARK = this.systemMode;
      this.systemMode = newSystemMode;

      // Only update theme if currently in SYSTEM mode and the preference changed
      if (
        this.currentMode === ThemeMode.SYSTEM &&
        oldSystemMode !== newSystemMode
      ) {
        const newTheme: AnyThemeConfig | null = this.getThemeForMode(
          ThemeMode.SYSTEM,
        );

        if (newTheme) this.updateTheme(newTheme);
      }
    } catch (error) {
      console.error('Failed to handle system theme change:', error);
    }
  };

  /**
   * Updates the theme.
   * @param theme - The new theme to apply
   */
  private updateTheme(theme?: AnyThemeConfig): void {
    try {
      // If no config provided, use current mode to get theme
      const config: AnyThemeConfig =
        theme || this.getThemeForMode(this.currentMode) || this.defaultTheme;

      // Normalize the theme
      const { normalizedTheme } = this.normalizeTheme(config);

      this.applyTheme(normalizedTheme);
      this.persistMode();
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to update theme:', error);
      this.fallbackToDefaultMode();
    }
  }

  /**
   * Fallback to default mode with error recovery.
   */
  private fallbackToDefaultMode(): void {
    this.currentMode = ThemeMode.DEFAULT;

    // Get the default theme which will have the correct algorithm
    const defaultTheme: AnyThemeConfig =
      this.getThemeForMode(ThemeMode.DEFAULT) || this.defaultTheme;

    this.applyTheme(defaultTheme);
    this.persistMode();
    this.notifyListeners();
  }

  /**
   * Registers a callback to be called when the theme changes.
   * @param callback - The callback to be called on theme change
   * @returns A function to unsubscribe from the theme change events
   */
  public onChange(callback: (theme: Theme) => void): () => void {
    this.onChangeCallbacks.add(callback);
    return () => this.onChangeCallbacks.delete(callback);
  }

  // Private Helper Methods

  /**
   * Determines whether the MediaQueryList listener for system theme changes should be initialized.
   * This checks if OS preference detection is enabled in the theme settings.
   * @returns {boolean} True if the media query listener should be initialized, false otherwise
   */
  private shouldInitializeMediaQueryListener(): boolean {
    const { allowOSPreference = DEFAULT_THEME_SETTINGS.allowOSPreference } =
      this.themeSettings || {};

    return allowOSPreference === true;
  }

  /**
   * Initializes media query listeners if OS preference is allowed
   */
  private initializeMediaQueryListener(): void {
    this.mediaQuery = window.matchMedia(MEDIA_QUERY_DARK_SCHEME);
    this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);
  }

  /**
   * Loads and validates bootstrap theme data.
   */
  private loadBootstrapData(): BootstrapThemeData {
    const {
      common: { theme = {} as BootstrapThemeDataConfig },
    } = getBootstrapData();

    const {
      default: defaultTheme,
      dark: darkTheme,
      settings: themeSettings,
    } = theme;

    const hasValidDefault: boolean = this.hasKeys(defaultTheme);
    const hasValidDark: boolean = this.hasKeys(darkTheme);
    const hasValidSettings: boolean = this.hasKeys(themeSettings);

    return {
      bootstrapDefaultTheme: hasValidDefault ? defaultTheme : null,
      bootstrapDarkTheme: hasValidDark ? darkTheme : null,
      bootstrapThemeSettings: hasValidSettings ? themeSettings : null,
      hasBootstrapThemes: hasValidDefault || hasValidDark,
    };
  }

  /**
   * Checks if an object has keys (not empty).
   */
  private hasKeys(obj: Record<string, any> | undefined | null): boolean {
    return Boolean(
      obj && typeof obj === 'object' && Object.keys(obj).length > 0,
    );
  }

  /**
   * Determines if mode updates are allowed.
   */
  private isModeUpdatable(): boolean {
    const {
      enforced = DEFAULT_THEME_SETTINGS.enforced,
      allowSwitching = DEFAULT_THEME_SETTINGS.allowSwitching,
    } = this.themeSettings || {};

    return !enforced && allowSwitching;
  }

  /**
   * Normalizes the theme configuration to ensure it has a valid algorithm.
   * @param theme - The theme configuration to normalize
   * @returns An object with normalized mode and algorithm.
   */
  private normalizeTheme(theme: AnyThemeConfig): {
    mode: ThemeMode;
    normalizedTheme: AnyThemeConfig;
  } {
    const algorithm: ThemeAlgorithm | ThemeAlgorithm[] = this.getValidAlgorithm(
      (theme?.algorithm as ThemeAlgorithm | ThemeAlgorithm[]) ||
        ThemeAlgorithm.DEFAULT,
    );

    // Extract the mode from the valid algorithm
    let mode: ThemeMode;

    if (Array.isArray(algorithm)) {
      const foundAlgorithm =
        algorithm.find(
          (m: ThemeAlgorithm) =>
            m === ThemeAlgorithm.DARK || m === ThemeAlgorithm.DEFAULT,
        ) ?? ThemeAlgorithm.DEFAULT;

      mode = this.algorithmToMode(foundAlgorithm);
    } else mode = this.algorithmToMode(algorithm);

    return {
      mode,
      normalizedTheme: {
        ...theme,
        algorithm,
      } as AnyThemeConfig,
    };
  }

  /**
   * Converts a ThemeAlgorithm to its corresponding ThemeMode.
   * @param algorithm - The theme algorithm to convert
   * @returns The corresponding theme mode
   */
  private algorithmToMode(algorithm: ThemeAlgorithm): ThemeMode {
    switch (algorithm) {
      case ThemeAlgorithm.DARK:
        return ThemeMode.DARK;
      case ThemeAlgorithm.DEFAULT:
        return ThemeMode.DEFAULT;
      case ThemeAlgorithm.COMPACT:
        return ThemeMode.DEFAULT;
      default:
        return ThemeMode.DEFAULT;
    }
  }

  /**
   * Returns the appropriate theme configuration for a given mode.
   * @param mode - The theme mode to get the configuration for
   * @returns The theme configuration for the specified mode or null if not available
   */
  private getThemeForMode(mode: ThemeMode): AnyThemeConfig | null {
    const { allowOSPreference = DEFAULT_THEME_SETTINGS.allowOSPreference } =
      this.themeSettings;

    let resolvedMode: ThemeMode = mode;

    if (mode === ThemeMode.SYSTEM) {
      if (!allowOSPreference) return null;
      resolvedMode = ThemeController.getSystemPreferredMode();
    }

    // When we don't have bootstrap themes, we need to create variants using algorithm
    if (!this.hasBootstrapThemes) {
      if (resolvedMode === ThemeMode.DARK)
        return {
          ...this.defaultTheme,
          algorithm: ThemeAlgorithm.DARK,
        };

      return {
        ...this.defaultTheme,
        algorithm: ThemeAlgorithm.DEFAULT,
      };
    }

    // When we have bootstrap themes, use them
    if (resolvedMode === ThemeMode.DARK)
      return this.darkTheme || this.defaultTheme;

    return this.defaultTheme;
  }

  /**
   * Creates the initial theme object.
   * This sets the theme based on the current mode and ensures it has the correct algorithm.
   * @param defaultThemeObject - The fallback theme object to use if no theme is set
   * @returns An object containing the theme and the themeObject
   */
  private createInitialThemeObject(defaultThemeObject: Theme): {
    theme: AnyThemeConfig;
    themeObject: Theme;
  } {
    let theme: AnyThemeConfig | null = this.getThemeForMode(this.currentMode);
    theme = theme || (defaultThemeObject.theme as AnyThemeConfig);

    const { normalizedTheme } = this.normalizeTheme(theme);

    return {
      theme: normalizedTheme,
      themeObject: Theme.fromConfig(normalizedTheme),
    };
  }

  /**
   * Determines the initial theme mode with error recovery.
   */
  private determineInitialMode(): ThemeMode {
    const {
      enforced = DEFAULT_THEME_SETTINGS.enforced,
      allowOSPreference = DEFAULT_THEME_SETTINGS.allowOSPreference,
      allowSwitching = DEFAULT_THEME_SETTINGS.allowSwitching,
    } = this.themeSettings;

    // Enforced mode always takes precedence
    if (enforced) {
      this.storage.removeItem(this.modeStorageKey);
      return ThemeMode.DEFAULT;
    }

    // When OS preference is allowed but switching is not
    // This means the user MUST follow OS preference and cannot override it
    if (allowOSPreference && !allowSwitching) {
      // Clear any saved preference since switching is not allowed
      this.storage.removeItem(this.modeStorageKey);
      return ThemeMode.SYSTEM;
    }

    // Try to restore saved mode
    const savedMode: ThemeMode | null = this.loadSavedMode();
    if (savedMode && this.isValidThemeMode(savedMode)) return savedMode;

    // Fallback to system preference if allowed and available
    if (allowOSPreference && this.getThemeForMode(this.systemMode))
      return ThemeMode.SYSTEM;

    return ThemeMode.DEFAULT;
  }

  /**
   * Safely loads saved theme mode from storage.
   */
  private loadSavedMode(): ThemeMode | null {
    try {
      const stored: string | null = this.storage.getItem(this.modeStorageKey);
      if (stored && Object.values(ThemeMode).includes(stored as ThemeMode))
        return stored as ThemeMode;

      return null;
    } catch (error) {
      console.warn('Failed to load saved theme mode:', error);
      return null;
    }
  }

  /**
   * Validates if a theme mode is valid and supported.
   * This checks if the mode is one of the known ThemeMode values.
   * @param mode - The theme mode to validate
   * @returns {boolean} True if the mode is valid, false otherwise
   */
  private isValidThemeMode(mode: ThemeMode): boolean {
    if (!Object.values(ThemeMode).includes(mode)) return false;

    // Validate that we have the required theme data for the mode
    switch (mode) {
      case ThemeMode.DARK:
        return !!(this.darkTheme || this.defaultTheme);
      case ThemeMode.DEFAULT:
        return !!this.defaultTheme;
      case ThemeMode.SYSTEM:
        return this.themeSettings?.allowOSPreference !== false;
      default:
        return true;
    }
  }

  /**
   * Validates permission to update theme.
   */
  private validateThemeUpdatePermission(): void {
    if (!this.canSetTheme())
      throw new Error('User does not have permission to update the theme');
  }

  /**
   * Validates permission to update mode.
   * @param newMode - The new mode to validate
   * @throws {Error} If the user does not have permission to update the theme mode
   * @throws {Error} If the new mode is SYSTEM and OS preference is not allowed
   */
  private validateModeUpdatePermission(newMode: ThemeMode): void {
    const {
      allowOSPreference = DEFAULT_THEME_SETTINGS.allowOSPreference,
      allowSwitching = DEFAULT_THEME_SETTINGS.allowSwitching,
    } = this.themeSettings;

    // If OS preference is allowed but switching is not,
    // don't allow any mode changes
    if (allowOSPreference && !allowSwitching)
      throw new Error(
        'Theme mode changes are not allowed when OS preference is enforced',
      );

    // Check if user can set a new theme mode
    if (!this.canSetMode())
      throw new Error('User does not have permission to update the theme mode');

    // Check if user has permissions to set OS preference as a theme mode
    if (newMode === ThemeMode.SYSTEM && !allowOSPreference)
      throw new Error('System theme mode is not allowed');
  }

  /**
   * Validates theme algorithm combinations.
   * This checks if the provided algorithm is a valid combination of ThemeMode values.
   * @param algorithm - The theme algorithm to validate
   * @returns {boolean} True if the algorithms combination is valid, false otherwise
   */
  private isValidAlgorithmCombination(algorithm: ThemeAlgorithm[]): boolean {
    const inputSet = new Set(algorithm);
    return VALID_ALGORITHM_COMBINATIONS.some(
      validCombination =>
        inputSet.size === validCombination.size &&
        [...inputSet].every(item => validCombination.has(item)),
    );
  }

  /**
   * Checks if the algorithm is a valid combination or a simple one.
   * @param algorithm - The theme mode or combination to convert
   * @returns A valid ThemeAlgorithm or ThemeAlgorithm[]
   */
  private getValidAlgorithm(
    algorithm: ThemeAlgorithm | ThemeAlgorithm[] | ThemeMode,
  ): ThemeAlgorithm | ThemeAlgorithm[] {
    if (Array.isArray(algorithm) && this.isValidAlgorithmCombination(algorithm))
      return algorithm as ThemeAlgorithm[];

    switch (algorithm) {
      case ThemeAlgorithm.DARK:
      case ThemeAlgorithm.COMPACT:
        return algorithm;
      case ThemeMode.SYSTEM:
        return this.systemMode === ThemeMode.DARK
          ? ThemeAlgorithm.DARK
          : ThemeAlgorithm.DEFAULT;
      default:
        return ThemeAlgorithm.DEFAULT;
    }
  }

  /**
   * Applies the current theme configuration.
   * This method sets the theme on the themeObject and applies it to Theme.
   * It also handles any errors that may occur during the application of the theme.
   * @param theme - The theme configuration to apply
   */
  private applyTheme(theme: AnyThemeConfig): void {
    try {
      this.themeObject.setConfig(theme);
    } catch (error) {
      console.error('Failed to apply theme:', error);
      this.fallbackToDefaultMode();
    }
  }

  /**
   * Persists the current theme mode to storage.
   */
  private persistMode(): void {
    try {
      this.storage.setItem(this.modeStorageKey, this.currentMode);
    } catch (error) {
      console.warn('Failed to persist theme mode:', error);
    }
  }

  /**
   * Notifies all registered listeners about theme changes.
   */
  private notifyListeners(): void {
    this.onChangeCallbacks.forEach(callback => {
      try {
        callback(this.themeObject);
      } catch (error) {
        console.error('Error in theme change callback:', error);
      }
    });
  }

  /**
   * Gets the system's preferred theme mode.
   * @returns {ThemeMode.DARK | ThemeMode.DEFAULT} The system's preferred theme mode
   */
  static getSystemPreferredMode(): ThemeMode.DARK | ThemeMode.DEFAULT {
    try {
      return window.matchMedia(MEDIA_QUERY_DARK_SCHEME).matches
        ? ThemeMode.DARK
        : ThemeMode.DEFAULT;
    } catch (error) {
      console.warn('Failed to detect system theme preference:', error);
      return ThemeMode.DEFAULT;
    }
  }
}
