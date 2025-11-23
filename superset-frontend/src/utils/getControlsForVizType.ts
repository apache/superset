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
import React from 'react';
import { isControlPanelSectionConfig } from '@superset-ui/chart-controls';
import { getChartControlPanelRegistry, JsonObject } from '@superset-ui/core';
import type { ControlMap } from 'src/components/AlteredSliceTag/types';
import { controls } from '../explore/controls';
import {
  getControlNameFromComponent,
  getControlConfigFromComponent,
} from '../explore/controlUtils';
import { ExtendedControlComponentProps } from 'plugins/plugin-chart-word-cloud/src/plugin/controls/types';

const memoizedControls = memoizeOne(
  (vizType: string, controlPanel: JsonObject | undefined): ControlMap => {
    const controlsMap: ControlMap = {};
    if (!controlPanel) return controlsMap;

    const sections = controlPanel.controlPanelSections || [];
    (Array.isArray(sections) ? sections : [])
      .filter(isControlPanelSectionConfig)
      .forEach(section => {
        if (section.controlSetRows && Array.isArray(section.controlSetRows)) {
          section.controlSetRows.forEach(row => {
            if (Array.isArray(row)) {
              row.forEach(control => {
                if (control === null || control === undefined) return;
                if (typeof control === 'string') {
                  // For now, we have to look in controls.jsx to get the config for some controls.
                  // Once everything is migrated out, delete this if statement.
                  // Type assertion needed because controls.jsx is not fully typed
                  const controlConfig = (
                    controls as Record<string, JsonObject>
                  )[control];
                  if (controlConfig) {
                    controlsMap[control] = controlConfig;
                  }
                } else if (typeof control === 'function') {
                  // Handle React component references (function components)
                  const Component =
                    control as React.ComponentType<ExtendedControlComponentProps>;
                  const controlName = getControlNameFromComponent(Component);

                  if (controlName) {
                    // Create minimal config for React component controls
                    const componentConfig =
                      getControlConfigFromComponent(Component);
                    const componentName =
                      Component.name ||
                      Component.displayName ||
                      'CustomControl';
                    // ControlMap only expects type and label as strings
                    const label = componentConfig?.label;
                    const labelString =
                      typeof label === 'string' ? label : undefined;
                    controlsMap[controlName] = {
                      type: componentName,
                      ...(labelString && { label: labelString }),
                    };
                  }
                } else if (
                  typeof control === 'object' &&
                  control &&
                  'name' in control &&
                  'config' in control
                ) {
                  // condition needed because there are elements, e.g. <hr /> in some control configs (I'm looking at you, FilterBox!)
                  const controlObj = control as {
                    name: string;
                    config: JsonObject;
                  };
                  controlsMap[controlObj.name] = controlObj.config;
                } else if (
                  // Handle React elements (component-based controls)
                  typeof control === 'object' &&
                  control != null &&
                  'type' in control
                ) {
                  const element = control as React.ReactElement;
                  const isComponent = typeof element.type === 'function';
                  const isMarkerElement =
                    typeof element.type === 'string' && element.props?.type;

                  if (isMarkerElement) {
                    // Marker element (div with type prop) - extract config from props
                    const { name, type, ...configProps } = element.props;
                    if (
                      name &&
                      type &&
                      typeof type === 'string' &&
                      type.endsWith('Control')
                    ) {
                      controlsMap[name] = {
                        type,
                        ...configProps,
                      };
                    }
                  } else if (isComponent) {
                    // React component - extract control name and create minimal config
                    const ComponentType =
                      element.type as React.ComponentType<ExtendedControlComponentProps>;
                    const controlName = getControlNameFromComponent(
                      ComponentType,
                      element.props,
                    );

                    if (controlName) {
                      // Create minimal config for React component controls
                      // The component handles its own rendering
                      const componentConfig =
                        getControlConfigFromComponent(ComponentType);
                      const componentName =
                        ComponentType.name ||
                        ComponentType.displayName ||
                        'CustomControl';
                      // ControlMap only expects type and label as strings
                      const label = componentConfig?.label;
                      const labelString =
                        typeof label === 'string' ? label : undefined;
                      controlsMap[controlName] = {
                        type: componentName,
                        ...(labelString && { label: labelString }),
                      };
                    }
                  }
                }
              });
            }
          });
        }
      });
    return controlsMap;
  },
);

const getControlsForVizType = (vizType: string): ControlMap => {
  const controlPanel = getChartControlPanelRegistry().get(vizType);
  return memoizedControls(vizType, controlPanel);
};

export default getControlsForVizType;
