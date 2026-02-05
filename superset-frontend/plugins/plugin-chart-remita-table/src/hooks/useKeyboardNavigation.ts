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

import { useCallback, useEffect, useRef, useState } from 'react';
import { DataRecord } from '@superset-ui/core';

export interface CellPosition {
  rowIndex: number;
  columnIndex: number;
}

export interface KeyboardNavigationConfig<D extends DataRecord = DataRecord> {
  // Data
  rows: D[];
  columnCount: number;

  // Selection
  enableSelection?: boolean;
  selectedRows?: Map<string, D>;
  onRowSelect?: (rowId: string, row: D, multiSelect: boolean) => void;
  onRowDeselect?: (rowId: string) => void;
  onClearSelection?: () => void;
  onSelectAll?: () => void;

  // Row ID extraction
  getRowId?: (row: D, index: number) => string;

  // Context menu
  onContextMenu?: (row: D, columnKey: string) => void;

  // Actions
  onRowAction?: (row: D) => void;

  // Disabled state
  disabled?: boolean;
}

export interface KeyboardNavigationReturn {
  focusedCell: CellPosition | null;
  setFocusedCell: (position: CellPosition | null) => void;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  getCellTabIndex: (rowIndex: number, columnIndex: number) => number;
  isCellFocused: (rowIndex: number, columnIndex: number) => boolean;
  focusCell: (rowIndex: number, columnIndex: number) => void;
  clearFocus: () => void;
}

/**
 * Hook for managing keyboard navigation in the table
 *
 * Supports:
 * - Arrow key navigation (Up/Down/Left/Right)
 * - Tab/Shift+Tab for cell navigation
 * - Enter for row actions
 * - Space for row selection
 * - Ctrl+A / Cmd+A for select all
 * - Escape to clear selection/focus
 * - Ctrl+C / Cmd+C for copy (delegates to context menu)
 * - Home/End for row navigation
 * - Page Up/Page Down for page navigation
 */
export function useKeyboardNavigation<D extends DataRecord = DataRecord>(
  config: KeyboardNavigationConfig<D>
): KeyboardNavigationReturn {
  const {
    rows,
    columnCount,
    enableSelection = false,
    selectedRows,
    onRowSelect,
    onRowDeselect,
    onClearSelection,
    onSelectAll,
    getRowId = (row, index) => String((row as any).id || index),
    onContextMenu,
    onRowAction,
    disabled = false,
  } = config;

  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null);
  const lastFocusedRef = useRef<CellPosition | null>(null);
  const shiftAnchorRef = useRef<number | null>(null);

  // Update last focused when focused cell changes
  useEffect(() => {
    if (focusedCell) {
      lastFocusedRef.current = focusedCell;
    }
  }, [focusedCell]);

  const focusCell = useCallback((rowIndex: number, columnIndex: number) => {
    if (rowIndex < 0 || rowIndex >= rows.length) return;
    if (columnIndex < 0 || columnIndex >= columnCount) return;

    setFocusedCell({ rowIndex, columnIndex });

    // Try to focus the actual DOM element
    requestAnimationFrame(() => {
      const cell = document.querySelector(
        `[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`
      ) as HTMLElement;
      if (cell) {
        cell.focus();
      }
    });
  }, [rows.length, columnCount]);

  const clearFocus = useCallback(() => {
    setFocusedCell(null);
    shiftAnchorRef.current = null;
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled || !focusedCell) return;

    const { rowIndex, columnIndex } = focusedCell;
    const isShift = event.shiftKey;
    const isCtrl = event.ctrlKey || event.metaKey;
    const key = event.key;

    // Arrow navigation
    if (key === 'ArrowUp') {
      event.preventDefault();
      if (rowIndex > 0) {
        focusCell(rowIndex - 1, columnIndex);
      }
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      if (rowIndex < rows.length - 1) {
        focusCell(rowIndex + 1, columnIndex);
      }
      return;
    }

    if (key === 'ArrowLeft') {
      event.preventDefault();
      if (columnIndex > 0) {
        focusCell(rowIndex, columnIndex - 1);
      }
      return;
    }

    if (key === 'ArrowRight') {
      event.preventDefault();
      if (columnIndex < columnCount - 1) {
        focusCell(rowIndex, columnIndex + 1);
      }
      return;
    }

    // Tab navigation
    if (key === 'Tab') {
      event.preventDefault();
      if (isShift) {
        // Navigate backwards
        if (columnIndex > 0) {
          focusCell(rowIndex, columnIndex - 1);
        } else if (rowIndex > 0) {
          focusCell(rowIndex - 1, columnCount - 1);
        }
      } else {
        // Navigate forwards
        if (columnIndex < columnCount - 1) {
          focusCell(rowIndex, columnIndex + 1);
        } else if (rowIndex < rows.length - 1) {
          focusCell(rowIndex + 1, 0);
        }
      }
      return;
    }

    // Home/End navigation
    if (key === 'Home') {
      event.preventDefault();
      if (isCtrl) {
        // Go to first row
        focusCell(0, columnIndex);
      } else {
        // Go to first column
        focusCell(rowIndex, 0);
      }
      return;
    }

    if (key === 'End') {
      event.preventDefault();
      if (isCtrl) {
        // Go to last row
        focusCell(rows.length - 1, columnIndex);
      } else {
        // Go to last column
        focusCell(rowIndex, columnCount - 1);
      }
      return;
    }

    // Page Up/Down
    if (key === 'PageUp') {
      event.preventDefault();
      const newRow = Math.max(0, rowIndex - 10);
      focusCell(newRow, columnIndex);
      return;
    }

    if (key === 'PageDown') {
      event.preventDefault();
      const newRow = Math.min(rows.length - 1, rowIndex + 10);
      focusCell(newRow, columnIndex);
      return;
    }

    // Selection shortcuts
    if (enableSelection) {
      const currentRow = rows[rowIndex];
      const currentRowId = getRowId(currentRow, rowIndex);

      // Space for selection toggle
      if (key === ' ' || key === 'Spacebar') {
        event.preventDefault();
        const isSelected = selectedRows?.has(currentRowId);

        if (isShift && shiftAnchorRef.current !== null) {
          // Range selection
          const start = Math.min(shiftAnchorRef.current, rowIndex);
          const end = Math.max(shiftAnchorRef.current, rowIndex);

          for (let i = start; i <= end; i++) {
            const row = rows[i];
            const rowId = getRowId(row, i);
            if (onRowSelect) {
              onRowSelect(rowId, row, true);
            }
          }
        } else {
          // Single selection toggle
          if (isSelected && onRowDeselect) {
            onRowDeselect(currentRowId);
          } else if (onRowSelect) {
            onRowSelect(currentRowId, currentRow, isCtrl);
          }
          shiftAnchorRef.current = rowIndex;
        }
        return;
      }

      // Enter for row action
      if (key === 'Enter') {
        event.preventDefault();
        if (onRowAction) {
          onRowAction(currentRow);
        }
        return;
      }

      // Ctrl+A / Cmd+A for select all
      if (isCtrl && key === 'a') {
        event.preventDefault();
        if (onSelectAll) {
          onSelectAll();
        }
        return;
      }
    }

    // Escape to clear
    if (key === 'Escape') {
      event.preventDefault();
      if (selectedRows && selectedRows.size > 0 && onClearSelection) {
        onClearSelection();
      } else {
        clearFocus();
      }
      return;
    }

    // Context menu shortcut (Application key or Shift+F10)
    if (key === 'ContextMenu' || (isShift && key === 'F10')) {
      event.preventDefault();
      if (onContextMenu) {
        const row = rows[rowIndex];
        onContextMenu(row, String(columnIndex));
      }
      return;
    }

    // Copy shortcut (Ctrl+C / Cmd+C)
    if (isCtrl && key === 'c') {
      // Allow default browser copy behavior
      // This will copy selected text or delegate to context menu handler
      return;
    }
  }, [
    disabled,
    focusedCell,
    rows,
    columnCount,
    enableSelection,
    selectedRows,
    onRowSelect,
    onRowDeselect,
    onClearSelection,
    onSelectAll,
    getRowId,
    onContextMenu,
    onRowAction,
    focusCell,
    clearFocus,
  ]);

  const getCellTabIndex = useCallback((rowIndex: number, columnIndex: number) => {
    // Make the focused cell tabbable
    if (focusedCell?.rowIndex === rowIndex && focusedCell?.columnIndex === columnIndex) {
      return 0;
    }
    // Make the first cell tabbable if nothing is focused
    if (!focusedCell && rowIndex === 0 && columnIndex === 0) {
      return 0;
    }
    return -1;
  }, [focusedCell]);

  const isCellFocused = useCallback((rowIndex: number, columnIndex: number) => {
    return focusedCell?.rowIndex === rowIndex && focusedCell?.columnIndex === columnIndex;
  }, [focusedCell]);

  return {
    focusedCell,
    setFocusedCell,
    handleKeyDown,
    getCellTabIndex,
    isCellFocused,
    focusCell,
    clearFocus,
  };
}
