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
import { ControlStateMapping } from '@superset-ui/chart-controls';
import { QueryFormData } from '@superset-ui/core';

export const COLOR_SCHEME_TYPES = {
  fixed_color: 'fixed_color',
  categorical_palette: 'categorical_palette',
  color_breakpoints: 'color_breakpoints',
} as const;

export type ColorSchemeType =
  (typeof COLOR_SCHEME_TYPES)[keyof typeof COLOR_SCHEME_TYPES];

/* eslint camelcase: 0 */

export function formatSelectOptions(options: (string | number)[]) {
  return options.map(opt => [opt, opt.toString()]);
}

export const getSelectedColorSchemeType = (
  formData: QueryFormData,
): ColorSchemeType => {
  const { color_scheme_type } = formData;
  return color_scheme_type;
};

export const isColorSchemeTypeVisible = (
  controls: ControlStateMapping,
  colorSchemeType: ColorSchemeType,
) => controls.color_scheme_type.value === colorSchemeType;

export const getColorBySelectedColorSchemeType = (
  colorSchemeType: ColorSchemeType,
  data: any,
) => {
  console.log('data', data);
  switch (colorSchemeType) {
    case COLOR_SCHEME_TYPES.fixed_color: {
      const color = data.color_picker;
      return [color.r, color.g, color.b, 255 * color.a];
    }
    case COLOR_SCHEME_TYPES.categorical_palette:
      return data.color;
    case COLOR_SCHEME_TYPES.color_breakpoints:
      return ['#000000', '#ffffff'];
    default:
      return '#000000';
  }
};
