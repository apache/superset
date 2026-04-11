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
 * Grouping/tier for a color scheme — controls how it appears in the
 * scheme picker UI (e.g. Featured palettes are shown first).
 *
 * Mirrors @superset-ui/core's ColorSchemeGroup; kept here so
 * palette configs have no dependency on @superset-ui/core.
 */
export enum ColorSchemeGroup {
  Custom = 'custom',
  Featured = 'featured',
  Other = 'other',
}

/** Plain configuration object for a categorical color scheme. */
export interface ColorSchemeConfig {
  id: string;
  label?: string;
  colors: string[];
  description?: string;
  isDefault?: boolean;
  group?: ColorSchemeGroup;
}

/** Extension of ColorSchemeConfig for sequential / diverging schemes. */
export interface SequentialSchemeConfig extends ColorSchemeConfig {
  isDiverging?: boolean;
}
