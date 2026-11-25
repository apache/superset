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
import { validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelsContainerProps,
  ControlPanelState,
  ControlState,
  Dataset,
  TestDataset,
} from '@superset-ui/chart-controls';
import controlPanel, {
  MAX_DENSITY_BANDWIDTH,
  MIN_DENSITY_BANDWIDTH,
} from '../../src/BoxPlot/controlPanel';

type NamedControl = {
  name: string;
  config: {
    default?: unknown;
    label?: string;
    options?: [string, string][];
    renderTrigger?: boolean;
    validators?: ((value: unknown) => string | false)[];
    visibility?: (props: ControlPanelsContainerProps) => boolean;
  };
};

const controlName = (control: unknown) =>
  typeof control === 'object' && control !== null && 'name' in control
    ? (control as { name: string }).name
    : control;

const queryRowNames = () =>
  controlPanel.controlPanelSections[0]!.controlSetRows.flat().map(controlName);

const allControls = () =>
  controlPanel.controlPanelSections
    .flatMap(section => section?.controlSetRows ?? [])
    .flat();

const allControlNames = () => allControls().map(controlName);

const getControl = (name: string): NamedControl => {
  const found = allControls().find(control => controlName(control) === name);
  if (!found) {
    throw new Error(`control ${name} not found`);
  }
  return found as unknown as NamedControl;
};

const withStyle = (value?: string) =>
  ({
    controls: value === undefined ? {} : { distribution_style: { value } },
  }) as unknown as ControlPanelsContainerProps;

const validate = (value: unknown) =>
  getControl('density_bandwidth')
    .config.validators!.map(validator => validator(value))
    .find(Boolean) ?? false;

const getColumnsInitialValue = (datasource: Dataset) => {
  const initialValue = controlPanel.controlOverrides?.columns
    ?.initialValue as unknown as (
    control: ControlState,
    state: ControlPanelState | null,
  ) => unknown;

  return initialValue(
    { value: [] } as unknown as ControlState,
    {
      datasource,
    } as ControlPanelState,
  );
};

test('columns defaults to the default temporal column of the datasource', () => {
  expect(getColumnsInitialValue(TestDataset)).toEqual(['ds']);
});

test('columns stays empty when the datasource has no temporal column', () => {
  const value = getColumnsInitialValue({
    ...TestDataset,
    columns: [],
    main_dttm_col: undefined,
  } as unknown as Dataset);

  expect(value).toEqual([]);
  // an empty value must be flagged as required rather than silently accepted
  expect(validateNonEmpty(value)).toBeTruthy();
});

test('distribution style offers Box and Violin and defaults to Box', () => {
  const { config } = getControl('distribution_style');
  expect(config.default).toBe('box');
  expect(config.options?.map(([value]) => value)).toEqual(['box', 'violin']);
});

test('distribution style sits directly above the whisker options', () => {
  const names = queryRowNames();
  expect(names.indexOf('distribution_style')).toBe(
    names.indexOf('whiskerOptions') - 1,
  );
});

test('violin-only controls are hidden for box and for saved charts without a style', () => {
  ['density_bandwidth', 'show_inner_box'].forEach(name => {
    const { visibility } = getControl(name).config;
    expect(visibility!(withStyle('box'))).toBe(false);
    expect(visibility!(withStyle())).toBe(false);
  });
});

test('violin-only controls appear when violin is selected', () => {
  ['density_bandwidth', 'show_inner_box'].forEach(name => {
    expect(getControl(name).config.visibility!(withStyle('violin'))).toBe(true);
  });
});

test('curve smoothness accepts its presets and typed decimals', () => {
  [0.5, 1, 1.5, 2, '0.75', MIN_DENSITY_BANDWIDTH].forEach(value => {
    expect(validate(value)).toBe(false);
  });
});

test('curve smoothness rejects values that are not numbers', () => {
  ['', 'abc', null].forEach(value => {
    expect(validate(value)).toEqual(
      expect.stringContaining('Curve smoothness'),
    );
  });
});

test('curve smoothness rejects zero, negatives and values below the minimum', () => {
  [0, -1, '0.05'].forEach(value => {
    expect(validate(value)).toEqual(
      expect.stringContaining(String(MIN_DENSITY_BANDWIDTH)),
    );
  });
});

test('show inner box defaults on and redraws without a new query', () => {
  const { config } = getControl('show_inner_box');
  expect(config.default).toBe(true);
  expect(config.renderTrigger).toBe(true);
  expect(config.label).toBe('Show inner box');
});

test('curve smoothness accepts the maximum and rejects values above it', () => {
  expect(validate(MAX_DENSITY_BANDWIDTH)).toBe(false);
  [5.1, '10', 100].forEach(value => {
    expect(validate(value)).toEqual(
      expect.stringContaining(`cannot exceed ${MAX_DENSITY_BANDWIDTH}`),
    );
  });
});

test('violin settings sit directly below the whisker options', () => {
  const names = queryRowNames();
  const whiskers = names.indexOf('whiskerOptions');
  expect(names.slice(whiskers + 1, whiskers + 3)).toEqual([
    'density_bandwidth',
    'show_inner_box',
  ]);
});

test('distribution style and curve smoothness trigger a new query', () => {
  ['distribution_style', 'density_bandwidth'].forEach(name => {
    expect(getControl(name).config.renderTrigger).toBeFalsy();
  });
});

test('curve smoothness defaults to 1 and there is no curve detail setting', () => {
  expect(getControl('density_bandwidth').config.default).toBe(1);
  expect(allControlNames()).not.toContain('density_points');
});
