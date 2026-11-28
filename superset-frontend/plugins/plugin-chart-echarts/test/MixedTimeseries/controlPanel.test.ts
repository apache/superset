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
import { ControlPanelsContainerProps } from '@superset-ui/chart-controls/types';
import controlPanel from '../../src/MixedTimeseries/controlPanel';

// Narrow shape of the controls under test: enough to exercise `visibility`
// without reaching for `any`.
type VisibilityControl = {
  name: string;
  config: {
    disableStash?: boolean;
    visibility: (props: ControlPanelsContainerProps) => boolean;
  };
};

const config = controlPanel;

const getControl = (controlName: string) => {
  for (const section of config.controlPanelSections) {
    if (section && section.controlSetRows) {
      for (const row of section.controlSetRows) {
        for (const control of row) {
          if (
            typeof control === 'object' &&
            control !== null &&
            'name' in control &&
            control.name === controlName
          ) {
            return control;
          }
        }
      }
    }
  }
  return null;
};

// Mock getStandardizedControls
jest.mock('@superset-ui/chart-controls', () => {
  const actual = jest.requireActual('@superset-ui/chart-controls');
  return {
    ...actual,
    getStandardizedControls: jest.fn(() => ({
      popAllMetrics: jest.fn(() => []),
      popAllColumns: jest.fn(() => []),
    })),
  };
});

test('should have correct visibility for label_position', () => {
  const labelPositionCtrl = getControl(
    'label_position',
  ) as unknown as VisibilityControl;
  expect(labelPositionCtrl).toBeDefined();
  expect(labelPositionCtrl.config.visibility).toBeDefined();

  expect(
    labelPositionCtrl.config.visibility({
      controls: {
        show_value: { value: true },
      },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(true);

  expect(
    labelPositionCtrl.config.visibility({
      controls: {
        show_value: { value: false },
      },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(false);
});

test('should have correct visibility for label_positionB', () => {
  const labelPositionBCtrl = getControl(
    'label_positionB',
  ) as unknown as VisibilityControl;
  expect(labelPositionBCtrl).toBeDefined();
  expect(labelPositionBCtrl.config.visibility).toBeDefined();

  expect(
    labelPositionBCtrl.config.visibility({
      controls: {
        show_valueB: { value: true },
      },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(true);

  expect(
    labelPositionBCtrl.config.visibility({
      controls: {
        show_valueB: { value: false },
      },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(false);
});

test('hides Query B data controls while Dataset B metadata is loading', () => {
  const metricsBCtrl = getControl('metrics_b') as unknown as VisibilityControl;
  const loadingCtrl = getControl(
    'secondary_dataset_loading',
  ) as unknown as VisibilityControl;
  const props = {
    controls: {
      use_secondary_dataset: { value: true },
      datasource_b: { value: '42__table' },
    },
    form_data: {},
  } as unknown as ControlPanelsContainerProps;

  expect(metricsBCtrl.config.visibility(props)).toBe(false);
  expect(metricsBCtrl.config.disableStash).toBe(true);
  expect(loadingCtrl.config.visibility(props)).toBe(true);
});

test('keeps Query B data controls visible when Dataset B is disabled', () => {
  const metricsBCtrl = getControl('metrics_b') as unknown as VisibilityControl;
  const props = {
    controls: {
      use_secondary_dataset: { value: false },
    },
    form_data: {},
  } as unknown as ControlPanelsContainerProps;

  expect(metricsBCtrl.config.visibility(props)).toBe(true);
});

test('should show only_totalB based on the Query B value and stack controls', () => {
  const onlyTotalBCtrl = getControl(
    'only_totalB',
  ) as unknown as VisibilityControl;
  expect(onlyTotalBCtrl).toBeDefined();

  expect(
    onlyTotalBCtrl.config.visibility({
      controls: {
        show_value: { value: false },
        stack: { value: false },
        show_valueB: { value: true },
        stackB: { value: true },
      },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(true);

  expect(
    onlyTotalBCtrl.config.visibility({
      controls: {
        show_value: { value: true },
        stack: { value: true },
        show_valueB: { value: false },
        stackB: { value: false },
      },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(false);
});

/* --------------------------------------------------------------------------
 * Shared X-axis and time grain with a secondary dataset
 * ------------------------------------------------------------------------ */

type MappedControl = {
  name: string;
  config: {
    validationDependencies?: string[];
    mapStateToProps: (
      state: unknown,
      controlState?: { value?: unknown },
    ) => {
      choices?: [string, string][];
      externalValidationErrors?: string[];
    };
  };
};

const datasetA = {
  type: 'table',
  columns: [
    { column_name: 'ds', is_dttm: true, groupby: true, type_generic: 2 },
    { column_name: 'gender', groupby: true, type_generic: 1 },
  ],
  metrics: [],
  time_grain_sqla: [
    ['P1D', 'Day'],
    ['P1W', 'Week'],
    ['P1M', 'Month'],
  ],
};

test('time grain lists Dataset A grains when the secondary dataset is off', () => {
  const timeGrainCtrl = getControl(
    'time_grain_sqla',
  ) as unknown as MappedControl;
  const props = timeGrainCtrl.config.mapStateToProps(
    {
      datasource: datasetA,
      controls: {},
      form_data: { use_secondary_dataset: false },
    },
    { value: 'P1W' },
  );
  expect(props.choices).toEqual(datasetA.time_grain_sqla);
  expect(props.externalValidationErrors).toEqual([]);
  expect(timeGrainCtrl.config.validationDependencies).toEqual([
    'datasource_b',
    'use_secondary_dataset',
  ]);
});

test('x_axis_b re-validates when Query A X-axis or Dataset B changes', () => {
  const xAxisBCtrl = getControl('x_axis_b') as unknown as MappedControl;
  expect(xAxisBCtrl.config.validationDependencies).toEqual([
    'x_axis',
    'datasource_b',
    'use_secondary_dataset',
  ]);
});

test('x_axis_b keeps the saved value while Dataset B is loading', () => {
  const xAxisBCtrl = getControl('x_axis_b') as unknown as MappedControl;
  const props = xAxisBCtrl.config.mapStateToProps(
    {
      datasource: datasetA,
      controls: {},
      form_data: {
        use_secondary_dataset: true,
        datasource_b: '999__table',
        x_axis: 'ds',
      },
    },
    { value: 'order_date' },
  );
  expect(props.choices).toEqual([['order_date', 'order_date']]);
  expect(props.externalValidationErrors).toEqual([]);
});
