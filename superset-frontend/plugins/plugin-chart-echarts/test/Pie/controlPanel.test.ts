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
import type { ControlPanelsContainerProps } from '@superset-ui/chart-controls';
import controlPanel from '../../src/Pie/controlPanel';
import { EchartsPieLabelOverflow } from '../../src/Pie/types';

type ControlConfig = {
  choices?: [string, string][];
  default?: unknown;
  visibility?: (props: ControlPanelsContainerProps) => boolean;
};

function findControl(name: string): ControlConfig | undefined {
  for (const section of controlPanel.controlPanelSections ?? []) {
    for (const row of section?.controlSetRows ?? []) {
      for (const item of row) {
        if (
          item &&
          typeof item === 'object' &&
          'name' in item &&
          item.name === name &&
          'config' in item
        ) {
          return item.config as ControlConfig;
        }
      }
    }
  }
  return undefined;
}

function isVisible(name: string, controls: Record<string, { value: unknown }>) {
  const visibility = findControl(name)?.visibility;
  if (!visibility) {
    throw new Error(`Control ${name} has no visibility callback`);
  }
  return visibility({
    controls,
  } as unknown as ControlPanelsContainerProps);
}

const visibleLabels = {
  show_labels: { value: true },
  label_max_width: { value: 120 },
};

test('label_max_width is visible only when labels are shown', () => {
  expect(isVisible('label_max_width', visibleLabels)).toBe(true);
  expect(
    isVisible('label_max_width', {
      ...visibleLabels,
      show_labels: { value: false },
    }),
  ).toBe(false);
});

test('label_overflow is visible when labels are shown with a max width', () => {
  expect(isVisible('label_overflow', visibleLabels)).toBe(true);
});

test('label_overflow is hidden when labels are hidden', () => {
  expect(
    isVisible('label_overflow', {
      ...visibleLabels,
      show_labels: { value: false },
    }),
  ).toBe(false);
});

test('label_overflow is hidden when the max width is 0', () => {
  expect(
    isVisible('label_overflow', {
      ...visibleLabels,
      label_max_width: { value: 0 },
    }),
  ).toBe(false);
});

test('label_overflow offers truncate and break, defaulting to truncate', () => {
  const config = findControl('label_overflow');
  expect(config?.choices?.map(([value]) => value)).toEqual([
    EchartsPieLabelOverflow.Truncate,
    EchartsPieLabelOverflow.Break,
  ]);
  expect(config?.default).toBe(EchartsPieLabelOverflow.Truncate);
});

test('label_max_width defaults to 0 (no limit)', () => {
  expect(findControl('label_max_width')?.default).toBe(0);
});
