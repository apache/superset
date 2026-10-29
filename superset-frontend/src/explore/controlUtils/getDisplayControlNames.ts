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
import { getChartControlPanelRegistry } from '@superset-ui/core';
import {
  ControlPanelConfig,
  expandControlConfig,
} from '@superset-ui/chart-controls';

const namesByControlPanel = new WeakMap<ControlPanelConfig, string[]>();

/**
 * The names of a viz type's controls whose change redraws the chart without
 * a new query: those flagged `renderTrigger`, and those flagged
 * `dontRefreshOnChange`, such as a map's viewport. Explore's staleness check
 * ignores the same controls.
 */
export function getDisplayControlNames(vizType: string): string[] {
  const controlPanel = getChartControlPanelRegistry().get(vizType) as
    | ControlPanelConfig
    | undefined;
  if (!controlPanel) {
    return [];
  }
  const cached = namesByControlPanel.get(controlPanel);
  if (cached) {
    return cached;
  }
  const { controlOverrides = {}, controlPanelSections = [] } = controlPanel;
  const names = controlPanelSections
    .flatMap(section => section?.controlSetRows ?? [])
    .flat()
    .map(item => expandControlConfig(item, controlOverrides))
    .filter(
      control =>
        control !== null &&
        typeof control === 'object' &&
        'config' in control &&
        (control.config.renderTrigger || control.config.dontRefreshOnChange),
    )
    .map(control => (control as { name: string }).name);
  namesByControlPanel.set(controlPanel, names);
  return names;
}
