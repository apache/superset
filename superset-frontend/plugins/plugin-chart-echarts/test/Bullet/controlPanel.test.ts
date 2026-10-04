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
import controlPanel from '../../src/Bullet/controlPanel';

test('range_colors keeps its value when hidden so retyping ranges does not lose colors', () => {
  const items = controlPanel.controlPanelSections
    .flatMap(section => section?.controlSetRows ?? [])
    .flat();
  const rangeColors = items.find(
    item =>
      typeof item === 'object' &&
      item !== null &&
      'name' in item &&
      item.name === 'range_colors',
  ) as { config: { resetOnHide?: boolean } } | undefined;
  expect(rangeColors?.config.resetOnHide).toBe(false);
});
