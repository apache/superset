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
import memoizeOne from 'memoize-one';
import { getChartControlPanelRegistry } from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlPanelSectionConfig,
  expandControlConfig,
  isControlPanelSectionConfig,
} from '@superset-ui/chart-controls';

/**
 * Find control item from control panel config.
 */
export function findControlItem(
  controlPanelSections: (ControlPanelSectionConfig | null)[],
  controlKey: string,
) {
  return (
    controlPanelSections
      .filter(isControlPanelSectionConfig)
      .map(section => section.controlSetRows)
      .flat(2)
      .find(
        control =>
          controlKey === control ||
          (control !== null &&
            typeof control === 'object' &&
            'name' in control &&
            control.name === controlKey),
      ) ?? null
  );
}

const getMemoizedControlConfig = memoizeOne(
  (controlKey, controlPanelConfig: ControlPanelConfig) => {
    const { controlOverrides = {}, controlPanelSections = [] } =
      controlPanelConfig;
    const control = expandControlConfig(
      findControlItem(controlPanelSections, controlKey),
      controlOverrides,
    );
    return control && 'config' in control ? control.config : control;
  },
);

export const getControlConfig = function getControlConfig(
  controlKey: string,
  vizType: string,
) {
  const controlPanelConfig = getChartControlPanelRegistry().get(vizType) || {};
  return getMemoizedControlConfig(
    controlKey,
    // TODO: the ChartControlPanelRegistry is incorrectly typed and needs to
    // be fixed
    controlPanelConfig as ControlPanelConfig,
  );
};
