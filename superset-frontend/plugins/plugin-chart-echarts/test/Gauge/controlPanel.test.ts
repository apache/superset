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
import controlPanel from '../../src/Gauge/controlPanel';

type ControlItem = {
  name: string;
  config: {
    type: string;
    hidden?: boolean;
    mapStateToProps?: (state: ControlPanelState) => Record<string, unknown>;
  };
};

const findControl = (name: string): ControlItem | undefined =>
  controlPanel.controlPanelSections
    .flatMap(section => section?.controlSetRows ?? [])
    .flat()
    .find(
      (item): item is ControlItem =>
        typeof item === 'object' &&
        item !== null &&
        'name' in item &&
        item.name === name,
    );

test('keeps the legacy interval_color_indices registered as a hidden control', () => {
  // Explore builds the chart's query and save form data from registered
  // controls only, so dropping this control would silently strip a legacy
  // chart's palette-relative colors: it would preview with positional
  // colors and lose the indices on its next save.
  const legacy = findControl('interval_color_indices');
  expect(legacy?.config.type).toBe('HiddenControl');
  expect(legacy?.config.hidden).toBe(true);
});

test('interval_colors reads the legacy indices from the hidden control, falling back to form_data', () => {
  const mapStateToProps =
    findControl('interval_colors')?.config.mapStateToProps;
  expect(mapStateToProps).toBeDefined();

  const fromControl = mapStateToProps?.({
    controls: {
      intervals: { value: '20,40,60' },
      interval_color_indices: { value: '3,2,1' },
      color_scheme: { value: 'supersetColors' },
    },
    form_data: { interval_color_indices: 'stale' },
  } as unknown as ControlPanelState);
  expect(fromControl).toMatchObject({
    intervals: '20,40,60',
    legacyIntervalColorIndices: '3,2,1',
    colorScheme: 'supersetColors',
  });

  const fromFormData = mapStateToProps?.({
    controls: { intervals: { value: '20,40,60' } },
    form_data: { interval_color_indices: '2,3' },
  } as unknown as ControlPanelState);
  expect(fromFormData).toMatchObject({ legacyIntervalColorIndices: '2,3' });
});
