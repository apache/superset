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
import { getColumnPickerCapabilities } from './pickerCapabilities';

test('semantic view without the adhoc-expressions feature is Saved-only', () => {
  expect(
    getColumnPickerCapabilities({
      type: 'semantic_view',
      semantic_view_features: [],
    }),
  ).toEqual({
    dimensionClassification: 'saved',
    disabledModes: ['simple', 'sqlExpression'],
    showCompatibilityFailure: true,
  });
});

test('semantic view declaring the adhoc-expressions feature keeps existing modes', () => {
  expect(
    getColumnPickerCapabilities({
      type: 'semantic_view',
      semantic_view_features: ['ADHOC_COLUMN_EXPRESSIONS'],
    }),
  ).toEqual({
    dimensionClassification: 'expression',
    disabledModes: ['sqlExpression'],
    showCompatibilityFailure: false,
  });
});

test('unknown feature strings are ignored', () => {
  expect(
    getColumnPickerCapabilities({
      type: 'semantic_view',
      semantic_view_features: ['SOME_FUTURE_FEATURE'],
    }),
  ).toEqual({
    dimensionClassification: 'saved',
    disabledModes: ['simple', 'sqlExpression'],
    showCompatibilityFailure: true,
  });

  expect(
    getColumnPickerCapabilities({
      type: 'semantic_view',
      semantic_view_features: [
        'ADHOC_COLUMN_EXPRESSIONS',
        'SOME_FUTURE_FEATURE',
      ],
    }),
  ).toEqual({
    dimensionClassification: 'expression',
    disabledModes: ['sqlExpression'],
    showCompatibilityFailure: false,
  });
});

test('semantic view without feature metadata keeps existing semantic-view behavior', () => {
  expect(getColumnPickerCapabilities({ type: 'semantic_view' })).toEqual({
    dimensionClassification: 'expression',
    disabledModes: ['sqlExpression'],
    showCompatibilityFailure: false,
  });
});

test('non-semantic datasources produce default capabilities', () => {
  expect(getColumnPickerCapabilities({ type: 'table' })).toEqual({
    dimensionClassification: 'expression',
    disabledModes: [],
    showCompatibilityFailure: false,
  });
});

test('absent datasource metadata produces default capabilities', () => {
  expect(getColumnPickerCapabilities(undefined)).toEqual({
    dimensionClassification: 'expression',
    disabledModes: [],
    showCompatibilityFailure: false,
  });
  expect(getColumnPickerCapabilities(null)).toEqual({
    dimensionClassification: 'expression',
    disabledModes: [],
    showCompatibilityFailure: false,
  });
});
