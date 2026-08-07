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
import type { dashboard as dashboardApi } from '@apache-superset/core';
import type { useTheme } from '@apache-superset/core/theme';

type LayoutProps = dashboardApi.LayoutProps;
type Theme = ReturnType<typeof useTheme>;

/** Column count a container falls back to when its layout omits `columns`. */
export const DEFAULT_COLUMNS = 24;

const DEFAULT_GAP = 16;

/** A container's resolved grid geometry, in the plain numbers `CanvasBlock` feeds to `react-grid-layout` (`cols`/`rowHeight`/`margin`). */
export interface GridMetrics {
  columns: number;
  gap: number;
  rowUnitPx: number;
}

/**
 * Resolves a container's grid geometry, applying the same defaults every
 * consumer of a node's `layout` needs to agree on — `rowUnit` falls back to
 * a size derived from the theme rather than a bare literal, since it's meant
 * to track the app's own spacing scale, not an arbitrary pixel value.
 */
export function resolveGridMetrics(
  layout: LayoutProps | undefined,
  theme: Theme,
): GridMetrics {
  return {
    columns: layout?.columns ?? DEFAULT_COLUMNS,
    gap: layout?.gap ?? DEFAULT_GAP,
    rowUnitPx: layout?.rowUnit ?? theme.sizeUnit * 8,
  };
}
