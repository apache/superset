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
import { ControlPanelState } from '@superset-ui/chart-controls';
import controlPanel from '../../../src/BigNumber/BigNumberPeriodOverPeriod/controlPanel';

type ControlItem = {
  name: string;
  config: {
    default?: unknown;
    mapStateToProps?: (state: ControlPanelState) => Record<string, unknown>;
  };
};

const findControl = (name: string): ControlItem => {
  const control = controlPanel.controlPanelSections
    .flatMap(section => section?.controlSetRows ?? [])
    .flat()
    .find(
      (item): item is ControlItem =>
        typeof item === 'object' &&
        item !== null &&
        'name' in item &&
        item.name === name,
    );
  if (!control) throw new Error(`control ${name} not found`);
  return control;
};

const fallbackFor = (name: string, formData: Record<string, unknown>) =>
  findControl(name).config.mapStateToProps?.({
    form_data: formData,
  } as unknown as ControlPanelState).fallbackValue;

test('comparison color pickers keep no stored default', () => {
  expect(findControl('increase_color').config.default).toBeUndefined();
  expect(findControl('decrease_color').config.default).toBeUndefined();
});

test('comparison color pickers show the semantic colors the chart paints when unset', () => {
  expect(fallbackFor('increase_color', {})).toBe('Green');
  expect(fallbackFor('decrease_color', {})).toBe('Red');
});

test('comparison color pickers show the reversed legacy Red scheme when unset', () => {
  const formData = { comparison_color_scheme: 'Red' };
  expect(fallbackFor('increase_color', formData)).toBe('Red');
  expect(fallbackFor('decrease_color', formData)).toBe('Green');
});
