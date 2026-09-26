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
import controlPanel from '../../src/Pie/controlPanel';

/**
 * Finds a named control's config from the flat controlSetRows across all sections.
 */
function findControl(name: string) {
  for (const section of controlPanel.controlPanelSections ?? []) {
    for (const row of section?.controlSetRows ?? []) {
      for (const item of row) {
        if (
          item &&
          typeof item === 'object' &&
          'name' in item &&
          (item as { name: string }).name === name
        ) {
          return (item as { name: string; config: Record<string, unknown> })
            .config;
        }
      }
    }
  }
  return undefined;
}

/**
 * Builds a minimal controls mock for visibility tests.
 */
function makeControls(overrides: Record<string, unknown> = {}) {
  return {
    show_labels: { value: true },
    label_max_width: { value: 120 },
    ...overrides,
  };
}

test('label_max_width visibility is true when show_labels is true', () => {
  const config = findControl('label_max_width');
  const visibility = config?.visibility as Function;
  expect(visibility({ controls: makeControls() })).toBe(true);
});

test('label_max_width visibility is false when show_labels is false', () => {
  const config = findControl('label_max_width');
  const visibility = config?.visibility as Function;
  expect(
    visibility({ controls: makeControls({ show_labels: { value: false } }) }),
  ).toBe(false);
});

test('label_overflow visibility is true when show_labels is true and label_max_width > 0', () => {
  const config = findControl('label_overflow');
  const visibility = config?.visibility as Function;
  expect(visibility({ controls: makeControls() })).toBe(true);
});

test('label_overflow visibility is false when show_labels is false', () => {
  const config = findControl('label_overflow');
  const visibility = config?.visibility as Function;
  expect(
    visibility({ controls: makeControls({ show_labels: { value: false } }) }),
  ).toBe(false);
});

test('label_overflow visibility is false when label_max_width is 0', () => {
  const config = findControl('label_overflow');
  const visibility = config?.visibility as Function;
  expect(
    visibility({
      controls: makeControls({ label_max_width: { value: 0 } }),
    }),
  ).toBe(false);
});
