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
import type { CategoricalSchemeRegistryLike } from '@apache-superset/core/theme';

const getCategoricalSchemeNames: typeof themeApi.getCategoricalSchemeNames =
  () => {
    const registry =
      getCategoricalSchemeRegistry() as CategoricalSchemeRegistryLike | null;
    return (registry?.keys() ?? []).sort();
  };

const getSchemeColors: typeof themeApi.getSchemeColors = schemeName => {
  const registry =
    getCategoricalSchemeRegistry() as CategoricalSchemeRegistryLike | null;
  return registry?.get(schemeName)?.colors ?? null;
};

/**
 * Host implementation of the @apache-superset/core/theme color API.
 * Spreads the contract namespace (types, enum, styling helpers) and supplies
 * the runtime implementations for the declare-only registry bridge functions.
 */
export const theme: typeof themeApi = {
  ...themeApi,
  getCategoricalSchemeNames,
  getSchemeColors,
};
