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
import { theme as themeApi } from '@apache-superset/core';
import { getCategoricalSchemeRegistry } from '@superset-ui/core';
import type {
  CategoricalScheme,
  CategoricalSchemeRegistryLike,
} from '@apache-superset/core/theme';

const getRegistry = () =>
  getCategoricalSchemeRegistry() as CategoricalSchemeRegistryLike | null;

const getCategoricalSchemeNames: typeof themeApi.getCategoricalSchemeNames =
  () => (getRegistry()?.keys() ?? []).sort();

const getCategoricalSchemes: typeof themeApi.getCategoricalSchemes = () => {
  const registry = getRegistry();
  return getCategoricalSchemeNames()
    .map(name => registry?.get(name))
    .filter((scheme): scheme is CategoricalScheme => scheme != null);
};

const getSchemeColors: typeof themeApi.getSchemeColors = schemeName =>
  getRegistry()?.get(schemeName)?.colors ?? null;

/**
 * Host implementation of the @apache-superset/core/theme color API.
 * Spreads the contract namespace (types, enum, styling helpers) and supplies
 * the runtime implementations for the declare-only registry bridge functions.
 */
export const theme: typeof themeApi = {
  ...themeApi,
  getCategoricalSchemeNames,
  getCategoricalSchemes,
  getSchemeColors,
};
