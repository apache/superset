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
import React, { ReactNode } from 'react';
import { Slider, InputNumber, Input } from 'antd';
import Checkbox, { CheckboxProps } from 'antd/lib/checkbox';
import Select, { SelectOption } from '../Select';
import RadioButtonControl, {
  RadioButtonOption,
} from '../../shared-controls/components/RadioButtonControl';

export const ControlFormItemComponents = {
  Slider,
  InputNumber,
  Input,
  Select,
  // Directly export Checkbox will result in "using name from external module" error
  // ref: https://stackoverflow.com/questions/43900035/ts4023-exported-variable-x-has-or-is-using-name-y-from-external-module-but
  Checkbox: Checkbox as React.ForwardRefExoticComponent<
    CheckboxProps & React.RefAttributes<HTMLInputElement>
  >,
  RadioButtonControl,
};

export type ControlType = keyof typeof ControlFormItemComponents;

export type ControlFormValueValidator<V> = (value: V) => string | false;

export type ControlFormItemSpec<T extends ControlType = ControlType> = {
  controlType: T;
  label: ReactNode;
  description: ReactNode;
  placeholder?: string;
  required?: boolean;
  validators?: ControlFormValueValidator<any>[];
  width?: number | string;
  /**
   * Time to delay change propagation.
   */
  debounceDelay?: number;
} & (T extends 'Select'
  ? {
      options: SelectOption<any>[];
      value?: string;
      defaultValue?: string;
      creatable?: boolean;
      minWidth?: number | string;
      validators?: ControlFormValueValidator<string>[];
    }
  : T extends 'RadioButtonControl'
  ? {
      options: RadioButtonOption[];
      value?: string;
      defaultValue?: string;
    }
  : T extends 'Checkbox'
  ? {
      value?: boolean;
      defaultValue?: boolean;
    }
  : T extends 'InputNumber' | 'Slider'
  ? {
      min?: number;
      max?: number;
      step?: number;
      value?: number;
      defaultValue?: number;
      validators?: ControlFormValueValidator<number>[];
    }
  : T extends 'Input'
  ? {
      controlType: 'Input';
      value?: string;
      defaultValue?: string;
      validators?: ControlFormValueValidator<string>[];
    }
  : {});
