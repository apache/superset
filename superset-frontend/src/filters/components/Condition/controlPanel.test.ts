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
import config from './controlPanel';

type ControlItem = {
  name?: string;
  config: { label?: unknown; description?: unknown; required?: boolean };
} | null;

const controls = config.controlPanelSections.flatMap(section =>
  (section?.controlSetRows ?? []).flatMap(row => row as ControlItem[]),
);

test('Condition controlPanel requires a column', () => {
  const groupby = controls.find(item => item?.name === 'groupby');
  expect(groupby?.config.required).toBe(true);
});

test('Condition controlPanel label and description functions return strings', () => {
  const fns = controls.flatMap(item =>
    item
      ? [item.config.label, item.config.description].filter(
          (fn): fn is () => unknown => typeof fn === 'function',
        )
      : [],
  );
  expect(fns.length).toBeGreaterThan(0);
  fns.forEach(fn => expect(typeof fn()).toBe('string'));
});
