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
import React, { ReactElement } from 'react';
import { sharedControls, sharedControlComponents } from '../shared-controls';
import {
  ControlType,
  ControlSetItem,
  ExpandedControlItem,
  ControlOverrides,
} from '../types';

export function expandControlType(controlType: ControlType) {
  if (
    typeof controlType === 'string' &&
    controlType in sharedControlComponents
  ) {
    return sharedControlComponents[
      controlType as keyof typeof sharedControlComponents
    ];
  }
  return controlType;
}

/**
 * Expand a shorthand control config item to full config in the format of
 *   {
 *     name: ...,
 *     config: {
 *        type: ...,
 *        ...
 *     }
 *   }
 */
export function expandControlConfig(
  control: ControlSetItem,
  controlOverrides: ControlOverrides = {},
): ExpandedControlItem {
  // one of the named shared controls
  if (typeof control === 'string' && control in sharedControls) {
    const name = control;
    return {
      name,
      config: {
        ...sharedControls[name],
        ...controlOverrides[name],
      },
    };
  }
  // JSX/React element or NULL
  if (
    !control ||
    typeof control === 'string' ||
    React.isValidElement(control)
  ) {
    return control as ReactElement;
  }
  // already fully expanded control config, e.g.
  // {
  //   name: 'metric',
  //   config: {
  //     type: 'SelectControl' | SelectComponent
  //   }
  // }
  if ('name' in control && 'config' in control) {
    return {
      ...control,
      config: {
        ...control.config,
        type: expandControlType(control.config.type as ControlType),
      },
    };
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
