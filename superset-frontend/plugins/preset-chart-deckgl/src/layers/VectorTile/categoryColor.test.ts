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

import { CategoricalColorNamespace } from '@superset-ui/core';
import { createCategoryColor } from './styling';

afterEach(() => CategoricalColorNamespace.getNamespace().resetColors());

test('applies a custom label colour changed after the scale was cached', () => {
  const namespace = CategoricalColorNamespace.getNamespace();
  namespace.setColor('cafe', '#ff0000');
  expect(createCategoryColor('supersetColors', 99)('cafe')).toEqual([
    255, 0, 0, 255,
  ]);
  namespace.resetColorsForLabels(['cafe']);
  namespace.setColor('cafe', '#0000ff');
  expect(createCategoryColor('supersetColors', 99)('cafe')).toEqual([
    0, 0, 255, 255,
  ]);
});

test('keeps colours stable while the custom colours are unchanged', () => {
  const colorFor = createCategoryColor('supersetColors', 98);
  const first = colorFor('park');
  colorFor('school');
  expect(createCategoryColor('supersetColors', 98)('park')).toEqual(first);
});
