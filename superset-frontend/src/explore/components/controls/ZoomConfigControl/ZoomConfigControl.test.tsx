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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import ZoomConfigControl from './ZoomConfigControl';
import { ZoomConfigs } from './types';

jest.mock('./ZoomConfigsChart', () => () => null);

jest.mock('../ColumnConfigControl/ControlForm', () => {
  const nextValues: Record<string, number> = {
    baseWidth: 101,
    baseHeight: 101,
    slope: 3,
    exponent: 1.2,
  };

  return {
    ControlFormItem: ({
      name,
      onAfterChange,
    }: {
      name: string;
      onAfterChange?: (value: number) => void;
    }) => (
      <button
        type="button"
        aria-label={name}
        onClick={() => onAfterChange?.(nextValues[name])}
      />
    ),
  };
});

test.each([
  {
    field: 'width' as const,
    controlName: 'baseWidth',
    nextValue: 101,
    value: {
      type: 'FIXED',
      configs: { zoom: 5, width: 100, height: 100 },
      values: {},
    } satisfies ZoomConfigs,
  },
  {
    field: 'height' as const,
    controlName: 'baseHeight',
    nextValue: 101,
    value: {
      type: 'FIXED',
      configs: { zoom: 5, width: 100, height: 100 },
      values: {},
    } satisfies ZoomConfigs,
  },
  {
    field: 'slope' as const,
    controlName: 'slope',
    nextValue: 3,
    value: {
      type: 'LINEAR',
      configs: { zoom: 5, width: 100, height: 100, slope: 2 },
      values: {},
    } satisfies ZoomConfigs,
  },
  {
    field: 'exponent' as const,
    controlName: 'exponent',
    nextValue: 1.2,
    value: {
      type: 'EXP',
      configs: { zoom: 5, width: 100, height: 100, exponent: 1 },
      values: {},
    } satisfies ZoomConfigs,
  },
])(
  'copies configs for $field without mutating the incoming value',
  async ({ field, controlName, nextValue, value }) => {
    const onChange = jest.fn();
    const originalFieldValue = value.configs[field];
    Object.freeze(value.configs);

    render(
      <ZoomConfigControl
        name="zoomConfig"
        label="Zoom configuration"
        onChange={onChange}
        value={value}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: controlName }));

    expect(value.configs[field]).toBe(originalFieldValue);
    expect(onChange).toHaveBeenCalled();
    const updatedValue = onChange.mock.lastCall?.[0] as ZoomConfigs;
    expect(updatedValue.configs).not.toBe(value.configs);
    expect(updatedValue.configs[field]).toBe(nextValue);
  },
);
