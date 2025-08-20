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
import {
  ColorPicker as AntdColorPicker,
  type ColorPickerProps as AntdColorPickerProps,
} from 'antd';
import { css, Global } from '@emotion/react';

// Re-export the AntD ColorPicker as-is for themeable usage
export type ColorPickerProps = AntdColorPickerProps;
export const ColorPicker: React.FC<ColorPickerProps> = props => (
  <>
    <Global
      styles={css`
        .ant-slider.ant-color-picker-slider.ant-slider-horizontal {
          margin: 11px 5px;
        }
        .ant-color-picker
          .ant-color-picker-input-container
          .ant-color-picker-slider-alpha,
        .ant-color-picker
          .ant-color-picker-input-container
          .ant-color-picker-alpha-input,
        .ant-color-picker
          .ant-color-picker-input-container
          .ant-color-picker-format-select {
          display: inline-flex;
        }
      `}
    />
    <AntdColorPicker {...props} />
  </>
);

// Export RGB color type for backward compatibility
export type RGBColor = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

// Export type for AntD Color object interface
export interface ColorValue {
  toRgb(): RGBColor;
  toHexString(): string;
}

export default ColorPicker;
