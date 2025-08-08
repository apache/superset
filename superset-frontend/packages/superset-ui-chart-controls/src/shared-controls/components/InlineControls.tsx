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

import type { CustomControlItem } from '../../types';

/**
 * Helper function to create a SelectControl configuration
 */
export const SelectControl = (config: {
  name: string;
  label: string;
  default?: any;
  choices?: any[][] | (() => any[][]) | any[];
  description?: string;
  freeForm?: boolean;
  clearable?: boolean;
  multiple?: boolean;
  validators?: any[];
  renderTrigger?: boolean;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'SelectControl',
    ...config,
  },
});

/**
 * Helper function to create a TextControl configuration
 */
export const TextControl = (config: {
  name: string;
  label: string;
  default?: any;
  description?: string;
  isInt?: boolean;
  isFloat?: boolean;
  validators?: any[];
  renderTrigger?: boolean;
  placeholder?: string;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'TextControl',
    ...config,
  },
});

/**
 * Helper function to create a CheckboxControl configuration
 */
export const CheckboxControl = (config: {
  name: string;
  label: string;
  default?: boolean;
  description?: string;
  renderTrigger?: boolean;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'CheckboxControl',
    ...config,
  },
});

/**
 * Helper function to create a SliderControl configuration
 */
export const SliderControl = (config: {
  name: string;
  label: string;
  default?: number;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  renderTrigger?: boolean;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'SliderControl',
    ...config,
  },
});

/**
 * Helper function to create a RadioButtonControl configuration
 */
export const RadioButtonControl = (config: {
  name: string;
  label: string;
  default?: any;
  options?: any[][] | any[];
  description?: string;
  renderTrigger?: boolean;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'RadioButtonControl',
    ...config,
  },
});

/**
 * Helper function to create a BoundsControl configuration
 */
export const BoundsControl = (config: {
  name: string;
  label: string;
  default?: [number | null, number | null];
  description?: string;
  renderTrigger?: boolean;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'BoundsControl',
    ...config,
  },
});

/**
 * Helper function to create a ColorPickerControl configuration
 */
export const ColorPickerControl = (config: {
  name: string;
  label: string;
  default?: { r: number; g: number; b: number; a: number };
  description?: string;
  renderTrigger?: boolean;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'ColorPickerControl',
    ...config,
  },
});

/**
 * Helper function to create a DateFilterControl configuration
 */
export const DateFilterControl = (config: {
  name: string;
  label: string;
  default?: string;
  description?: string;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'DateFilterControl',
    ...config,
  },
});

/**
 * Helper function to create a SwitchControl configuration
 */
export const SwitchControl = (config: {
  name: string;
  label: string;
  default?: boolean;
  description?: string;
  renderTrigger?: boolean;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'SwitchControl',
    ...config,
  },
});

/**
 * Helper function to create a HiddenControl configuration
 */
export const HiddenControl = (config: {
  name: string;
  default?: any;
  initialValue?: any;
  description?: string;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'HiddenControl',
    ...config,
  },
});

/**
 * Helper function to create a SpatialControl configuration
 */
export const SpatialControl = (config: {
  name: string;
  label: string;
  description?: string;
  validators?: any[];
  mapStateToProps?: (state: any) => any;
  renderTrigger?: boolean;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'SpatialControl',
    ...config,
  },
});

/**
 * Helper function to create a ContourControl configuration
 */
export const ContourControl = (config: {
  name: string;
  label: string;
  description?: string;
  renderTrigger?: boolean;
  mapStateToProps?: (state: any) => any;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'ContourControl',
    ...config,
  },
});

/**
 * Helper function to create a TextAreaControl configuration
 */
export const TextAreaControl = (config: {
  name: string;
  label: string;
  default?: string;
  description?: string;
  renderTrigger?: boolean;
  rows?: number;
  placeholder?: string;
  [key: string]: any;
}): CustomControlItem => ({
  name: config.name,
  config: {
    type: 'TextAreaControl',
    ...config,
  },
});
