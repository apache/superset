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
import { isValidElement, ReactElement } from 'react';
import { sharedControls } from '../shared-controls';
import {
  ControlSetItem,
  ExpandedControlItem,
  ControlOverrides,
} from '../types';

/**
 * Expand a control config item to full config in the format of
 *   {
 *     name: ...,
 *     config: {
 *        type: ...,
 *        ...
 *     }
 *   }
 *
 * Note: String references to shared controls are no longer supported.
 * All controls must be React components or control configuration objects.
 */
export function expandControlConfig(
  control: ControlSetItem,
  controlOverrides: ControlOverrides = {},
): ExpandedControlItem {
  // JSX/React element or NULL
  if (!control || isValidElement(control)) {
    return control as ReactElement;
  }
  // Check if it's a modern panel component (function with isModernPanel flag)
  if (typeof control === 'function' && (control as any).isModernPanel) {
    console.log('expandControlConfig - Found modern panel, returning as-is');
    return control as any;
  }
  // String controls are no longer supported - they must be migrated to React components
  if (typeof control === 'string') {
    throw new Error(
      `String control reference "${control}" is not supported. ` +
        `Use the corresponding React component from @superset-ui/chart-controls instead. ` +
        `For example, replace ['metrics'] with [MetricsControl()].`,
    );
  }
  // already fully expanded control config, e.g.
  // {
  //   name: 'metric',
  //   config: {
  //     type: 'SelectControl' | SelectComponent
  //   }
  // }
  if ('name' in control && 'config' in control) {
    return control;
  }
  // apply overrides with shared controls
  if ('override' in control && control.name in sharedControls) {
    const { name, override } = control;
    return {
      name,
      config: {
        ...sharedControls[name],
        ...override,
      },
    };
  }
  return null;
}
