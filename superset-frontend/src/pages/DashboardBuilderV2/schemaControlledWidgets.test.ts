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
import { SCHEMA_CONTROLLED_WIDGET_TYPES } from './schemaControlledWidgets';

// Guards the eager-import contract: this module must stay dependency-free so
// the Inspector can import it without dragging in the JSONForms graph.
test('lists the data-backed widgets that have a backend control schema', () => {
  expect(SCHEMA_CONTROLLED_WIDGET_TYPES.has('balloons')).toBe(true);
  expect(SCHEMA_CONTROLLED_WIDGET_TYPES.has('metric-tile')).toBe(true);
  expect(SCHEMA_CONTROLLED_WIDGET_TYPES.has('ag-grid-table')).toBe(true);
  // Prose / layout widgets keep the generic props form.
  expect(SCHEMA_CONTROLLED_WIDGET_TYPES.has('markdown')).toBe(false);
});
