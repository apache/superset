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
export interface IntervalColorsControlProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  label?: string;
  description?: string;
  hovered?: boolean;
  renderTrigger?: boolean;
  warning?: string;
  /**
   * Live value of the sibling `intervals` control (comma-separated upper
   * bounds), supplied via `mapStateToProps`. Drives how many color rows are
   * rendered -- one per parsed bound -- so bounds stay authored in a single
   * place (the existing `intervals` text control).
   */
  intervals?: string;
  /**
   * Legacy `interval_color_indices` value (comma-separated 1-indexed
   * positions into the categorical color scheme), supplied via
   * `mapStateToProps`. Used only to seed real colors for charts saved before
   * this control existed; see `resolveLegacyColors` in index.tsx.
   */
  legacyIntervalColorIndices?: string;
  /** Current categorical color scheme, used to resolve legacy indices and to
   * pick sensible defaults for new rows. */
  colorScheme?: string;
}
