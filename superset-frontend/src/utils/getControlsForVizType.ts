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
                if (!control) return;
                if (typeof control === 'string') {
                  // For now, we have to look in controls.jsx to get the config for some controls.
                  // Once everything is migrated out, delete this if statement.
                  const controlConfig = (controls as any)[control];
                  if (controlConfig) {
                    controlsMap[control] = controlConfig;
                  }
                } else if (typeof control === 'function') {
                  // Handle React component references (function components)
                  const Component = control as React.ComponentType<any>;
                  const componentName = Component.name || Component.displayName || '';
                  
                  // Convert component name to control name
                  let controlName: string | null = null;
                  if (componentName.endsWith('Control')) {
                    const baseName = componentName.slice(0, -7);
                    controlName = baseName
                      .replace(/([A-Z])/g, '_$1')
                      .toLowerCase()
                      .replace(/^_/, '');
                  }
                  
                  if (controlName) {
                    // Create minimal config for React component controls
                    const componentWithConfig = Component as any;
                    controlsMap[controlName] = {
                      type: 'CustomControl',
                      ...(componentWithConfig.controlConfig || {}),
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
                  control !== null &&
                  'type' in control
                ) {
                  const element = control as any;
                  const isComponent = typeof element.type === 'function';
                  const isMarkerElement = typeof element.type === 'string' && element.props?.type;
                  
                  if (isMarkerElement) {
                    // Marker element (div with type prop) - extract config from props
                    const { name, type, ...configProps } = element.props;
                    if (name && type && typeof type === 'string' && type.endsWith('Control')) {
                      controlsMap[name] = {
                        type,
                        ...configProps,
                      };
                    }
                  } else if (isComponent) {
                    // React component - extract control name and create minimal config
                    const ComponentType = element.type;
                    const componentName = ComponentType.name || ComponentType.displayName || '';
                    
                    let controlName = element.props?.name;
                    if (!controlName && componentName.endsWith('Control')) {
                      const baseName = componentName.slice(0, -7);
                      controlName = baseName
                        .replace(/([A-Z])/g, '_$1')
                        .toLowerCase()
                        .replace(/^_/, '');
                    }
                    
                    if (controlName) {
                      // Create minimal config for React component controls
                      // The component handles its own rendering
                      controlsMap[controlName] = {
                        type: 'CustomControl',
                        ...(ComponentType.controlConfig || {}),
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
