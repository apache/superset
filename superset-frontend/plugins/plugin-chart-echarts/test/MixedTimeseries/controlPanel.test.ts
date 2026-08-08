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
  const labelPositionCtrl: any = getControl('label_position');
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
  const labelPositionBCtrl: any = getControl('label_positionB');
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
