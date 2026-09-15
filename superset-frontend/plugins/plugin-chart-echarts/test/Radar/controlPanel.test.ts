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
import controlPanel from '../../src/Radar/controlPanel';

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

test('radar control panel exposes the drilldown_hierarchy control', () => {
  const control: any = getControl('drilldown_hierarchy');
  expect(control).toBeDefined();
  expect(control).not.toBeNull();
});

test('drilldown_hierarchy control defaults to an empty hierarchy', () => {
  const control: any = getControl('drilldown_hierarchy');
  expect(control.config).toBeDefined();
  expect(control.config.default).toEqual([]);
  // Drill levels must be plain column references, so ad-hoc columns are off.
  expect(control.config.freeForm).toBe(false);
  // Configures click behavior only, so editing it must not stale the chart.
  expect(control.config.renderTrigger).toBe(true);
});
