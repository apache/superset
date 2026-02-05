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

import { useEffect, useRef, useCallback } from 'react';

/**
 * Auto-persisting column state hook
 *
 * Automatically saves column configuration to localStorage as users interact
 * with the table (resize, reorder, pin, hide/show columns). No explicit save
 * action required.
 *
 * Features:
 * - Debounced saves (avoid excessive writes)
 * - Automatic restoration on mount
 * - Per-table storage
 * - Handles errors gracefully
 */

export interface ColumnState {
  visibleColumns: string[] | null;
  columnWidths: Record<string, number>;
  pinnedLeft: string[];
  pinnedRight: string[];
  columnOrder?: string[];
}

interface UseColumnStatePersistenceProps {
  tableId: string;
  enabled?: boolean;
  debounceMs?: number;
}

const STORAGE_KEY_PREFIX = 'remita_table_state_';
const DEFAULT_DEBOUNCE_MS = 500;

/**
 * Get storage key for a specific table
 */
function getStorageKey(tableId: string): string {
  return `${STORAGE_KEY_PREFIX}${tableId}`;
}

/**
 * Load saved column state from localStorage
 */
export function loadColumnState(tableId: string): ColumnState | null {
  try {
    const key = getStorageKey(tableId);
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const state = JSON.parse(stored) as ColumnState;

    // Validate structure
    if (typeof state !== 'object' || state === null) return null;

    return state;
  } catch (error) {
    console.warn('Failed to load column state:', error);
    return null;
  }
}

/**
 * Save column state to localStorage
 */
function saveColumnState(tableId: string, state: ColumnState): boolean {
  try {
    const key = getStorageKey(tableId);
    const json = JSON.stringify(state);
    localStorage.setItem(key, json);
    return true;
  } catch (error) {
    console.error('Failed to save column state:', error);
    return false;
  }
}

/**
 * Clear saved column state
 */
export function clearColumnState(tableId: string): boolean {
  try {
    const key = getStorageKey(tableId);
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Failed to clear column state:', error);
    return false;
  }
}

/**
 * Hook to automatically persist column state
 */
export function useColumnStatePersistence({
  tableId,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseColumnStatePersistenceProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef<string>('');

  /**
   * Debounced save function
   */
  const persistState = useCallback((state: ColumnState) => {
    if (!enabled || !tableId) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce the save
    saveTimeoutRef.current = setTimeout(() => {
      try {
        // Check if state actually changed
        const stateJson = JSON.stringify(state);
        if (stateJson === lastSavedStateRef.current) {
          return; // No changes, skip save
        }

        // Save to localStorage
        if (saveColumnState(tableId, state)) {
          lastSavedStateRef.current = stateJson;
        }
      } catch (error) {
        console.error('Error persisting column state:', error);
      }
    }, debounceMs);
  }, [enabled, tableId, debounceMs]);

  /**
   * Load state on mount
   */
  const restoreState = useCallback((): ColumnState | null => {
    if (!enabled || !tableId) return null;
    return loadColumnState(tableId);
  }, [enabled, tableId]);

  /**
   * Clear persisted state
   */
  const clearPersistedState = useCallback(() => {
    if (!tableId) return false;
    lastSavedStateRef.current = '';
    return clearColumnState(tableId);
  }, [tableId]);

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    persistState,
    restoreState,
    clearPersistedState,
  };
}

/**
 * Helper to migrate old localStorage keys to new format
 */
export function migrateOldColumnState(tableId: string): ColumnState | null {
  try {
    const state: Partial<ColumnState> = {};
    let hasData = false;

    // Migrate visible columns
    const visibleRaw = localStorage.getItem(`visibleColumns_${tableId}`);
    if (visibleRaw) {
      state.visibleColumns = JSON.parse(visibleRaw);
      hasData = true;
    }

    // Migrate column widths
    const widthsRaw = localStorage.getItem(`columnWidths_${tableId}`);
    if (widthsRaw) {
      state.columnWidths = JSON.parse(widthsRaw);
      hasData = true;
    }

    // Migrate pinned left
    const leftRaw = localStorage.getItem(`pinnedLeft_${tableId}`);
    if (leftRaw) {
      state.pinnedLeft = JSON.parse(leftRaw);
      hasData = true;
    }

    // Migrate pinned right
    const rightRaw = localStorage.getItem(`pinnedRight_${tableId}`);
    if (rightRaw) {
      state.pinnedRight = JSON.parse(rightRaw);
      hasData = true;
    }

    // Migrate column order
    const orderRaw = localStorage.getItem(`columnOrder_${tableId}`);
    if (orderRaw) {
      state.columnOrder = JSON.parse(orderRaw);
      hasData = true;
    }

    if (!hasData) return null;

    // Fill in defaults for missing fields
    const fullState: ColumnState = {
      visibleColumns: state.visibleColumns ?? null,
      columnWidths: state.columnWidths ?? {},
      pinnedLeft: state.pinnedLeft ?? [],
      pinnedRight: state.pinnedRight ?? [],
      columnOrder: state.columnOrder,
    };

    // Save in new format
    saveColumnState(tableId, fullState);

    // Clean up old keys
    localStorage.removeItem(`visibleColumns_${tableId}`);
    localStorage.removeItem(`columnWidths_${tableId}`);
    localStorage.removeItem(`pinnedLeft_${tableId}`);
    localStorage.removeItem(`pinnedRight_${tableId}`);
    localStorage.removeItem(`columnOrder_${tableId}`);

    return fullState;
  } catch (error) {
    console.warn('Failed to migrate old column state:', error);
    return null;
  }
}
