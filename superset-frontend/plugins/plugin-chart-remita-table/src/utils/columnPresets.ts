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
 * Column Preset System
 *
 * Allows users to save and manage different column configurations including:
 * - Column visibility
 * - Column order
 * - Column widths
 * - Pinned columns (left/right)
 */

export interface ColumnPreset {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
  configuration: ColumnConfiguration;
}

export interface ColumnConfiguration {
  visibleColumns: string[] | null; // null means all visible
  columnWidths: Record<string, number>;
  pinnedLeft: string[];
  pinnedRight: string[];
  columnOrder?: string[]; // Optional explicit column order
}

export interface PresetMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}

const STORAGE_PREFIX = 'remita_table_presets_';
const DEFAULT_PRESET_NAME = 'Default';

/**
 * Generate unique preset ID
 */
function generatePresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get storage key for a specific table
 */
function getStorageKey(tableId: string): string {
  return `${STORAGE_PREFIX}${tableId}`;
}

/**
 * Load all presets for a table
 */
export function loadPresets(tableId: string): ColumnPreset[] {
  try {
    const key = getStorageKey(tableId);
    const stored = localStorage.getItem(key);
    if (!stored) return [];

    const presets = JSON.parse(stored) as ColumnPreset[];
    return Array.isArray(presets) ? presets : [];
  } catch (error) {
    console.error('Failed to load column presets:', error);
    return [];
  }
}

/**
 * Save all presets for a table
 */
function savePresets(tableId: string, presets: ColumnPreset[]): boolean {
  try {
    const key = getStorageKey(tableId);
    localStorage.setItem(key, JSON.stringify(presets));
    return true;
  } catch (error) {
    console.error('Failed to save column presets:', error);
    return false;
  }
}

/**
 * Create a new preset
 */
export function createPreset(
  tableId: string,
  name: string,
  configuration: ColumnConfiguration,
  description?: string,
  isDefault?: boolean,
): ColumnPreset | null {
  try {
    const presets = loadPresets(tableId);

    // Validate name is unique
    if (presets.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      console.error('Preset name already exists');
      return null;
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      presets.forEach(p => { p.isDefault = false; });
    }

    const newPreset: ColumnPreset = {
      id: generatePresetId(),
      name,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault,
      configuration,
    };

    presets.push(newPreset);

    if (savePresets(tableId, presets)) {
      return newPreset;
    }

    return null;
  } catch (error) {
    console.error('Failed to create preset:', error);
    return null;
  }
}

/**
 * Update an existing preset
 */
export function updatePreset(
  tableId: string,
  presetId: string,
  updates: Partial<Omit<ColumnPreset, 'id' | 'createdAt'>>,
): boolean {
  try {
    const presets = loadPresets(tableId);
    const index = presets.findIndex(p => p.id === presetId);

    if (index === -1) {
      console.error('Preset not found');
      return false;
    }

    // If setting as default, unset other defaults
    if (updates.isDefault) {
      presets.forEach(p => { p.isDefault = false; });
    }

    presets[index] = {
      ...presets[index],
      ...updates,
      updatedAt: Date.now(),
    };

    return savePresets(tableId, presets);
  } catch (error) {
    console.error('Failed to update preset:', error);
    return false;
  }
}

/**
 * Delete a preset
 */
export function deletePreset(tableId: string, presetId: string): boolean {
  try {
    const presets = loadPresets(tableId);
    const filtered = presets.filter(p => p.id !== presetId);

    if (filtered.length === presets.length) {
      console.error('Preset not found');
      return false;
    }

    return savePresets(tableId, filtered);
  } catch (error) {
    console.error('Failed to delete preset:', error);
    return false;
  }
}

/**
 * Get a specific preset by ID
 */
export function getPreset(tableId: string, presetId: string): ColumnPreset | null {
  try {
    const presets = loadPresets(tableId);
    return presets.find(p => p.id === presetId) || null;
  } catch (error) {
    console.error('Failed to get preset:', error);
    return null;
  }
}

/**
 * Get the default preset
 */
export function getDefaultPreset(tableId: string): ColumnPreset | null {
  try {
    const presets = loadPresets(tableId);
    return presets.find(p => p.isDefault) || null;
  } catch (error) {
    console.error('Failed to get default preset:', error);
    return null;
  }
}

/**
 * Set a preset as default
 */
export function setDefaultPreset(tableId: string, presetId: string): boolean {
  try {
    const presets = loadPresets(tableId);

    // Unset all defaults
    presets.forEach(p => { p.isDefault = false; });

    // Set new default
    const preset = presets.find(p => p.id === presetId);
    if (!preset) {
      console.error('Preset not found');
      return false;
    }

    preset.isDefault = true;
    preset.updatedAt = Date.now();

    return savePresets(tableId, presets);
  } catch (error) {
    console.error('Failed to set default preset:', error);
    return false;
  }
}

/**
 * Get preset metadata (without full configuration)
 */
export function getPresetsMetadata(tableId: string): PresetMetadata[] {
  try {
    const presets = loadPresets(tableId);
    return presets.map(({ id, name, description, createdAt, updatedAt, isDefault }) => ({
      id,
      name,
      description,
      createdAt,
      updatedAt,
      isDefault,
    }));
  } catch (error) {
    console.error('Failed to get presets metadata:', error);
    return [];
  }
}

/**
 * Duplicate a preset
 */
export function duplicatePreset(
  tableId: string,
  presetId: string,
  newName: string,
): ColumnPreset | null {
  try {
    const preset = getPreset(tableId, presetId);
    if (!preset) {
      console.error('Preset not found');
      return null;
    }

    return createPreset(
      tableId,
      newName,
      preset.configuration,
      preset.description ? `Copy of ${preset.description}` : undefined,
      false, // Don't set copy as default
    );
  } catch (error) {
    console.error('Failed to duplicate preset:', error);
    return null;
  }
}

/**
 * Export presets to JSON
 */
export function exportPresets(tableId: string): string | null {
  try {
    const presets = loadPresets(tableId);
    return JSON.stringify(presets, null, 2);
  } catch (error) {
    console.error('Failed to export presets:', error);
    return null;
  }
}

/**
 * Import presets from JSON
 */
export function importPresets(
  tableId: string,
  jsonString: string,
  merge: boolean = true,
): boolean {
  try {
    const imported = JSON.parse(jsonString) as ColumnPreset[];

    if (!Array.isArray(imported)) {
      console.error('Invalid preset format');
      return false;
    }

    if (merge) {
      // Merge with existing presets
      const existing = loadPresets(tableId);
      const existingNames = new Set(existing.map(p => p.name.toLowerCase()));

      // Filter out duplicates and regenerate IDs
      const newPresets = imported
        .filter(p => !existingNames.has(p.name.toLowerCase()))
        .map(p => ({
          ...p,
          id: generatePresetId(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDefault: false, // Don't import default status
        }));

      return savePresets(tableId, [...existing, ...newPresets]);
    } else {
      // Replace all presets
      const presets = imported.map(p => ({
        ...p,
        id: generatePresetId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      return savePresets(tableId, presets);
    }
  } catch (error) {
    console.error('Failed to import presets:', error);
    return false;
  }
}

/**
 * Clear all presets for a table
 */
export function clearAllPresets(tableId: string): boolean {
  try {
    const key = getStorageKey(tableId);
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Failed to clear presets:', error);
    return false;
  }
}

/**
 * Get current column configuration from table state
 */
export function getCurrentConfiguration(
  visibleColumns: string[] | null,
  columnWidths: Record<string, number>,
  pinnedLeft: string[],
  pinnedRight: string[],
  columnOrder?: string[],
): ColumnConfiguration {
  return {
    visibleColumns,
    columnWidths,
    pinnedLeft,
    pinnedRight,
    columnOrder,
  };
}

/**
 * Validate preset name
 */
export function validatePresetName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Preset name cannot be empty' };
  }

  if (name.trim().length < 2) {
    return { valid: false, error: 'Preset name must be at least 2 characters' };
  }

  if (name.length > 50) {
    return { valid: false, error: 'Preset name must be less than 50 characters' };
  }

  // Check for invalid characters
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    return { valid: false, error: 'Preset name can only contain letters, numbers, spaces, hyphens, and underscores' };
  }

  return { valid: true };
}

/**
 * Check if preset name is available
 */
export function isPresetNameAvailable(tableId: string, name: string, excludeId?: string): boolean {
  try {
    const presets = loadPresets(tableId);
    const lowerName = name.toLowerCase();
    return !presets.some(p => p.id !== excludeId && p.name.toLowerCase() === lowerName);
  } catch (error) {
    console.error('Failed to check preset name availability:', error);
    return false;
  }
}
