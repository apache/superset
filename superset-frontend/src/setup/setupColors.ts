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
  CategoricalScheme,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
  SequentialScheme,
  CategoricalAirbnb,
  CategoricalD3,
  CategoricalEcharts,
  CategoricalGoogle,
  CategoricalLyft,
  CategoricalPreset,
  CategoricalSuperset,
  SequentialCommon,
  SequentialD3,
  ColorSchemeRegistry,
} from '@superset-ui/core';

function registerColorSchemes(
  registry: ColorSchemeRegistry<unknown>,
  colorSchemes: (CategoricalScheme | SequentialScheme)[],
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
  extraCategoricalColorSchemes: CategoricalScheme[] = [],
  extraSequentialColorSchemes: SequentialScheme[] = [],
) {
  registerColorSchemes(
    // @ts-ignore
    getCategoricalSchemeRegistry(),
    [
      ...CategoricalAirbnb,
      ...CategoricalD3,
      ...CategoricalEcharts,
      ...CategoricalGoogle,
      ...CategoricalLyft,
      ...CategoricalPreset,
      ...CategoricalSuperset,
      ...extraCategoricalColorSchemes,
    ],
    'supersetColors',
  );
  registerColorSchemes(
    // @ts-ignore
    getSequentialSchemeRegistry(),
    [...SequentialCommon, ...SequentialD3, ...extraSequentialColorSchemes],
    'superset_seq_1',
  );
}
