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
import {
  allCategoricalColorSchemeConfigs,
  allSequentialColorSchemeConfigs,
  ColorSchemeConfig,
  ColorSchemeGroup,
  DEFAULT_CATEGORICAL_SCHEME,
  DEFAULT_SEQUENTIAL_SCHEME,
  SequentialSchemeConfig,
} from '@apache-superset/core/colors';
import {
  CategoricalScheme,
  ColorSchemeRegistry,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
  SequentialScheme,
} from '@superset-ui/core';

function registerColorSchemes<T extends { id: string; isDefault?: boolean }>(
  registry: ColorSchemeRegistry<T>,
  colorSchemes: T[],
  standardDefaultKey: string,
) {
  colorSchemes.forEach(scheme => {
    registry.registerValue(scheme.id, scheme);
  });

  const defaultKey =
    colorSchemes.find(scheme => scheme.isDefault)?.id || standardDefaultKey;
  registry.setDefaultKey(defaultKey);
}

export default function setupColors(
  extraCategoricalColorSchemeConfigs: ColorSchemeConfig[] = [],
  extraSequentialColorSchemeConfigs: SequentialSchemeConfig[] = [],
) {
  const extraCategoricalColorSchemes = extraCategoricalColorSchemeConfigs.map(
    config =>
      new CategoricalScheme({ ...config, group: ColorSchemeGroup.Custom }),
  );
  const extraSequentialColorSchemes = extraSequentialColorSchemeConfigs.map(
    config => new SequentialScheme(config),
  );

  registerColorSchemes(
    getCategoricalSchemeRegistry(),
    [
      ...allCategoricalColorSchemeConfigs.map(c => new CategoricalScheme(c)),
      ...extraCategoricalColorSchemes,
    ],
    DEFAULT_CATEGORICAL_SCHEME,
  );

  registerColorSchemes(
    getSequentialSchemeRegistry(),
    [
      ...allSequentialColorSchemeConfigs.map(c => new SequentialScheme(c)),
      ...extraSequentialColorSchemes,
    ],
    DEFAULT_SEQUENTIAL_SCHEME,
  );
}
