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
import { Input as AntdInput, InputNumber as AntdInputNumber } from 'antd';
import { withNonTextContrast } from '../AntdThemeProvider/NonTextContrastProvider';

export const Input = Object.assign(withNonTextContrast(AntdInput), {
  Group: AntdInput.Group,
  Search: withNonTextContrast(AntdInput.Search),
  TextArea: withNonTextContrast(AntdInput.TextArea),
  Password: withNonTextContrast(AntdInput.Password),
  OTP: withNonTextContrast(AntdInput.OTP),
});

export const InputNumber = Object.assign(withNonTextContrast(AntdInputNumber), {
  _InternalPanelDoNotUseOrYouWillBeFired:
    AntdInputNumber._InternalPanelDoNotUseOrYouWillBeFired,
});

export type {
  InputProps,
  TextAreaProps,
  InputNumberProps,
  InputRef,
  TextAreaRef,
} from './types';
