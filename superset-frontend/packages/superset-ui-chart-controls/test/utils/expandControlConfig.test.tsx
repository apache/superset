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
  expandControlConfig,
  sharedControls,
  CustomControlItem,
  sharedControlComponents,
} from '../../src';

describe('expandControlConfig()', () => {
  test('expands shared control alias', () => {
    expect(expandControlConfig('metrics')).toEqual({
      name: 'metrics',
      config: sharedControls.metrics,
    });
  });

  test('expands control with overrides', () => {
    expect(
      expandControlConfig({
        name: 'metrics',
        override: {
          label: 'Custom Metric',
        },
      }),
    ).toEqual({
      name: 'metrics',
      config: {
        ...sharedControls.metrics,
        label: 'Custom Metric',
      },
    });
  });

  test('leave full control untouched', () => {
    const input = {
      name: 'metrics',
      config: {
        type: 'SelectControl',
        label: 'Custom Metric',
      },
    };
    expect(expandControlConfig(input)).toEqual(input);
  });

  test('load shared components in chart-controls', () => {
    const input = {
      name: 'metrics',
      config: {
        type: 'RadioButtonControl',
        label: 'Custom Metric',
      },
    };
    expect(
      (expandControlConfig(input) as CustomControlItem).config.type,
    ).toEqual(sharedControlComponents.RadioButtonControl);
  });

  test('leave NULL and ReactElement untouched', () => {
    expect(expandControlConfig(null)).toBeNull();
    const input = <h1>Test</h1>;
    expect(expandControlConfig(input)).toBe(input);
  });

  test('leave unknown text untouched', () => {
    const input = 'superset-ui';
    expect(expandControlConfig(input as never)).toBe(input);
  });

  test('return null for invalid configs', () => {
    expect(
      expandControlConfig({ type: 'SelectControl', label: 'Hello' } as never),
    ).toBeNull();
  });
});
