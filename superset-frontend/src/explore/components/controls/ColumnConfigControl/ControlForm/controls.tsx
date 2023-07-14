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
import { ReactNode } from 'react';
import { JsonObject } from '@superset-ui/core';
import { Select } from 'src/components';
import { SelectOptionsType } from 'src/components/Select/types';
import { Input, InputNumber } from 'src/components/Input';
import Slider from 'src/components/Slider';
import CurrencyControl from '../../CurrencyControl';
import RadioButtonControl from '../../../../../../packages/superset-ui-chart-controls/src/shared-controls/components/RadioButtonControl';
import CheckboxControl from '../../CheckboxControl';

export const ControlFormItemComponents = {
  Slider,
  InputNumber,
  Input,
  Select,
  // Directly export Checkbox will result in "using name from external module" error
  // ref: https://stackoverflow.com/questions/43900035/ts4023-exported-variable-x-has-or-is-using-name-y-from-external-module-but
  Checkbox: CheckboxControl,
  RadioButtonControl,
  CurrencyControl,
};

export type ControlType = keyof typeof ControlFormItemComponents;

export type ControlFormValueValidator<V> = (value: V) => string | false;

export type ControlFormItemSpec<T extends ControlType = ControlType> = {
  controlType: T;
  label: ReactNode;
  description: ReactNode;
  placeholder?: string;
  validators?: ControlFormValueValidator<any>[];
  width?: number | string;
  /**
   * Time to delay change propagation.
   */
  debounceDelay?: number;
} & (T extends 'Select'
  ? {
      options: any;
      value?: string;
      defaultValue?: string;
      creatable?: boolean;
      minWidth?: number | string;
      validators?: ControlFormValueValidator<string>[];
    }
  : T extends 'RadioButtonControl'
  ? {
      options: [string, ReactNode][];
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
  : T extends 'CurrencyControl'
  ? {
      controlType: 'CurrencyControl';
      value?: JsonObject;
      defaultValue?: JsonObject;
    }
  : {});
