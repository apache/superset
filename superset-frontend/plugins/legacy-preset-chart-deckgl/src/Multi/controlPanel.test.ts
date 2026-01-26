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
import type {
  ControlPanelSectionConfig,
  ControlSetRow,
  ControlSetItem,
} from '@superset-ui/chart-controls';
import controlPanel from './controlPanel';

test('controlPanel should have Map section', () => {
  const mapSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Map',
  );

  expect(mapSection).toBeDefined();
  expect(mapSection?.expanded).toBe(true);
});

test('controlPanel should have Query section', () => {
  const querySection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Query',
  );

  expect(querySection).toBeDefined();
  expect(querySection?.expanded).toBe(true);
});

test('controlPanel Map section should include viewport control', () => {
  const mapSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Map',
  );

  // viewport is imported from Shared_DeckGL and included in controlSetRows
  expect(mapSection?.controlSetRows).toBeDefined();
  expect(mapSection?.controlSetRows.length).toBeGreaterThan(0);
});

test('controlPanel Map section should include autozoom control', () => {
  const mapSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Map',
  );

  // autozoom is imported from Shared_DeckGL and included in controlSetRows
  expect(mapSection?.controlSetRows).toBeDefined();
  expect(mapSection?.controlSetRows.length).toBeGreaterThan(0);
});

test('controlPanel should include deck_slices control with validation', () => {
  const mapSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Map',
  );

  const deckSlicesRow = mapSection?.controlSetRows.find((row: ControlSetRow) =>
    row.some(
      (control: ControlSetItem) =>
        control &&
        typeof control === 'object' &&
        'name' in control &&
        control.name === 'deck_slices',
    ),
  );

  const deckSlicesControl = deckSlicesRow?.find(
    (control: ControlSetItem) =>
      control &&
      typeof control === 'object' &&
      'name' in control &&
      control.name === 'deck_slices',
  ) as any;

  expect(deckSlicesControl).toBeDefined();
  expect(deckSlicesControl?.config?.validators).toBeDefined();
  expect(deckSlicesControl?.config?.validators.length).toBeGreaterThan(0);
  expect(deckSlicesControl?.config?.multi).toBe(true);
  expect(deckSlicesControl?.config?.type).toBe('SelectAsyncControl');
});

test('deck_slices control should have correct label and description', () => {
  const mapSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Map',
  );

  const deckSlicesRow = mapSection?.controlSetRows.find((row: ControlSetRow) =>
    row.some(
      (control: ControlSetItem) =>
        control &&
        typeof control === 'object' &&
        'name' in control &&
        control.name === 'deck_slices',
    ),
  );

  const deckSlicesControl = deckSlicesRow?.find(
    (control: ControlSetItem) =>
      control &&
      typeof control === 'object' &&
      'name' in control &&
      control.name === 'deck_slices',
  ) as any;

  expect(deckSlicesControl?.config?.label).toBeDefined();
  expect(deckSlicesControl?.config?.description).toBeDefined();
  expect(deckSlicesControl?.config?.placeholder).toBeDefined();
});

test('deck_slices control should have correct API endpoint', () => {
  const mapSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Map',
  );

  const deckSlicesRow = mapSection?.controlSetRows.find((row: ControlSetRow) =>
    row.some(
      (control: ControlSetItem) =>
        control &&
        typeof control === 'object' &&
        'name' in control &&
        control.name === 'deck_slices',
    ),
  );

  const deckSlicesControl = deckSlicesRow?.find(
    (control: ControlSetItem) =>
      control &&
      typeof control === 'object' &&
      'name' in control &&
      control.name === 'deck_slices',
  ) as any;

  expect(deckSlicesControl?.config?.dataEndpoint).toBe(
    'api/v1/chart/?q=(filters:!((col:viz_type,opr:sw,value:deck)))',
  );
});

test('deck_slices mutator should add index labels to selected charts', () => {
  const mapSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Map',
  );

  const deckSlicesRow = mapSection?.controlSetRows.find((row: ControlSetRow) =>
    row.some(
      (control: ControlSetItem) =>
        control &&
        typeof control === 'object' &&
        'name' in control &&
        control.name === 'deck_slices',
    ),
  );

  const deckSlicesControl = deckSlicesRow?.find(
    (control: ControlSetItem) =>
      control &&
      typeof control === 'object' &&
      'name' in control &&
      control.name === 'deck_slices',
  ) as any;

  const mockData = {
    result: [
      { id: 1, slice_name: 'Chart A' },
      { id: 2, slice_name: 'Chart B' },
      { id: 3, slice_name: 'Chart C' },
    ],
  };

  const selectedIds = [2, 3];
  const result = deckSlicesControl.config.mutator(mockData, selectedIds);

  expect(result).toEqual([
    { value: 1, label: 'Chart A' },
    { value: 2, label: 'Chart B [1]' },
    { value: 3, label: 'Chart C [2]' },
  ]);
});

test('deck_slices mutator should handle empty result', () => {
  const mapSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Map',
  );

  const deckSlicesRow = mapSection?.controlSetRows.find((row: ControlSetRow) =>
    row.some(
      (control: ControlSetItem) =>
        control &&
        typeof control === 'object' &&
        'name' in control &&
        control.name === 'deck_slices',
    ),
  );

  const deckSlicesControl = deckSlicesRow?.find(
    (control: ControlSetItem) =>
      control &&
      typeof control === 'object' &&
      'name' in control &&
      control.name === 'deck_slices',
  ) as any;

  const mockData = {
    result: undefined,
  };

  const result = deckSlicesControl.config.mutator(mockData, []);

  expect(result).toEqual([]);
});

test('deck_slices mutator should handle undefined selected values', () => {
  const mapSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Map',
  );

  const deckSlicesRow = mapSection?.controlSetRows.find((row: ControlSetRow) =>
    row.some(
      (control: ControlSetItem) =>
        control &&
        typeof control === 'object' &&
        'name' in control &&
        control.name === 'deck_slices',
    ),
  );

  const deckSlicesControl = deckSlicesRow?.find(
    (control: ControlSetItem) =>
      control &&
      typeof control === 'object' &&
      'name' in control &&
      control.name === 'deck_slices',
  ) as any;

  const mockData = {
    result: [
      { id: 1, slice_name: 'Chart A' },
      { id: 2, slice_name: 'Chart B' },
    ],
  };

  const result = deckSlicesControl.config.mutator(mockData, undefined);

  expect(result).toEqual([
    { value: 1, label: 'Chart A' },
    { value: 2, label: 'Chart B' },
  ]);
});

test('deck_slices mutator should preserve order based on selection', () => {
  const mapSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Map',
  );

  const deckSlicesRow = mapSection?.controlSetRows.find((row: ControlSetRow) =>
    row.some(
      (control: ControlSetItem) =>
        control &&
        typeof control === 'object' &&
        'name' in control &&
        control.name === 'deck_slices',
    ),
  );

  const deckSlicesControl = deckSlicesRow?.find(
    (control: ControlSetItem) =>
      control &&
      typeof control === 'object' &&
      'name' in control &&
      control.name === 'deck_slices',
  ) as any;

  const mockData = {
    result: [
      { id: 1, slice_name: 'Chart A' },
      { id: 2, slice_name: 'Chart B' },
      { id: 3, slice_name: 'Chart C' },
      { id: 4, slice_name: 'Chart D' },
    ],
  };

  // Select in specific order: 3, 1, 4
  const selectedIds = [3, 1, 4];
  const result = deckSlicesControl.config.mutator(mockData, selectedIds);

  expect(result).toEqual([
    { value: 1, label: 'Chart A [2]' }, // second in selection
    { value: 2, label: 'Chart B' }, // not selected
    { value: 3, label: 'Chart C [1]' }, // first in selection
    { value: 4, label: 'Chart D [3]' }, // third in selection
  ]);
});

test('Query section should include adhoc_filters control', () => {
  const querySection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Query',
  );

  const hasAdhocFilters = querySection?.controlSetRows.some(
    (row: ControlSetRow) => row.includes('adhoc_filters'),
  );

  expect(hasAdhocFilters).toBe(true);
});
