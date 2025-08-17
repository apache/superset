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
import {
  DatasourceType,
  getChartControlPanelRegistry,
} from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlPanelSectionConfig,
  expandControlConfig,
  isControlPanelSectionConfig,
} from '@superset-ui/chart-controls';

import * as SECTIONS from 'src/explore/controlPanels/sections';

const getMemoizedSectionsToRender = memoizeOne(
  (datasourceType: DatasourceType, controlPanelConfig: ControlPanelConfig) => {
    const {
      sectionOverrides = {},
      controlOverrides,
      controlPanelSections = [],
    } = controlPanelConfig;

    // default control panel sections
    const sections: Record<
      string,
      | ControlPanelSectionConfig
      | ControlPanelSectionConfig[]
      | Partial<ControlPanelSectionConfig>
    > = { ...SECTIONS };

    // apply section overrides
    Object.entries(sectionOverrides).forEach(([section, overrides]) => {
      if (typeof overrides === 'object' && overrides.constructor === Object) {
        sections[section] = {
          ...sections[section],
          ...overrides,
        };
      } else {
        sections[section] = overrides;
      }
    });

    const { datasourceAndVizType } = sections;

    return [datasourceAndVizType as ControlPanelSectionConfig]
      .concat(controlPanelSections.filter(isControlPanelSectionConfig))
      .map(section => {
        const { controlSetRows } = section;
        return {
          ...section,
          controlSetRows:
            controlSetRows?.map(row =>
              row
                .filter(control => control !== null && control !== undefined)
                .map(item => expandControlConfig(item, controlOverrides)),
            ) || [],
        };
      });
  },
);

/**
 * Get the clean and processed control panel sections
 */
export function getSectionsToRender(
  vizType: string,
  datasourceType: DatasourceType,
) {
  const controlPanel = getChartControlPanelRegistry().get(vizType);
  console.log('getSectionsToRender - vizType:', vizType);
  console.log('getSectionsToRender - controlPanel:', controlPanel);

  // Check if the control panel has our modern component embedded
  if (controlPanel && controlPanel.controlPanelSections) {
    const firstSection = controlPanel.controlPanelSections[0];
    if (
      firstSection &&
      firstSection.controlSetRows &&
      firstSection.controlSetRows[0]
    ) {
      const firstControl = firstSection.controlSetRows[0][0];
      console.log('First control in panel:', typeof firstControl, firstControl);
      if (
        typeof firstControl === 'function' &&
        (firstControl as any).isModernPanel
      ) {
        console.log('Found embedded modern panel! 🎉');
        // Return the existing structure which already has our modern panel
        return getMemoizedSectionsToRender(
          datasourceType,
          controlPanel as ControlPanelConfig,
        );
      }
    }
  }

  // Check if this is a modern React component at the top level
  if (
    typeof controlPanel === 'function' &&
    (controlPanel as any).isModernPanel
  ) {
    // For modern panels, return a single section containing the component
    console.log('Returning modern panel section (top level)');
    return [
      {
        label: null,
        expanded: true,
        controlSetRows: [[controlPanel as any]],
      },
    ];
  }

  // Otherwise, treat it as a traditional ControlPanelConfig
  const controlPanelConfig = (controlPanel as ControlPanelConfig) || {};
  return getMemoizedSectionsToRender(datasourceType, controlPanelConfig);
}
