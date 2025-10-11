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
import { useMemo, forwardRef } from 'react';
import { css } from '@emotion/react';
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react';
import {
  themeQuartz,
  colorSchemeDark,
  colorSchemeLight,
} from 'ag-grid-community';
import { useTheme } from '../../theme';
import { useThemeMode } from '../../theme/utils/themeUtils';

// Note: With ag-grid v34's new theming API, CSS files are injected automatically
// Do NOT import 'ag-grid-community/styles/ag-grid.css' or theme CSS files

export interface ThemedAgGridReactProps extends AgGridReactProps {
  /**
   * Optional theme parameter overrides to customize specific ag-grid theme values.
   * These will be merged with the default Superset theme values.
   *
   * @example
   * ```tsx
   * <ThemedAgGridReact
   *   rowData={data}
   *   columnDefs={columns}
   *   themeOverrides={{
   *     headerBackgroundColor: '#custom-color',
   *     fontSize: 14,
   *   }}
   * />
   * ```
   */
  themeOverrides?: Record<string, any>;
}

/**
 * ThemedAgGridReact - A wrapper around AgGridReact that applies Superset theming
 *
 * This component:
 * - Preserves the full AgGridReactProps interface for drop-in replacement
 * - Applies Superset theme variables via ag-grid's JavaScript theming API
 * - Supports automatic dark/light mode switching
 * - Allows custom theme parameter overrides
 *
 * @example
 * ```tsx
 * <ThemedAgGridReact
 *   rowData={data}
 *   columnDefs={columns}
 *   themeOverrides={{ fontSize: 14 }}
 *   // ... any other AgGridReactProps
 * />
 * ```
 */
export const ThemedAgGridReact = forwardRef<
  AgGridReact,
  ThemedAgGridReactProps
>(function ThemedAgGridReact({ themeOverrides, ...props }, ref) {
  const theme = useTheme();
  const isDarkMode = useThemeMode();

  // Get the appropriate ag-grid theme based on dark/light mode
  const agGridTheme = useMemo(() => {
    // Use quaternary fill for odd rows
    const oddRowBg = theme?.colorFillQuaternary;

    const baseTheme = isDarkMode
      ? themeQuartz.withPart(colorSchemeDark)
      : themeQuartz.withPart(colorSchemeLight);

    // Use withParams to set colors directly via ag-grid's API
    const params = {
      // Core colors
      backgroundColor: 'transparent',
      foregroundColor: theme.colorText,
      browserColorScheme: isDarkMode ? 'dark' : 'light',

      // Header styling
      headerBackgroundColor: theme.colorFillTertiary,
      headerTextColor: theme.colorTextHeading,

      // Cell and row styling
      oddRowBackgroundColor: oddRowBg,
      rowHoverColor: theme.colorFillSecondary,
      selectedRowBackgroundColor: theme.colorPrimaryBg,
      cellTextColor: theme.colorText,

      // Borders
      borderColor: theme.colorSplit,
      columnBorderColor: theme.colorSplit,

      // Interactive elements
      accentColor: theme.colorPrimary,
      rangeSelectionBorderColor: theme.colorPrimary,
      rangeSelectionBackgroundColor: theme.colorPrimaryBg,

      // Input fields (for filters)
      inputBackgroundColor: theme.colorBgContainer,
      inputBorderColor: theme.colorSplit,
      inputTextColor: theme.colorText,
      inputPlaceholderTextColor: theme.colorTextPlaceholder,

      // Typography
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSizeSM,

      // Spacing
      spacing: theme.sizeUnit,
    };

    // Only apply params if we have a valid theme
    if (!theme || !theme.colorBgBase) {
      return baseTheme;
    }

    // Merge theme overrides if provided
    const finalParams = themeOverrides
      ? { ...params, ...themeOverrides }
      : params;

    return baseTheme.withParams(finalParams);
  }, [theme, isDarkMode, themeOverrides]);

  return (
    <div
      css={css`
        width: 100%;
        height: 100%;
        .ag-cell {
          -webkit-font-smoothing: antialiased;
        }
      `}
      data-themed-ag-grid="true"
    >
      <AgGridReact ref={ref} theme={agGridTheme} {...props} />
    </div>
  );
});

// Re-export commonly used types for convenience
export type { CustomCellRendererProps } from 'ag-grid-react';

// Re-export commonly used ag-grid-community types
export type {
  ColDef,
  Column,
  GridOptions,
  GridState,
  GridReadyEvent,
  CellClickedEvent,
  CellClassParams,
  IMenuActionParams,
  IHeaderParams,
  SortModelItem,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';

// Re-export modules and themes commonly used with ThemedAgGridReact
export {
  AllCommunityModule,
  ClientSideRowModelModule,
  ModuleRegistry,
  themeQuartz,
  colorSchemeDark,
  colorSchemeLight,
} from 'ag-grid-community';

// Re-export AgGridReact for ref types
export { AgGridReact } from 'ag-grid-react';

// Export the setup function and default modules for AG-Grid
export { setupAGGridModules, defaultModules } from './setupAGGridModules';
