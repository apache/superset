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

import { JsonFormsRendererRegistryEntry } from '@jsonforms/core';
import TextControlRenderer, { textControlTester } from './TextControlRenderer';
import SelectControlRenderer, {
  selectControlTester,
} from './SelectControlRenderer';
import NumberControlRenderer, {
  numberControlTester,
} from './NumberControlRenderer';
import BooleanControlRenderer, {
  booleanControlTester,
} from './BooleanControlRenderer';
import GroupRenderer, { groupTester } from './GroupRenderer';
import VerticalLayoutRenderer, {
  verticalLayoutTester,
} from './VerticalLayoutRenderer';

/**
 * AntD renderers for JSON Forms
 * These map JSON schema types to Superset's AntD-based components
 */
export const antdRenderers: JsonFormsRendererRegistryEntry[] = [
  // Basic controls
  { tester: textControlTester, renderer: TextControlRenderer },
  { tester: selectControlTester, renderer: SelectControlRenderer },
  { tester: numberControlTester, renderer: NumberControlRenderer },
  { tester: booleanControlTester, renderer: BooleanControlRenderer },

  // Layout renderers
  { tester: groupTester, renderer: GroupRenderer },
  { tester: verticalLayoutTester, renderer: VerticalLayoutRenderer },
];

export * from './TextControlRenderer';
export * from './SelectControlRenderer';
export * from './NumberControlRenderer';
export * from './BooleanControlRenderer';
export * from './GroupRenderer';
export * from './VerticalLayoutRenderer';
