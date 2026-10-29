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
import type { SupersetTheme } from '@apache-superset/core/theme';
import type { GridThemeOverrides } from 'src/components/GridTable/types';

export function buildResultsGridThemeOverrides(
  theme: SupersetTheme,
): GridThemeOverrides | undefined {
  const overrides: GridThemeOverrides = {};

  if (typeof theme.resultsGridHeaderFontSize === 'number') {
    overrides.headerFontSize = theme.resultsGridHeaderFontSize;
  }
  if (typeof theme.resultsGridHeaderFontWeight === 'number') {
    overrides.headerFontWeight = theme.resultsGridHeaderFontWeight;
  }
  if (typeof theme.resultsGridRowHeight === 'number') {
    overrides.rowHeight = theme.resultsGridRowHeight;
    overrides.headerHeight = theme.resultsGridRowHeight;
  }
  if (typeof theme.resultsGridBorderRadius === 'number') {
    overrides.borderRadius = theme.resultsGridBorderRadius;
    overrides.wrapperBorderRadius = theme.resultsGridBorderRadius;
  }
  if (theme.resultsGridNoStriping === true) {
    overrides.oddRowBackgroundColor = 'transparent';
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
}
