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
import {
  DatasourceType,
  getChartControlPanelRegistry,
} from '@superset-ui/core';
import {
  ControlPanelConfig,
  sharedControls,
} from '@superset-ui/chart-controls';
import { getSectionsToRender } from './getSectionsToRender';

const VIZ_TYPE = 'sections-to-render-test-viz';
const SECTION_LABEL = 'Time section under test';

type ExpandedRow = Array<string | { name?: string } | null | undefined>;

const controlConfig: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: SECTION_LABEL,
      expanded: true,
      controlSetRows: [
        ['granularity'],
        ['granularity_sqla', 'time_grain_sqla'],
        ['metrics'],
      ],
    },
  ],
};

function namesInSection(datasourceType: DatasourceType): string[] {
  const section = getSectionsToRender(VIZ_TYPE, datasourceType).find(
    item => item?.label === SECTION_LABEL,
  );
  if (!section) {
    throw new Error(`Section "${SECTION_LABEL}" was not rendered`);
  }
  return (section.controlSetRows as ExpandedRow[])
    .flat()
    .map(item => (typeof item === 'string' ? item : item?.name))
    .filter((name): name is string => Boolean(name));
}

const OBJECT_FORM_SECTION_LABEL = 'Object form controls';

// Mix of string references (filtered by datasource type) and the object form
// that real chart plugins use for the same controls.
const objectFormConfig: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: OBJECT_FORM_SECTION_LABEL,
      expanded: true,
      controlSetRows: [
        ['granularity'],
        ['granularity_sqla'],
        [{ name: 'granularity', config: sharedControls.granularity }],
        [
          {
            name: 'granularity_sqla',
            config: sharedControls.granularity_sqla,
          },
          { name: 'time_grain_sqla', config: sharedControls.time_grain_sqla },
        ],
      ],
    },
  ],
};

beforeEach(() => {
  getChartControlPanelRegistry().registerValue(VIZ_TYPE, controlConfig);
});

afterEach(() => {
  getChartControlPanelRegistry().remove(VIZ_TYPE);
});

test.each([
  DatasourceType.Table,
  DatasourceType.Query,
  DatasourceType.SemanticView,
])(
  'hides the legacy granularity control and keeps the sqla time controls for %s datasources',
  datasourceType => {
    const names = namesInSection(datasourceType);

    expect(names).not.toContain('granularity');
    expect(names).toEqual(
      expect.arrayContaining(['granularity_sqla', 'time_grain_sqla']),
    );
  },
);

test.each([
  DatasourceType.Dataset,
  DatasourceType.SlTable,
  DatasourceType.SavedQuery,
])(
  'hides granularity_sqla and time_grain_sqla and keeps granularity for %s datasources',
  datasourceType => {
    const names = namesInSection(datasourceType);

    expect(names).toContain('granularity');
    expect(names).not.toContain('granularity_sqla');
    expect(names).not.toContain('time_grain_sqla');
  },
);

test('keeps controls that are not datasource specific for every datasource type', () => {
  [DatasourceType.Table, DatasourceType.Dataset].forEach(datasourceType => {
    expect(namesInSection(datasourceType)).toContain('metrics');
  });
});

test('always leads with the datasource and viz type section', () => {
  const [first] = getSectionsToRender(VIZ_TYPE, DatasourceType.Table);
  const rows = (first?.controlSetRows ?? []) as ExpandedRow[];
  const names = rows
    .flat()
    .map(item => (typeof item === 'string' ? item : item?.name));

  expect(names).toEqual(expect.arrayContaining(['datasource', 'viz_type']));
});

test('returns only the default sections for an unregistered viz type', () => {
  const sections = getSectionsToRender(
    'unregistered-viz-type',
    DatasourceType.Table,
  );

  expect(sections.map(section => section?.label)).not.toContain(SECTION_LABEL);
  expect(sections.length).toBeGreaterThan(0);
});

test.each([
  [
    DatasourceType.Table,
    ['granularity_sqla', 'granularity', 'granularity_sqla', 'time_grain_sqla'],
  ],
  [
    DatasourceType.SemanticView,
    ['granularity_sqla', 'granularity', 'granularity_sqla', 'time_grain_sqla'],
  ],
  [
    DatasourceType.Dataset,
    ['granularity', 'granularity', 'granularity_sqla', 'time_grain_sqla'],
  ],
])(
  'documents that only string control references are filtered, object-form controls pass through, for %s datasources',
  (datasourceType, expectedNames) => {
    getChartControlPanelRegistry().registerValue(VIZ_TYPE, objectFormConfig);

    const section = getSectionsToRender(VIZ_TYPE, datasourceType).find(
      item => item?.label === OBJECT_FORM_SECTION_LABEL,
    );
    const rows = (section?.controlSetRows ?? []) as ExpandedRow[];
    const names = rows
      .flat()
      .map(item => (typeof item === 'string' ? item : item?.name));

    expect(names).toEqual(expectedNames);
  },
);
